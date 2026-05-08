const QRCode = require("qrcode");
const {
  COLLECTIONS,
  COMPLAINT_SECTIONS,
  COMPLAINT_STATUS,
  FEE_STATUS,
  NOTIFICATION_TYPES,
  PAYMENT_REVIEW_STATUS,
  ROLES,
  STATUS
} = require("../config");
const { createId } = require("../storage/seed");
const {
  addHours,
  addMinutes,
  dateKey,
  isAfterCurfew,
  isPast,
  nowIso
} = require("../utils/time");
const {
  buildFeeView,
  filterStudentsByScope,
  getOpenMovement,
  mapNotificationForUser,
  notificationVisibleToUser,
  sanitizeStudent,
  sortDescending,
  userCanAccessStudent
} = require("../utils/domain");

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function ensureAttendanceEntry(attendanceList, studentId) {
  let attendance = attendanceList.find((entry) => entry.studentId === studentId);
  if (!attendance) {
    attendance = {
      studentId,
      percentage: 100,
      presentDays: 0,
      absentDays: 0,
      lateCount: 0,
      records: []
    };
    attendanceList.push(attendance);
  }

  return attendance;
}

function updateAttendance(attendanceEntry, status, timestamp) {
  const key = dateKey(timestamp);
  let record = attendanceEntry.records.find((entry) => entry.date === key);

  if (!record) {
    record = {
      date: key,
      status,
      updatedAt: timestamp
    };
    attendanceEntry.records.push(record);
  } else {
    record.status = status;
    record.updatedAt = timestamp;
  }

  attendanceEntry.records.sort((left, right) => left.date.localeCompare(right.date));
  const totalDays = attendanceEntry.records.length;
  const lateCount = attendanceEntry.records.filter((entry) => entry.status === "LATE").length;
  const absentDays = attendanceEntry.records.filter((entry) => entry.status === "ABSENT").length;
  const presentDays = totalDays - absentDays;
  attendanceEntry.presentDays = presentDays;
  attendanceEntry.absentDays = absentDays;
  attendanceEntry.lateCount = lateCount;
  attendanceEntry.percentage =
    totalDays === 0 ? 100 : Number(((presentDays / totalDays) * 100).toFixed(1));
}

function buildNotification({
  title,
  message,
  type,
  audience = "SELECTED",
  recipientIds = [],
  recipientRoles = [],
  createdBy = "system"
}) {
  return {
    id: createId("notification"),
    title,
    message,
    type,
    audience,
    recipientIds,
    recipientRoles,
    readBy: [],
    createdBy,
    createdAt: nowIso()
  };
}

function isImageDataUrl(value) {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(String(value || ""));
}

function normalizeOptionalImage(value, label) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (!isImageDataUrl(value)) {
    throw createHttpError(`${label} must be an image file.`);
  }

  return String(value);
}

function ensureFeeRecord(data, studentId) {
  let fee = data.fees.find((entry) => entry.studentId === studentId);
  if (!fee) {
    fee = {
      studentId,
      total: 60000,
      paid: 0,
      pending: 60000,
      fine: 0,
      status: FEE_STATUS.PENDING,
      dueDate: null,
      nextInstallmentDueDate: null,
      violationCount: 0,
      paymentRequests: [],
      reminders: [],
      ledger: [],
      lastUpdatedAt: nowIso()
    };
    data.fees.push(fee);
  }

  fee.paymentRequests = Array.isArray(fee.paymentRequests) ? fee.paymentRequests : [];
  fee.reminders = Array.isArray(fee.reminders) ? fee.reminders : [];
  fee.ledger = Array.isArray(fee.ledger) ? fee.ledger : [];
  return fee;
}

function syncFeeRecord(fee) {
  const synced = buildFeeView(fee);
  fee.pending = synced.pending;
  fee.status = synced.status;
  fee.lastUpdatedAt = nowIso();
  if (fee.pending <= 0) {
    fee.nextInstallmentDueDate = null;
  }
  return fee;
}

class HostelService {
  constructor(store, dashboardService, broadcaster) {
    this.store = store;
    this.dashboardService = dashboardService;
    this.broadcaster = broadcaster;
  }

  setBroadcaster(broadcaster) {
    this.broadcaster = broadcaster;
  }

  getStudentFromData(data, studentId) {
    const student = data.students.find((entry) => entry.id === studentId);
    if (!student) {
      throw createHttpError("Student not found.", 404);
    }

    return student;
  }

  assertStudentAccess(user, student) {
    if (!userCanAccessStudent(user, student)) {
      throw createHttpError("You do not have access to this student.", 403);
    }
  }

  getScopedStaffRecipientIds(data, student) {
    const adminIds = data.admins.map((admin) => admin.id);
    const wardenIds = data.wardens
      .filter((warden) => !student.hostelType || warden.hostelType === student.hostelType)
      .map((warden) => warden.id);
    return [...new Set([...adminIds, ...wardenIds])];
  }

  emitNotification(notification) {
    const recipientRoles = notification.recipientRoles || [];
    const recipientIds = notification.recipientIds || [];

    if (recipientRoles.length) {
      this.broadcaster.emitToRoles(recipientRoles, "notification:created", notification);
    }

    if (recipientIds.length) {
      this.broadcaster.emitToUsers(recipientIds, "notification:created", notification);
    }

    if (notification.audience === "ALL") {
      this.broadcaster.emitToRoles(
        [ROLES.ADMIN, ROLES.WARDEN, ROLES.STUDENT],
        "notification:created",
        notification
      );
    }
  }

  emitStudentStatus(student, staffRecipientIds = []) {
    this.broadcaster.emitToUsers(
      [...new Set([student.id, ...staffRecipientIds])],
      "student:status",
      student
    );
    this.broadcaster.emitDashboardRefresh();
  }

  emitMovement(studentId, movement, staffRecipientIds = [], event = "movement:updated") {
    this.broadcaster.emitToUsers(
      [...new Set([studentId, ...staffRecipientIds])],
      event,
      movement
    );
    this.broadcaster.emitDashboardRefresh();
  }

