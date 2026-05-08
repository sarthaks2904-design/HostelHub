const bcrypt = require("bcrypt");
const crypto = require("node:crypto");
const {
  COLLECTIONS,
  COMPLAINT_SECTIONS,
  COMPLAINT_STATUS,
  DEFAULT_ACCOUNTS,
  FEE_STATUS,
  HOSTEL_TYPES,
  NOTIFICATION_TYPES,
  PAYMENT_REVIEW_STATUS,
  ROLES,
  STATUS
} = require("../config");
const { buildFeeView } = require("../utils/domain");
const { addHours, addMinutes, dateKey, nowIso, startOfWeek } = require("../utils/time");

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createQrToken(enrollmentNumber) {
  return crypto
    .createHash("sha256")
    .update(`hostelhub:${enrollmentNumber}`)
    .digest("hex")
    .slice(0, 18);
}

function addDays(value, days) {
  return new Date(new Date(value).getTime() + days * 24 * 60 * 60 * 1000);
}

function buildAttendanceRecords(baseDate, status = "PRESENT") {
  const records = [];

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() - index);
    records.push({
      date: dateKey(date),
      status,
      updatedAt: date.toISOString()
    });
  }

  return records;
}

function buildMessMenu() {
  const weekStart = startOfWeek(new Date());
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const breakfast = ["Poha & Tea", "Idli & Sambar", "Aloo Paratha", "Oats Bowl", "Sandwich", "Upma", "Puri Bhaji"];
  const lunch = ["Dal Rice", "Rajma Rice", "Paneer Curry", "Veg Pulao", "Chole Bhature", "Sambar Rice", "Biryani"];
  const dinner = ["Roti Sabzi", "Khichdi", "Noodles", "Pasta", "Fried Rice", "Dal Tadka", "Mixed Veg Curry"];

  return {
    weekOf: dateKey(weekStart),
    days: dayNames.map((day, index) => ({
      day,
      breakfast: breakfast[index],
      lunch: lunch[index],
      snacks: "Fruit & Juice",
      dinner: dinner[index]
    }))
  };
}

function buildInitialFeeRecord(student, index, now) {
  const total = 60000;
  const paid = 38000 + index * 3500;
  const fine = student.status === STATUS.OVERDUE ? 250 : 0;
  const dueDate = addDays(now, 15 + index * 5).toISOString();
  const nextInstallmentDueDate = paid >= total ? null : addDays(now, 35 + index * 5).toISOString();
  const fee = {
    studentId: student.id,
    total,
    paid,
    fine,
    pending: total - paid + fine,
    status: fine > 0 ? FEE_STATUS.FINE_CHARGES : FEE_STATUS.PENDING,
    dueDate,
    nextInstallmentDueDate,
    violationCount: student.status === STATUS.OVERDUE ? 1 : 0,
    paymentRequests: [],
    reminders: [
      {
        id: createId("reminder"),
        message: "Your next hostel installment is due soon.",
        dueDate: nextInstallmentDueDate,
        createdAt: addHours(now, -12).toISOString(),
        createdBy: DEFAULT_ACCOUNTS.admin.id
      }
    ],
    ledger: [
      {
        id: createId("fee"),
        type: "PAYMENT",
        amount: paid,
        note: "Semester hostel fee deposit",
        timestamp: addHours(now, -48).toISOString(),
        actorId: DEFAULT_ACCOUNTS.admin.id
      }
    ],
    lastUpdatedAt: nowIso()
  };

  fee.pending = buildFeeView(fee).pending;
  fee.status = buildFeeView(fee).status;
  return fee;
}

function normalizeWarden(entry, index, passwordHash) {
  const defaults = DEFAULT_ACCOUNTS.wardens[index] || DEFAULT_ACCOUNTS.wardens[0];
  const hostelType =
    entry.hostelType ||
    (entry.gender === "Female" ? HOSTEL_TYPES.GIRLS : defaults.hostelType);

  return {
    id: entry.id || defaults.id,
    name: entry.name || defaults.name,
    username: entry.username || defaults.username,
    role: ROLES.WARDEN,
    hostelType,
    gender:
      entry.gender || (hostelType === HOSTEL_TYPES.GIRLS ? "Female" : "Male"),
    passwordHash: entry.passwordHash || passwordHash,
    createdAt: entry.createdAt || nowIso()
  };
}