  emitFeeUpdate(student, fee, staffRecipientIds = []) {
    this.broadcaster.emitToUsers(
      [...new Set([student.id, ...staffRecipientIds])],
      "fee:updated",
      {
        student: sanitizeStudent(student),
        fee: buildFeeView(fee)
      }
    );
    this.broadcaster.emitDashboardRefresh();
  }

  emitComplaintUpdate(complaint, student, staffRecipientIds, event) {
    this.broadcaster.emitToUsers(
      [...new Set([student.id, ...staffRecipientIds])],
      event,
      {
        ...complaint,
        student: sanitizeStudent(student)
      }
    );
    this.broadcaster.emitDashboardRefresh();
  }

  emitSosUpdate(alert, student, staffRecipientIds, event) {
    this.broadcaster.emitToUsers(
      [...new Set([student.id, ...staffRecipientIds])],
      event,
      {
        ...alert,
        student: sanitizeStudent(student)
      }
    );
    this.broadcaster.emitDashboardRefresh();
  }

  async getDashboardForUser(user) {
    const snapshot = await this.store.readMany(Object.keys(COLLECTIONS));
    if (user.role === ROLES.STUDENT) {
      return this.dashboardService.buildStudentDashboard(snapshot, user.id);
    }

    return this.dashboardService.buildStaffDashboard(snapshot, user);
  }