function normalizeStudentRecord(entry, index, passwordHash) {
  const fallback =
    DEFAULT_ACCOUNTS.students.find((student) => student.id === entry.id) ||
    DEFAULT_ACCOUNTS.students.find(
      (student) => student.enrollmentNumber === entry.enrollmentNumber
    ) ||
    DEFAULT_ACCOUNTS.students[index % DEFAULT_ACCOUNTS.students.length];
  const hostelType =
    entry.hostelType ||
    fallback.hostelType ||
    (index % 2 === 0 ? HOSTEL_TYPES.BOYS : HOSTEL_TYPES.GIRLS);

  return {
    id: entry.id || fallback.id || createId("student"),
    name: entry.name || fallback.name,
    enrollmentNumber:
      String(entry.enrollmentNumber || fallback.enrollmentNumber).trim().toUpperCase(),
    roomNumber: entry.roomNumber || fallback.roomNumber,
    floor: entry.floor || fallback.floor,
    contactNumber: entry.contactNumber || fallback.contactNumber,
    parentContactNumber: entry.parentContactNumber || fallback.parentContactNumber,
    location: entry.location || fallback.location,
    collegeName: entry.collegeName || fallback.collegeName,
    department: entry.department || fallback.department,
    academicYear: entry.academicYear || fallback.academicYear,
    hostelType,
    gender:
      entry.gender ||
      fallback.gender ||
      (hostelType === HOSTEL_TYPES.GIRLS ? "Female" : "Male"),
    role: ROLES.STUDENT,
    passwordHash: entry.passwordHash || passwordHash,
    qrToken:
      entry.qrToken ||
      createQrToken(String(entry.enrollmentNumber || fallback.enrollmentNumber).trim().toUpperCase()),
    status: entry.status || fallback.status || STATUS.IN,
    lastSeenAt: entry.lastSeenAt || nowIso(),
    createdAt: entry.createdAt || nowIso(),
    updatedAt: entry.updatedAt || nowIso()
  };
}

function normalizeFeeRecord(fee, student, index, now) {
  const fallback = buildInitialFeeRecord(student, index, now);
  const normalized = {
    ...fallback,
    ...fee,
    studentId: student.id,
    paymentRequests: Array.isArray(fee?.paymentRequests) ? fee.paymentRequests : [],
    reminders: Array.isArray(fee?.reminders) ? fee.reminders : [],
    ledger: Array.isArray(fee?.ledger) ? fee.ledger : []
  };

  const built = buildFeeView(normalized);
  return {
    ...normalized,
    pending: built.pending,
    status: built.status,
    dueDate: normalized.dueDate || fallback.dueDate,
    nextInstallmentDueDate:
      normalized.nextInstallmentDueDate === undefined
        ? fallback.nextInstallmentDueDate
        : normalized.nextInstallmentDueDate,
    lastUpdatedAt: normalized.lastUpdatedAt || nowIso()
  };
}

function normalizeComplaintRecord(complaint) {
  return {
    ...complaint,
    section: complaint.section || COMPLAINT_SECTIONS.GENERAL,
    evidenceImage: complaint.evidenceImage || null,
    evidenceName: complaint.evidenceName || null,
    resolutionNote: complaint.resolutionNote || ""
  };
}

function normalizeNotification(notification) {
  return {
    ...notification,
    recipientIds: Array.isArray(notification.recipientIds) ? notification.recipientIds : [],
    recipientRoles: Array.isArray(notification.recipientRoles)
      ? notification.recipientRoles
      : [],
    readBy: Array.isArray(notification.readBy) ? notification.readBy : []
  };
}