  async getStudentDirectory(user) {
    const snapshot = await this.store.readMany(["students", "fees", "movements"]);
    const students = filterStudentsByScope(user, snapshot.students);

    return students
      .map((student) => {
        const fee = buildFeeView(
          snapshot.fees.find((entry) => entry.studentId === student.id) || null
        );
        return {
          ...sanitizeStudent(student),
          feeStatus: fee?.status || FEE_STATUS.PENDING,
          feePending: fee?.pending || 0,
          paid: fee?.paid || 0,
          total: fee?.total || 0,
          fine: fee?.fine || 0,
          dueDate: fee?.dueDate || null,
          nextInstallmentDueDate: fee?.nextInstallmentDueDate || null,
          pendingPaymentReviews: (fee?.paymentRequests || []).filter(
            (request) => request.status === PAYMENT_REVIEW_STATUS.SUBMITTED
          ).length,
          openMovement: getOpenMovement(snapshot.movements, student.id)
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async getStudentProfile(user, studentId) {
    const snapshot = await this.store.readMany([
      "students",
      "fees",
      "movements",
      "complaints",
      "notifications"
    ]);
    const student = this.getStudentFromData(snapshot, studentId);
    this.assertStudentAccess(user, student);

    const fee = buildFeeView(
      snapshot.fees.find((entry) => entry.studentId === studentId) || null
    );
    const movements = sortDescending(
      snapshot.movements.filter((entry) => entry.studentId === studentId),
      "updatedAt"
    );
    const complaints = sortDescending(
      snapshot.complaints.filter((entry) => entry.studentId === studentId),
      "updatedAt"
    );
    const notifications = sortDescending(
      snapshot.notifications
        .filter((entry) => notificationVisibleToUser(entry, student))
        .map((entry) => mapNotificationForUser(entry, student.id)),
      "createdAt"
    );

    return {
      profile: sanitizeStudent(student),
      fee,
      movements,
      complaints: complaints.filter(
        (complaint) => complaint.section !== COMPLAINT_SECTIONS.ANTI_RAGGING
      ),
      antiRaggingComplaints: complaints.filter(
        (complaint) => complaint.section === COMPLAINT_SECTIONS.ANTI_RAGGING
      ),
      notifications: notifications.slice(0, 12)
    };
  }

  async getFeeRecords(user) {
    const snapshot = await this.store.readMany(["students", "fees"]);
    const students = filterStudentsByScope(user, snapshot.students);

    return students
      .map((student) => {
        const fee = buildFeeView(
          snapshot.fees.find((entry) => entry.studentId === student.id) || null
        );
        return {
          student: sanitizeStudent(student),
          ...fee
        };
      })
      .sort((left, right) => left.student.name.localeCompare(right.student.name));
  }

  async submitFeePayment(studentId, payload) {
    const amount = Number(payload.amount);
    if (!amount || amount <= 0) {
      throw createHttpError("Payment amount must be greater than zero.");
    }

    const receiptImage = normalizeOptionalImage(payload.receiptImage, "Receipt image");
    if (!receiptImage) {
      throw createHttpError("Payment receipt image is required.");
    }

    const result = await this.store.transact(
      ["students", "fees", "notifications", "admins", "wardens"],
      async (data) => {
        const student = this.getStudentFromData(data, studentId);
        const fee = ensureFeeRecord(data, studentId);
        const paymentRequest = {
          id: createId("payment"),
          amount,
          installmentLabel: String(payload.installmentLabel || "Hostel Fee").trim(),
          receiptImage,
          receiptName: String(payload.receiptName || "receipt-image").trim(),
          note: String(payload.note || "").trim(),
          status: PAYMENT_REVIEW_STATUS.SUBMITTED,
          submittedAt: nowIso(),
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: "",
          confirmedAmount: 0
        };

        fee.paymentRequests.push(paymentRequest);
        fee.ledger.push({
          id: createId("fee"),
          type: "PAYMENT_SUBMITTED",
          amount,
          note: `Receipt uploaded for ${paymentRequest.installmentLabel}.`,
          timestamp: paymentRequest.submittedAt,
          actorId: student.id,
          relatedPaymentId: paymentRequest.id
        });
        syncFeeRecord(fee);

        const adminRecipientIds = data.admins.map((admin) => admin.id);
        const notification = buildNotification({
          title: "New fee payment receipt submitted",
          message: `${student.name} uploaded a payment receipt for Rs ${amount}.`,
          type: NOTIFICATION_TYPES.GENERAL,
          recipientIds: adminRecipientIds,
          createdBy: student.id
        });
        data.notifications.push(notification);

        return {
          student,
          fee,
          notification,
          staffRecipientIds: this.getScopedStaffRecipientIds(data, student)
        };
      }
    );

    this.emitNotification(result.notification);
    this.emitFeeUpdate(result.student, result.fee, result.staffRecipientIds);
    return {
      fee: buildFeeView(result.fee),
      notification: result.notification
    };
  }

  async reviewFeePayment(studentId, paymentId, payload, actor) {
    if (actor.role !== ROLES.ADMIN) {
      throw createHttpError("Only admins can verify fee receipts.", 403);
    }

    const action = String(payload.action || "").trim().toUpperCase();
    if (!["APPROVE", "REJECT"].includes(action)) {
      throw createHttpError("Fee review action must be APPROVE or REJECT.");
    }

    const result = await this.store.transact(
      ["students", "fees", "notifications", "admins", "wardens"],
      async (data) => {
        const student = this.getStudentFromData(data, studentId);
        const fee = ensureFeeRecord(data, studentId);
        const paymentRequest = fee.paymentRequests.find((entry) => entry.id === paymentId);

        if (!paymentRequest) {
          throw createHttpError("Payment request not found.", 404);
        }

        if (paymentRequest.status !== PAYMENT_REVIEW_STATUS.SUBMITTED) {
          throw createHttpError("This payment request has already been reviewed.");
        }

        paymentRequest.reviewedAt = nowIso();
        paymentRequest.reviewedBy = actor.id;
        paymentRequest.reviewNote = String(payload.reviewNote || "").trim();

        if (action === "APPROVE") {
          const confirmedAmount = Number(payload.confirmedAmount || paymentRequest.amount);
          if (!confirmedAmount || confirmedAmount <= 0) {
            throw createHttpError("Confirmed amount must be greater than zero.");
          }

          paymentRequest.status = PAYMENT_REVIEW_STATUS.APPROVED;
          paymentRequest.confirmedAmount = confirmedAmount;
          fee.paid = Number(fee.paid || 0) + confirmedAmount;
          if (payload.nextInstallmentDueDate !== undefined) {
            fee.nextInstallmentDueDate = payload.nextInstallmentDueDate || null;
          }
          if (payload.dueDate !== undefined) {
            fee.dueDate = payload.dueDate || fee.dueDate || null;
          }
          fee.ledger.push({
            id: createId("fee"),
            type: "PAYMENT_APPROVED",
            amount: confirmedAmount,
            note: paymentRequest.reviewNote || "Receipt verified by admin.",
            timestamp: paymentRequest.reviewedAt,
            actorId: actor.id,
            relatedPaymentId: paymentRequest.id
          });
        } else {
          paymentRequest.status = PAYMENT_REVIEW_STATUS.REJECTED;
          paymentRequest.confirmedAmount = 0;
          fee.ledger.push({
            id: createId("fee"),
            type: "PAYMENT_REJECTED",
            amount: paymentRequest.amount,
            note: paymentRequest.reviewNote || "Receipt rejected by admin.",
            timestamp: paymentRequest.reviewedAt,
            actorId: actor.id,
            relatedPaymentId: paymentRequest.id
          });
        }

        syncFeeRecord(fee);
        const notification = buildNotification({
          title:
            action === "APPROVE"
              ? "Fee payment confirmed"
              : "Fee payment needs attention",
          message:
            action === "APPROVE"
              ? `Your fee receipt has been approved. Pending dues are now ${fee.pending > 0 ? `Rs ${fee.pending}` : "Nil"}.`
              : "Your submitted fee receipt was not approved. Check the admin note and re-submit if needed.",
          type: NOTIFICATION_TYPES.SYSTEM,
          recipientIds: [student.id],
          createdBy: actor.id
        });
        data.notifications.push(notification);

        return {
          student,
          fee,
          notification,
          staffRecipientIds: this.getScopedStaffRecipientIds(data, student)
        };
      }
    );

    this.emitNotification(result.notification);
    this.emitFeeUpdate(result.student, result.fee, result.staffRecipientIds);
    return buildFeeView(result.fee);
  }

  async updateStudentFeeRecord(studentId, payload, actor) {
    if (actor.role !== ROLES.ADMIN) {
      throw createHttpError("Only admins can update fee records.", 403);
    }

    const result = await this.store.transact(
      ["students", "fees", "notifications", "admins", "wardens"],
      async (data) => {
        const student = this.getStudentFromData(data, studentId);
        const fee = ensureFeeRecord(data, studentId);
        const previousFee = buildFeeView(fee);
        const note = String(payload.note || "").trim();

        if (payload.total !== undefined && payload.total !== "") {
          fee.total = Number(payload.total);
        }

        if (payload.paid !== undefined && payload.paid !== "") {
          fee.paid = Number(payload.paid);
        }

        if (payload.pending !== undefined && payload.pending !== "") {
          const pendingAmount = Number(payload.pending);
          fee.total = Number(fee.paid || 0) + pendingAmount - Number(fee.fine || 0);
        }

        if (payload.manualFineDelta !== undefined && payload.manualFineDelta !== "") {
          const fineDelta = Number(payload.manualFineDelta);
          fee.fine = Math.max(0, Number(fee.fine || 0) + fineDelta);
          fee.ledger.push({
            id: createId("fee"),
            type: fineDelta >= 0 ? "FINE" : "FINE_REVERSAL",
            amount: Math.abs(fineDelta),
            note: note || "Manual fine adjustment by admin.",
            timestamp: nowIso(),
            actorId: actor.id
          });
        }

        if (payload.dueDate !== undefined) {
          fee.dueDate = payload.dueDate || null;
        }

        if (payload.nextInstallmentDueDate !== undefined) {
          fee.nextInstallmentDueDate = payload.nextInstallmentDueDate || null;
        }

        syncFeeRecord(fee);
        fee.ledger.push({
          id: createId("fee"),
          type: "MANUAL_UPDATE",
          amount: 0,
          note:
            note ||
            `Fee record adjusted. Paid ${previousFee.paid} -> ${fee.paid}, Pending ${previousFee.pending} -> ${fee.pending}.`,
          timestamp: nowIso(),
          actorId: actor.id
        });

        const notificationMessage =
          String(payload.notificationMessage || "").trim() ||
          "Your hostel fee record was updated by the admin. Review the latest fee section in your dashboard.";
        const notification = buildNotification({
          title: "Fee record updated",
          message: notificationMessage,
          type: NOTIFICATION_TYPES.SYSTEM,
          recipientIds: [student.id],
          createdBy: actor.id
        });
        data.notifications.push(notification);

        return {
          student,
          fee,
          notification,
          staffRecipientIds: this.getScopedStaffRecipientIds(data, student)
        };
      }
    );

    this.emitNotification(result.notification);
    this.emitFeeUpdate(result.student, result.fee, result.staffRecipientIds);
    return buildFeeView(result.fee);
  }

  async sendFeeReminder(studentId, payload, actor) {
    if (actor.role !== ROLES.ADMIN) {
      throw createHttpError("Only admins can send fee reminders.", 403);
    }

    const message = String(payload.message || "").trim();
    if (!message) {
      throw createHttpError("Reminder message is required.");
    }

    const result = await this.store.transact(
      ["students", "fees", "notifications", "admins", "wardens"],
      async (data) => {
        const student = this.getStudentFromData(data, studentId);
        const fee = ensureFeeRecord(data, studentId);
        const reminder = {
          id: createId("reminder"),
          message,
          dueDate: payload.dueDate || fee.nextInstallmentDueDate || fee.dueDate || null,
          createdAt: nowIso(),
          createdBy: actor.id
        };

        fee.reminders.push(reminder);
        fee.ledger.push({
          id: createId("fee"),
          type: "REMINDER",
          amount: 0,
          note: message,
          timestamp: reminder.createdAt,
          actorId: actor.id
        });
        syncFeeRecord(fee);

        const notification = buildNotification({
          title: "Fee payment reminder",
          message,
          type: NOTIFICATION_TYPES.PERSONAL,
          recipientIds: [student.id],
          createdBy: actor.id
        });
        data.notifications.push(notification);

        return {
          student,
          fee,
          notification,
          staffRecipientIds: this.getScopedStaffRecipientIds(data, student)
        };
      }
    );

    this.emitNotification(result.notification);
    this.emitFeeUpdate(result.student, result.fee, result.staffRecipientIds);
    return buildFeeView(result.fee);
  }

  async getMovements(user) {
    const snapshot = await this.store.readMany(["movements", "students"]);
    const studentsById = Object.fromEntries(snapshot.students.map((student) => [student.id, student]));
    const relevantMovements =
      user.role === ROLES.STUDENT
        ? snapshot.movements.filter((entry) => entry.studentId === user.id)
        : snapshot.movements.filter((entry) =>
            userCanAccessStudent(user, studentsById[entry.studentId])
          );

    return sortDescending(relevantMovements, "updatedAt").map((movement) => ({
      ...movement,
      student: sanitizeStudent(studentsById[movement.studentId])
    }));
  }

  async getComplaints(user, options = {}) {
    const snapshot = await this.store.readMany(["complaints", "students"]);
    const studentsById = Object.fromEntries(snapshot.students.map((student) => [student.id, student]));
    const relevantComplaints =
      user.role === ROLES.STUDENT
        ? snapshot.complaints.filter((entry) => entry.studentId === user.id)
        : snapshot.complaints.filter((entry) =>
            userCanAccessStudent(user, studentsById[entry.studentId])
          );
    const filteredComplaints = options.section
      ? relevantComplaints.filter((entry) => entry.section === options.section)
      : relevantComplaints;

    return sortDescending(filteredComplaints, "updatedAt").map((complaint) => ({
      ...complaint,
      student: sanitizeStudent(studentsById[complaint.studentId])
    }));
  }

  async getNotifications(user) {
    const snapshot = await this.store.readMany(["notifications"]);
    return sortDescending(
      snapshot.notifications
        .filter((notification) => notificationVisibleToUser(notification, user))
        .map((notification) => mapNotificationForUser(notification, user.id)),
      "createdAt"
    );
  }

  async getMessMenu() {
    return this.store.read("messMenu");
  }

  async getMealFeedback(user) {
    const feedback = await this.store.read("mealFeedback");
    if (user.role === ROLES.STUDENT) {
      return sortDescending(
        feedback.filter((entry) => entry.studentId === user.id),
        "createdAt"
      );
    }

    const students = await this.store.read("students");
    const visibleStudents = new Set(filterStudentsByScope(user, students).map((student) => student.id));
    return sortDescending(
      feedback.filter((entry) => visibleStudents.has(entry.studentId)),
      "createdAt"
    );
  }

  async getMealLeaves(user) {
    const mealLeaves = await this.store.read("mealLeaves");
    if (user.role === ROLES.STUDENT) {
      return sortDescending(
        mealLeaves.filter((entry) => entry.studentId === user.id),
        "createdAt"
      );
    }

    const students = await this.store.read("students");
    const visibleStudents = new Set(filterStudentsByScope(user, students).map((student) => student.id));
    return sortDescending(
      mealLeaves.filter((entry) => visibleStudents.has(entry.studentId)),
      "createdAt"
    );
  }

  async getSosAlerts(user) {
    const snapshot = await this.store.readMany(["sosAlerts", "students"]);
    const relevant =
      user.role === ROLES.STUDENT
        ? snapshot.sosAlerts.filter((entry) => entry.studentId === user.id)
        : snapshot.sosAlerts.filter((entry) => {
            const student = snapshot.students.find((studentItem) => studentItem.id === entry.studentId);
            return userCanAccessStudent(user, student);
          });
    const studentsById = Object.fromEntries(snapshot.students.map((student) => [student.id, student]));
    return sortDescending(relevant, "createdAt").map((entry) => ({
      ...entry,
      student: sanitizeStudent(studentsById[entry.studentId])
    }));
  }

  async getConfig() {
    return this.store.read("config");
  }

  async getStudentQrCode(studentId) {
    const students = await this.store.read("students");
    const student = students.find((entry) => entry.id === studentId);
    if (!student) {
      throw createHttpError("Student not found.", 404);
    }

    const image = await QRCode.toDataURL(student.qrToken, {
      width: 240,
      margin: 1
    });

    return {
      token: student.qrToken,
      image
    };
  }

  async requestExit(studentId, payload) {
    const purposes = ["City", "Medical", "Home", "College", "Other"];
    const purpose = String(payload.purpose || "").trim();
    const note = String(payload.note || "").trim();
    const exitTime = payload.exitTime ? new Date(payload.exitTime) : new Date();

    if (!purposes.includes(purpose)) {
      throw createHttpError("Invalid exit purpose.");
    }

    const result = await this.store.transact(
      ["students", "movements", "attendance", "config", "admins", "wardens"],
      async (data) => {
        const student = this.getStudentFromData(data, studentId);

        if (getOpenMovement(data.movements, studentId)) {
          throw createHttpError("Student already has an active exit record.");
        }

        const expectedReturnTime = payload.expectedReturnTime
          ? new Date(payload.expectedReturnTime)
          : addHours(exitTime, Number(data.config.defaultExitHours || 4));

        const movement = {
          id: createId("movement"),
          studentId,
          purpose,
          status: "OPEN",
          mode: "MANUAL",
          exitTime: exitTime.toISOString(),
          expectedReturnTime: expectedReturnTime.toISOString(),
          returnTime: null,
          note,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          violationApplied: false,
          overdueAlertedAt: null
        };

        student.status = STATUS.OUT;
        student.updatedAt = nowIso();
        data.movements.push(movement);
        ensureAttendanceEntry(data.attendance, studentId);

        return {
          student: sanitizeStudent(student),
          movement,
          staffRecipientIds: this.getScopedStaffRecipientIds(data, student)
        };
      }
    );

    this.emitStudentStatus(result.student, result.staffRecipientIds);
    this.emitMovement(
      studentId,
      result.movement,
      result.staffRecipientIds,
      "movement:created"
    );
    return result;
  }

  completeReturnMutation(data, studentId, options = {}) {
    const student = this.getStudentFromData(data, studentId);

    const activeMovement = options.movementId
      ? data.movements.find(
          (entry) =>
            entry.id === options.movementId &&
            entry.studentId === studentId &&
            entry.returnTime === null
        )
      : getOpenMovement(data.movements, studentId);

    if (!activeMovement) {
      throw createHttpError("No active exit record found for this student.");
    }

    const fee = ensureFeeRecord(data, studentId);
    const attendance = ensureAttendanceEntry(data.attendance, studentId);
    const returnTimestamp = options.returnTime ? new Date(options.returnTime) : new Date();

    activeMovement.returnTime = returnTimestamp.toISOString();
    activeMovement.updatedAt = nowIso();
    activeMovement.status = "CLOSED";

    student.status = STATUS.IN;
    student.lastSeenAt = returnTimestamp.toISOString();
    student.updatedAt = returnTimestamp.toISOString();

    const notifications = [];

    if (isAfterCurfew(returnTimestamp, data.config.curfewTime)) {
      if (!activeMovement.violationApplied) {
        fee.fine = Number(fee.fine || 0) + Number(data.config.violationFine || 0);
        fee.violationCount = Number(fee.violationCount || 0) + 1;
        fee.ledger.push({
          id: createId("fee"),
          type: "FINE",
          amount: Number(data.config.violationFine || 0),
          note: "Curfew violation",
          timestamp: returnTimestamp.toISOString(),
          actorId: options.actorId || "system"
        });
        activeMovement.violationApplied = true;
      }

      syncFeeRecord(fee);
      updateAttendance(attendance, "LATE", returnTimestamp.toISOString());
      notifications.push(
        buildNotification({
          title: "Curfew violation detected",
          message: `${student.name} entered after curfew and a fine has been recorded.`,
          type: NOTIFICATION_TYPES.EMERGENCY,
          recipientIds: this.getScopedStaffRecipientIds(data, student),
          createdBy: options.actorId || "system"
        })
      );
    } else {
      updateAttendance(attendance, "PRESENT", returnTimestamp.toISOString());
    }

    if (options.wasOverdue || options.notifyStudentReturn) {
      notifications.push(
        buildNotification({
          title: "Return marked successfully",
          message: `Your return to hostel was recorded at ${returnTimestamp.toLocaleString()}.`,
          type: NOTIFICATION_TYPES.SYSTEM,
          recipientIds: [student.id],
          createdBy: options.actorId || "system"
        })
      );
    }

    notifications.forEach((notification) => data.notifications.push(notification));

    return {
      student,
      movement: activeMovement,
      fee,
      notifications,
      staffRecipientIds: this.getScopedStaffRecipientIds(data, student)
    };
  }

  async markReturn(studentId, payload = {}, actor) {
    const result = await this.store.transact(
      ["students", "movements", "fees", "attendance", "notifications", "config", "admins", "wardens"],
      async (data) => {
        const student = this.getStudentFromData(data, studentId);
        if (actor.role !== ROLES.ADMIN && actor.role !== ROLES.STUDENT) {
          this.assertStudentAccess(actor, student);
        }
        const wasOverdue = student.status === STATUS.OVERDUE;
        return this.completeReturnMutation(data, studentId, {
          movementId: payload.movementId,
          returnTime: payload.returnTime,
          actorId: actor.id,
          wasOverdue,
          notifyStudentReturn: true
        });
      }
    );

    result.notifications.forEach((notification) => this.emitNotification(notification));
    this.emitStudentStatus(sanitizeStudent(result.student), result.staffRecipientIds);
    this.emitMovement(studentId, result.movement, result.staffRecipientIds);
    this.emitFeeUpdate(result.student, result.fee, result.staffRecipientIds);
    return {
      student: sanitizeStudent(result.student),
      movement: result.movement,
      notifications: result.notifications
    };
  }

  async scanQr(actor, payload) {
    const qrToken = String(payload.qrToken || "").trim();
    if (!qrToken) {
      throw createHttpError("QR token is required.");
    }

    const result = await this.store.transact(
      ["students", "movements", "fees", "attendance", "notifications", "config", "admins", "wardens"],
      async (data) => {
        const student = data.students.find((entry) => entry.qrToken === qrToken);
        if (!student) {
          throw createHttpError("Invalid QR token.", 404);
        }

        this.assertStudentAccess(actor, student);

        if (student.status === STATUS.IN) {
          const exitTime = new Date();
          const expectedReturn = payload.expectedReturnTime
            ? new Date(payload.expectedReturnTime)
            : addHours(exitTime, Number(data.config.defaultExitHours || 4));
          const movement = {
            id: createId("movement"),
            studentId: student.id,
            purpose: String(payload.purpose || "College"),
            status: "OPEN",
            mode: "QR",
            exitTime: exitTime.toISOString(),
            expectedReturnTime: expectedReturn.toISOString(),
            returnTime: null,
            note: "QR scan recorded",
            createdAt: nowIso(),
            updatedAt: nowIso(),
            violationApplied: false,
            overdueAlertedAt: null
          };
          student.status = STATUS.OUT;
          student.updatedAt = nowIso();
          data.movements.push(movement);
          ensureAttendanceEntry(data.attendance, student.id);
          return {
            action: "CHECK_OUT",
            student,
            movement,
            fee: ensureFeeRecord(data, student.id),
            notifications: [],
            staffRecipientIds: this.getScopedStaffRecipientIds(data, student)
          };
        }

        const wasOverdue = student.status === STATUS.OVERDUE;
        const returnResult = this.completeReturnMutation(data, student.id, {
          actorId: actor.id,
          wasOverdue,
          notifyStudentReturn: true
        });
        return {
          action: "CHECK_IN",
          ...returnResult
        };
      }
    );

    result.notifications.forEach((notification) => this.emitNotification(notification));
    this.emitStudentStatus(sanitizeStudent(result.student), result.staffRecipientIds);
    this.emitMovement(
      result.student.id,
      result.movement,
      result.staffRecipientIds,
      result.action === "CHECK_OUT" ? "movement:created" : "movement:updated"
    );
    this.emitFeeUpdate(result.student, result.fee, result.staffRecipientIds);
    return {
      action: result.action,
      student: sanitizeStudent(result.student),
      movement: result.movement
    };
  }

  async createComplaint(studentId, payload) {
    const title = String(payload.title || "").trim();
    const description = String(payload.description || "").trim();
    const category = String(payload.category || "").trim();
    const section = String(payload.section || COMPLAINT_SECTIONS.GENERAL).trim().toUpperCase();

    if (!title || !description || !category) {
      throw createHttpError("Title, description, and category are required.");
    }

    if (!Object.values(COMPLAINT_SECTIONS).includes(section)) {
      throw createHttpError("Invalid complaint section.");
    }

    const evidenceImage = normalizeOptionalImage(payload.evidenceImage, "Complaint evidence");

    const result = await this.store.transact(
      ["students", "complaints", "notifications", "admins", "wardens"],
      async (data) => {
        const student = this.getStudentFromData(data, studentId);

        const complaint = {
          id: createId("complaint"),
          studentId,
          title,
          description,
          category,
          section,
          status: COMPLAINT_STATUS.PENDING,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          resolutionNote: "",
          evidenceImage,
          evidenceName: String(payload.evidenceName || "").trim() || null
        };
        data.complaints.push(complaint);

        const notification = buildNotification({
          title:
            section === COMPLAINT_SECTIONS.ANTI_RAGGING
              ? "New anti-ragging complaint"
              : "New hostel complaint",
          message: `${student.name} submitted a ${category} complaint.`,
          type:
            section === COMPLAINT_SECTIONS.ANTI_RAGGING
              ? NOTIFICATION_TYPES.EMERGENCY
              : NOTIFICATION_TYPES.GENERAL,
          recipientIds: this.getScopedStaffRecipientIds(data, student),
          createdBy: student.id
        });
        data.notifications.push(notification);

        return {
          complaint,
          student,
          notification,
          staffRecipientIds: this.getScopedStaffRecipientIds(data, student)
        };
      }
    );

    this.emitNotification(result.notification);
    this.emitComplaintUpdate(
      result.complaint,
      result.student,
      result.staffRecipientIds,
      "complaint:created"
    );
    return {
      ...result.complaint,
      student: sanitizeStudent(result.student)
    };
  }

  async updateComplaintStatus(complaintId, payload, actor) {
    const status = String(payload.status || "").trim();
    const allowedStatus = Object.values(COMPLAINT_STATUS);
    if (!allowedStatus.includes(status)) {
      throw createHttpError("Invalid complaint status.");
    }

    const result = await this.store.transact(
      ["complaints", "students", "notifications", "admins", "wardens"],
      async (data) => {
        const complaint = data.complaints.find((entry) => entry.id === complaintId);
        if (!complaint) {
          throw createHttpError("Complaint not found.", 404);
        }

        const student = this.getStudentFromData(data, complaint.studentId);
        this.assertStudentAccess(actor, student);

        complaint.status = status;
        complaint.updatedAt = nowIso();
        complaint.resolutionNote = String(payload.resolutionNote || complaint.resolutionNote || "");

        const notification = buildNotification({
          title: "Complaint status updated",
          message: `${complaint.title} is now marked as ${status}.`,
          type: NOTIFICATION_TYPES.SYSTEM,
          recipientIds: [complaint.studentId],
          createdBy: actor.id
        });
        data.notifications.push(notification);

        return {
          complaint,
          student,
          notification,
          staffRecipientIds: this.getScopedStaffRecipientIds(data, student)
        };
      }
    );

    this.emitNotification(result.notification);
    this.emitComplaintUpdate(
      result.complaint,
      result.student,
      result.staffRecipientIds,
      "complaint:updated"
    );
    return {
      ...result.complaint,
      student: sanitizeStudent(result.student)
    };
  }

  async createNotification(actor, payload) {
    const title = String(payload.title || "").trim();
    const message = String(payload.message || "").trim();
    const type = String(payload.type || NOTIFICATION_TYPES.GENERAL).trim().toUpperCase();
    const audience = String(payload.audience || "ALL").trim().toUpperCase();

    if (!title || !message) {
      throw createHttpError("Title and message are required.");
    }

    const result = await this.store.transact(
      ["notifications", "students", "admins", "wardens"],
      async (data) => {
        let recipientIds = Array.isArray(payload.recipientIds) ? [...payload.recipientIds] : [];
        let recipientRoles = [];
        let notificationAudience = audience;

        if (actor.role === ROLES.ADMIN && audience === "ALL") {
          recipientRoles = [ROLES.ADMIN, ROLES.WARDEN, ROLES.STUDENT];
        } else if (audience === "STAFF") {
          recipientRoles = [ROLES.ADMIN, ROLES.WARDEN];
        } else {
          notificationAudience = "SELECTED";
        }

        if (actor.role === ROLES.WARDEN) {
          if (audience === "ALL") {
            const scopedStudents = filterStudentsByScope(actor, data.students).map(
              (student) => student.id
            );
            recipientIds = [...recipientIds, ...scopedStudents];
            notificationAudience = "SELECTED";
            recipientRoles = [ROLES.ADMIN];
          } else if (audience === "SELECTED") {
            recipientIds.forEach((studentId) => {
              const student = this.getStudentFromData(data, studentId);
              this.assertStudentAccess(actor, student);
            });
          }
        }

        if (notificationAudience === "SELECTED" && recipientIds.length === 0 && recipientRoles.length === 0) {
          throw createHttpError("A selected notification requires at least one recipient.");
        }

        const notification = buildNotification({
          title,
          message,
          type,
          audience: notificationAudience,
          recipientIds: [...new Set(recipientIds)],
          recipientRoles,
          createdBy: actor.id
        });
        data.notifications.push(notification);
        return notification;
      }
    );

    this.emitNotification(result);
    this.broadcaster.emitDashboardRefresh();
    return result;
  }

  async markNotificationRead(notificationId, userId) {
    return this.store.transact(["notifications"], async (data) => {
      const notification = data.notifications.find((entry) => entry.id === notificationId);
      if (!notification) {
        throw createHttpError("Notification not found.", 404);
      }

      const alreadyRead = notification.readBy.some((entry) => entry.userId === userId);
      if (!alreadyRead) {
        notification.readBy.push({
          userId,
          readAt: nowIso()
        });
      }

      return mapNotificationForUser(notification, userId);
    });
  }

  async updateMessMenu(menuPayload, actor) {
    if (actor.role !== ROLES.ADMIN) {
      throw createHttpError("Only admins can update the mess menu.", 403);
    }

    if (!Array.isArray(menuPayload.days) || menuPayload.days.length !== 7) {
      throw createHttpError("Mess menu must contain seven day entries.");
    }

    const menu = await this.store.transact(["messMenu"], async (data) => {
      data.messMenu = {
        weekOf: String(menuPayload.weekOf || dateKey(new Date())),
        days: menuPayload.days.map((day) => ({
          day: String(day.day || "").trim(),
          breakfast: String(day.breakfast || "").trim(),
          lunch: String(day.lunch || "").trim(),
          snacks: String(day.snacks || "").trim(),
          dinner: String(day.dinner || "").trim()
        }))
      };
      return data.messMenu;
    });

    const notification = await this.createNotification(actor, {
      title: "Mess menu updated",
      message: "The weekly mess menu has been refreshed.",
      type: NOTIFICATION_TYPES.GENERAL,
      audience: "ALL"
    });

    this.broadcaster.emitToRoles(
      [ROLES.ADMIN, ROLES.WARDEN, ROLES.STUDENT],
      "mess:updated",
      menu
    );
    return {
      menu,
      notification
    };
  }

  async submitMealFeedback(studentId, payload) {
    const rating = Number(payload.rating);
    if (!rating || rating < 1 || rating > 5) {
      throw createHttpError("Rating must be between 1 and 5.");
    }

    const saved = await this.store.transact(
      ["mealFeedback"],
      async (data) => {
        const day = String(payload.day || dateKey(new Date())).trim();
        const mealType = String(payload.mealType || "Meal").trim();
        const feedbackText = String(payload.feedback || "").trim();
        let feedback = data.mealFeedback.find(
          (entry) =>
            entry.studentId === studentId &&
            entry.day === day &&
            entry.mealType.toLowerCase() === mealType.toLowerCase()
        );

        if (!feedback) {
          feedback = {
            id: createId("meal-feedback"),
            studentId,
            day,
            mealType,
            rating,
            feedback: feedbackText,
            createdAt: nowIso()
          };
          data.mealFeedback.push(feedback);
        } else {
          feedback.rating = rating;
          feedback.feedback = feedbackText;
          feedback.createdAt = nowIso();
        }

        return feedback;
      }
    );

    this.broadcaster.emitToRoles([ROLES.ADMIN, ROLES.WARDEN], "mess:feedback", saved);
    this.broadcaster.emitDashboardRefresh();
    return saved;
  }

  async applyMealLeave(studentId, payload) {
    const fromDate = String(payload.fromDate || "").trim();
    const toDate = String(payload.toDate || "").trim();
    const reason = String(payload.reason || "").trim();
    const meals = Array.isArray(payload.meals) ? payload.meals : [];

    if (!fromDate || !toDate || !reason || meals.length === 0) {
      throw createHttpError("Meal leave requires from date, to date, reason, and meals.");
    }

    const leave = await this.store.transact(["mealLeaves"], async (data) => {
      const created = {
        id: createId("meal-leave"),
        studentId,
        fromDate,
        toDate,
        reason,
        meals,
        status: "Pending",
        createdAt: nowIso()
      };
      data.mealLeaves.push(created);
      return created;
    });

    this.broadcaster.emitToRoles([ROLES.ADMIN, ROLES.WARDEN], "mess:leave", leave);
    this.broadcaster.emitToUser(studentId, "mess:leave", leave);
    this.broadcaster.emitDashboardRefresh();
    return leave;
  }

  async triggerSos(studentId, payload) {
    const message = String(payload.message || "Emergency assistance required.").trim();
    const result = await this.store.transact(
      ["students", "sosAlerts", "notifications", "admins", "wardens"],
      async (data) => {
        const student = this.getStudentFromData(data, studentId);

        const alert = {
          id: createId("sos"),
          studentId,
          roomNumber: student.roomNumber,
          floor: student.floor,
          message,
          createdAt: nowIso(),
          status: "OPEN",
          resolvedAt: null
        };
        data.sosAlerts.push(alert);

        const notification = buildNotification({
          title: "Emergency SOS triggered",
          message: `${student.name} in room ${student.roomNumber} triggered an SOS alert.`,
          type: NOTIFICATION_TYPES.EMERGENCY,
          recipientIds: this.getScopedStaffRecipientIds(data, student),
          createdBy: student.id
        });
        data.notifications.push(notification);

        return {
          alert,
          student,
          notification,
          staffRecipientIds: this.getScopedStaffRecipientIds(data, student)
        };
      }
    );

    this.emitNotification(result.notification);
    this.emitSosUpdate(result.alert, result.student, result.staffRecipientIds, "sos:created");
    return result.alert;
  }

  async resolveSos(alertId, actor) {
    const resolved = await this.store.transact(
      ["sosAlerts", "students", "admins", "wardens"],
      async (data) => {
        const alert = data.sosAlerts.find((entry) => entry.id === alertId);
        if (!alert) {
          throw createHttpError("SOS alert not found.", 404);
        }

        const student = this.getStudentFromData(data, alert.studentId);
        this.assertStudentAccess(actor, student);

        alert.status = "RESOLVED";
        alert.resolvedAt = nowIso();
        alert.resolvedBy = actor.id;
        return {
          alert,
          student,
          staffRecipientIds: this.getScopedStaffRecipientIds(data, student)
        };
      }
    );

    this.emitSosUpdate(
      resolved.alert,
      resolved.student,
      resolved.staffRecipientIds,
      "sos:resolved"
    );
    return resolved.alert;
  }

  async updateConfig(payload, actor) {
    if (![ROLES.ADMIN, ROLES.WARDEN].includes(actor.role)) {
      throw createHttpError("Only staff can update hostel settings.", 403);
    }

    const config = await this.store.transact(["config"], async (data) => {
      data.config = {
        ...data.config,
        curfewTime: String(payload.curfewTime || data.config.curfewTime),
        violationFine: Number(payload.violationFine ?? data.config.violationFine),
        overdueGraceMinutes: Number(
          payload.overdueGraceMinutes ?? data.config.overdueGraceMinutes
        ),
        defaultExitHours: Number(payload.defaultExitHours ?? data.config.defaultExitHours)
      };
      return data.config;
    });

    this.broadcaster.emitToRoles([ROLES.ADMIN, ROLES.WARDEN], "config:updated", config);
    this.broadcaster.emitDashboardRefresh();
    return config;
  }

  async processAutomations() {
    const updates = await this.store.transact(
      ["students", "movements", "attendance", "notifications", "config", "admins", "wardens"],
      async (data) => {
        const changes = {
          statuses: [],
          movements: [],
          notifications: []
        };

        const now = new Date();

        data.students.forEach((student) => {
          const openMovement = getOpenMovement(data.movements, student.id);
          const attendance = ensureAttendanceEntry(data.attendance, student.id);

          if (
            openMovement &&
            openMovement.expectedReturnTime &&
            isPast(
              addMinutes(openMovement.expectedReturnTime, Number(data.config.overdueGraceMinutes || 0)),
              now
            ) &&
            student.status !== STATUS.OVERDUE
          ) {
            student.status = STATUS.OVERDUE;
            student.updatedAt = nowIso();
            openMovement.status = "OVERDUE";
            openMovement.updatedAt = nowIso();
            openMovement.overdueAlertedAt = nowIso();

            const staffRecipientIds = this.getScopedStaffRecipientIds(data, student);
            const notification = buildNotification({
              title: "Student overdue",
              message: `${student.name} has exceeded the expected return time.`,
              type: NOTIFICATION_TYPES.EMERGENCY,
              recipientIds: staffRecipientIds,
              createdBy: "system"
            });
            data.notifications.push(notification);
            changes.notifications.push(notification);
            changes.statuses.push({
              student: sanitizeStudent(student),
              staffRecipientIds
            });
            changes.movements.push({
              movement: openMovement,
              studentId: student.id,
              staffRecipientIds
            });
          }

          if (student.status !== STATUS.IN && isAfterCurfew(now, data.config.curfewTime)) {
            updateAttendance(attendance, "ABSENT", nowIso());
          }
        });

        return changes;
      }
    );

    updates.notifications.forEach((notification) => this.emitNotification(notification));
    updates.statuses.forEach((entry) =>
      this.emitStudentStatus(entry.student, entry.staffRecipientIds)
    );
    updates.movements.forEach((entry) =>
      this.emitMovement(entry.studentId, entry.movement, entry.staffRecipientIds)
    );
    if (
      updates.notifications.length ||
      updates.statuses.length ||
      updates.movements.length
    ) {
      this.broadcaster.emitToRoles([ROLES.ADMIN, ROLES.WARDEN], "alert:overdue", {
        count: updates.statuses.length,
        at: nowIso()
      });
    }
    return updates;
  }
}

module.exports = {
  HostelService
};