async function bootstrapData(store) {
  const defaultStudentPasswordHash = await bcrypt.hash(DEFAULT_ACCOUNTS.students[0].password, 10);
  const defaultAdminPasswordHash = await bcrypt.hash(DEFAULT_ACCOUNTS.admin.password, 10);
  const defaultWardenPasswordHashes = await Promise.all(
    DEFAULT_ACCOUNTS.wardens.map((warden) => bcrypt.hash(warden.password, 10))
  );

  await store.transact(Object.keys(COLLECTIONS), async (data) => {
    const now = new Date();
    const recently = addHours(now, -3);
    const sooner = addHours(now, -6);
    const dueSoon = addHours(now, 2);
    const overdueAt = addMinutes(now, -45);

    if (!data.admins.length) {
      data.admins = [
        {
          id: DEFAULT_ACCOUNTS.admin.id,
          name: DEFAULT_ACCOUNTS.admin.name,
          username: DEFAULT_ACCOUNTS.admin.username,
          role: ROLES.ADMIN,
          passwordHash: defaultAdminPasswordHash,
          createdAt: nowIso()
        }
      ];
    } else {
      data.admins = data.admins.map((admin) => ({
        ...admin,
        role: ROLES.ADMIN,
        passwordHash: admin.passwordHash || defaultAdminPasswordHash,
        createdAt: admin.createdAt || nowIso()
      }));
    }

    if (!data.wardens.length) {
      data.wardens = DEFAULT_ACCOUNTS.wardens.map((warden, index) =>
        normalizeWarden(warden, index, defaultWardenPasswordHashes[index])
      );
    } else {
      const normalizedWardens = data.wardens.map((warden, index) =>
        normalizeWarden(
          warden,
          index,
          defaultWardenPasswordHashes[index] || defaultWardenPasswordHashes[0]
        )
      );
      const hasBoysWarden = normalizedWardens.some(
        (warden) => warden.hostelType === HOSTEL_TYPES.BOYS
      );
      const hasGirlsWarden = normalizedWardens.some(
        (warden) => warden.hostelType === HOSTEL_TYPES.GIRLS
      );

      if (!hasBoysWarden) {
        normalizedWardens.push(
          normalizeWarden(DEFAULT_ACCOUNTS.wardens[0], 0, defaultWardenPasswordHashes[0])
        );
      }

      if (!hasGirlsWarden) {
        normalizedWardens.push(
          normalizeWarden(DEFAULT_ACCOUNTS.wardens[1], 1, defaultWardenPasswordHashes[1])
        );
      }

      data.wardens = normalizedWardens;
    }

    if (!data.students.length) {
      data.students = DEFAULT_ACCOUNTS.students.map((student) =>
        normalizeStudentRecord(student, 0, defaultStudentPasswordHash)
      );
    } else {
      data.students = data.students.map((student, index) =>
        normalizeStudentRecord(student, index, defaultStudentPasswordHash)
      );
    }

    if (!data.fees.length) {
      data.fees = data.students.map((student, index) =>
        buildInitialFeeRecord(student, index, now)
      );
    } else {
      data.fees = data.students.map((student, index) => {
        const existing = data.fees.find((fee) => fee.studentId === student.id);
        return normalizeFeeRecord(existing, student, index, now);
      });
    }

    if (!data.attendance.length) {
      data.attendance = data.students.map((student) => {
        const attendanceStatus = student.status === STATUS.OVERDUE ? "ABSENT" : "PRESENT";
        const records = buildAttendanceRecords(now, attendanceStatus);
        const presentDays = records.filter((record) => record.status !== "ABSENT").length;
        const absentDays = records.length - presentDays;
        return {
          studentId: student.id,
          percentage: Number(((presentDays / records.length) * 100).toFixed(1)),
          presentDays,
          absentDays,
          lateCount: student.status === STATUS.OUT ? 1 : 0,
          records
        };
      });
    }

    if (!data.movements.length) {
      data.movements = [
        {
          id: createId("movement"),
          studentId: "stu-002",
          purpose: "Home",
          status: "OPEN",
          mode: "MANUAL",
          exitTime: recently.toISOString(),
          expectedReturnTime: dueSoon.toISOString(),
          returnTime: null,
          note: "Family visit",
          createdAt: recently.toISOString(),
          updatedAt: recently.toISOString(),
          violationApplied: false,
          overdueAlertedAt: null
        },
        {
          id: createId("movement"),
          studentId: "stu-003",
          purpose: "Medical",
          status: "OVERDUE",
          mode: "MANUAL",
          exitTime: sooner.toISOString(),
          expectedReturnTime: overdueAt.toISOString(),
          returnTime: null,
          note: "Clinic visit",
          createdAt: sooner.toISOString(),
          updatedAt: sooner.toISOString(),
          violationApplied: true,
          overdueAlertedAt: overdueAt.toISOString()
        },
        {
          id: createId("movement"),
          studentId: "stu-001",
          purpose: "College",
          status: "CLOSED",
          mode: "QR",
          exitTime: addHours(now, -30).toISOString(),
          expectedReturnTime: addHours(now, -26).toISOString(),
          returnTime: addHours(now, -27).toISOString(),
          note: "Lab session",
          createdAt: addHours(now, -30).toISOString(),
          updatedAt: addHours(now, -27).toISOString(),
          violationApplied: false,
          overdueAlertedAt: null
        }
      ];
    } else {
      data.movements = data.movements.map((movement) => ({
        ...movement,
        overdueAlertedAt: movement.overdueAlertedAt || null
      }));
    }

    if (!data.complaints.length) {
      data.complaints = [
        {
          id: createId("complaint"),
          studentId: "stu-001",
          title: "Water leakage in washroom",
          description: "The second-floor washroom has a pipe leak near the sink.",
          category: "Maintenance",
          section: COMPLAINT_SECTIONS.GENERAL,
          status: COMPLAINT_STATUS.IN_PROGRESS,
          createdAt: addHours(now, -18).toISOString(),
          updatedAt: addHours(now, -6).toISOString(),
          resolutionNote: "",
          evidenceImage: null,
          evidenceName: null
        },
        {
          id: createId("complaint"),
          studentId: "stu-004",
          title: "Disturbance in corridor",
          description: "A senior student has been intimidating juniors near the study hall.",
          category: "Safety",
          section: COMPLAINT_SECTIONS.ANTI_RAGGING,
          status: COMPLAINT_STATUS.PENDING,
          createdAt: addHours(now, -8).toISOString(),
          updatedAt: addHours(now, -8).toISOString(),
          resolutionNote: "",
          evidenceImage: null,
          evidenceName: null
        }
      ];
    } else {
      data.complaints = data.complaints.map(normalizeComplaintRecord);
    }

    if (!data.notifications.length) {
      data.notifications = [
        {
          id: createId("notification"),
          title: "Weekly inspection",
          message: "Room inspection starts tomorrow at 10:00 AM.",
          type: NOTIFICATION_TYPES.GENERAL,
          audience: "ALL",
          recipientIds: [],
          recipientRoles: [ROLES.ADMIN, ROLES.WARDEN, ROLES.STUDENT],
          readBy: [],
          createdBy: DEFAULT_ACCOUNTS.admin.id,
          createdAt: addHours(now, -12).toISOString()
        },
        {
          id: createId("notification"),
          title: "Overdue alert",
          message: "Kabir Nair has crossed the expected return time.",
          type: NOTIFICATION_TYPES.EMERGENCY,
          audience: "SELECTED",
          recipientIds: [DEFAULT_ACCOUNTS.admin.id, DEFAULT_ACCOUNTS.wardens[0].id],
          recipientRoles: [],
          readBy: [],
          createdBy: DEFAULT_ACCOUNTS.wardens[0].id,
          createdAt: addMinutes(now, -40).toISOString()
        },
        {
          id: createId("notification"),
          title: "Mess feedback reminder",
          message: "Submit your lunch rating before 8 PM.",
          type: NOTIFICATION_TYPES.PERSONAL,
          audience: "SELECTED",
          recipientIds: ["stu-001", "stu-004"],
          recipientRoles: [],
          readBy: [],
          createdBy: DEFAULT_ACCOUNTS.admin.id,
          createdAt: addHours(now, -2).toISOString()
        }
      ];
    } else {
      data.notifications = data.notifications.map(normalizeNotification);
    }

    if (!data.messMenu.days.length) {
      data.messMenu = buildMessMenu();
    }

    if (!data.mealFeedback.length) {
      data.mealFeedback = [
        {
          id: createId("meal-feedback"),
          studentId: "stu-001",
          day: "Monday",
          mealType: "Lunch",
          rating: 4,
          feedback: "Paneer curry was good.",
          createdAt: addHours(now, -20).toISOString()
        },
        {
          id: createId("meal-feedback"),
          studentId: "stu-004",
          day: "Tuesday",
          mealType: "Dinner",
          rating: 5,
          feedback: "Well balanced and fresh.",
          createdAt: addHours(now, -10).toISOString()
        }
      ];
    }

    if (!data.mealLeaves.length) {
      data.mealLeaves = [
        {
          id: createId("meal-leave"),
          studentId: "stu-002",
          fromDate: dateKey(now),
          toDate: dateKey(addHours(now, 24)),
          reason: "Going home for one day",
          meals: ["Dinner"],
          status: "Approved",
          createdAt: addHours(now, -5).toISOString()
        }
      ];
    }

    if (!data.sosAlerts.length) {
      data.sosAlerts = [];
    }

    if (!data.config || typeof data.config !== "object") {
      data.config = COLLECTIONS.config.defaultValue;
    }

    const sampleFee = data.fees.find((fee) => fee.studentId === "stu-002");
    if (
      sampleFee &&
      !sampleFee.paymentRequests.some((request) => request.id === "seed-payment-request")
    ) {
      sampleFee.paymentRequests.push({
        id: "seed-payment-request",
        amount: 15000,
        installmentLabel: "Second Installment",
        receiptImage: null,
        receiptName: null,
        note: "Online transfer submitted for review.",
        status: PAYMENT_REVIEW_STATUS.SUBMITTED,
        submittedAt: addHours(now, -4).toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: "",
        confirmedAmount: 0
      });
      sampleFee.ledger.push({
        id: createId("fee"),
        type: "PAYMENT_SUBMITTED",
        amount: 15000,
        note: "Receipt uploaded for admin verification.",
        timestamp: addHours(now, -4).toISOString(),
        actorId: "stu-002",
        relatedPaymentId: "seed-payment-request"
      });
      sampleFee.lastUpdatedAt = nowIso();
      const rebuilt = buildFeeView(sampleFee);
      sampleFee.pending = rebuilt.pending;
      sampleFee.status = rebuilt.status;
    }
  });
}

module.exports = {
  bootstrapData,
  createId,
  createQrToken
};
