const { COMPLAINT_SECTIONS, COMPLAINT_STATUS, HOSTEL_TYPES, ROLES, STATUS } = require("../config");
const {
  buildFeeView,
  filterStudentsByScope,
  getOpenMovement,
  groupStudentsByHostel,
  mapNotificationForUser,
  notificationVisibleToUser,
  sanitizeStudent,
  sortDescending,
  statusColor,
  userCanAccessStudent
} = require("../utils/domain");

class DashboardService {
  buildStudentDashboard(snapshot, studentId) {
    const student = snapshot.students.find((entry) => entry.id === studentId);
    if (!student) {
      throw new Error("Student not found.");
    }

    const fee = buildFeeView(snapshot.fees.find((entry) => entry.studentId === studentId) || null);
    const attendance = snapshot.attendance.find((entry) => entry.studentId === studentId) || null;
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
        .filter((entry) =>
          notificationVisibleToUser(entry, { id: studentId, role: ROLES.STUDENT })
        )
        .map((entry) => mapNotificationForUser(entry, studentId)),
      "createdAt"
    );
    const mealFeedback = sortDescending(
      snapshot.mealFeedback.filter((entry) => entry.studentId === studentId),
      "createdAt"
    );
    const mealLeaves = sortDescending(
      snapshot.mealLeaves.filter((entry) => entry.studentId === studentId),
      "createdAt"
    );
    const openMovement = getOpenMovement(snapshot.movements, studentId);
    const generalComplaints = complaints.filter(
      (complaint) => complaint.section !== COMPLAINT_SECTIONS.ANTI_RAGGING
    );
    const antiRaggingComplaints = complaints.filter(
      (complaint) => complaint.section === COMPLAINT_SECTIONS.ANTI_RAGGING
    );

    return {
      profile: sanitizeStudent(student),
      fee,
      attendance,
      currentStatus: {
        value: student.status,
        color: statusColor(student.status),
        openMovement
      },
      movements: movements.slice(0, 12),
      complaints: generalComplaints,
      antiRaggingComplaints,
      notifications: notifications.slice(0, 15),
      mess: {
        menu: snapshot.messMenu,
        feedback: mealFeedback.slice(0, 8),
        leaves: mealLeaves
      },
      metrics: {
        unreadNotifications: notifications.filter((entry) => !entry.read).length,
        activeComplaints: generalComplaints.filter(
          (entry) => entry.status !== COMPLAINT_STATUS.RESOLVED
        ).length,
        antiRaggingCases: antiRaggingComplaints.filter(
          (entry) => entry.status !== COMPLAINT_STATUS.RESOLVED
        ).length,
        currentStatus: student.status,
        pendingPaymentReviews: (fee?.paymentRequests || []).filter(
          (request) => request.status === "SUBMITTED"
        ).length
      }
    };
  }

  buildStaffDashboard(snapshot, user) {
    const visibleStudents = filterStudentsByScope(user, snapshot.students);
    const visibleStudentIds = new Set(visibleStudents.map((student) => student.id));
    const visibleMovements = snapshot.movements.filter((movement) =>
      visibleStudentIds.has(movement.studentId)
    );
    const visibleComplaints = snapshot.complaints.filter((complaint) =>
      visibleStudentIds.has(complaint.studentId)
    );
    const visibleSosAlerts = snapshot.sosAlerts.filter((alert) =>
      visibleStudentIds.has(alert.studentId)
    );
    const visibleFees = visibleStudents.map((student) => {
      const fee = snapshot.fees.find((entry) => entry.studentId === student.id);
      return {
        student,
        fee: buildFeeView(fee || null)
      };
    });

    const students = visibleFees.map(({ student, fee }) => ({
      ...sanitizeStudent(student),
      feeStatus: fee?.status || "Pending",
      feePending: fee?.pending || 0,
      fine: fee?.fine || 0,
      nextInstallmentDueDate: fee?.nextInstallmentDueDate || null,
      dueDate: fee?.dueDate || null,
      openMovement: getOpenMovement(visibleMovements, student.id)
    }));

    const statusCounts = {
      total: students.length,
      in: students.filter((entry) => entry.status === STATUS.IN).length,
      out: students.filter((entry) => entry.status === STATUS.OUT).length,
      overdue: students.filter((entry) => entry.status === STATUS.OVERDUE).length
    };

    const overdueTrendMap = new Map();
    visibleMovements.forEach((movement) => {
      if (movement.status === "OVERDUE" || movement.violationApplied) {
        const key = String(movement.expectedReturnTime || movement.updatedAt).slice(0, 10);
        overdueTrendMap.set(key, (overdueTrendMap.get(key) || 0) + 1);
      }
    });

    const totalFees = visibleFees.reduce(
      (accumulator, entry) => {
        const fee = entry.fee;
        if (!fee) {
          return accumulator;
        }

        accumulator.total += Number(fee.total || 0);
        accumulator.paid += Number(fee.paid || 0);
        accumulator.fine += Number(fee.fine || 0);
        accumulator.pending += Number(fee.pending || 0);
        accumulator.pendingApprovals += fee.paymentRequests.filter(
          (request) => request.status === "SUBMITTED"
        ).length;
        return accumulator;
      },
      { total: 0, paid: 0, pending: 0, fine: 0, pendingApprovals: 0 }
    );

    const visibleNotifications = sortDescending(
      snapshot.notifications
        .filter((entry) => notificationVisibleToUser(entry, user))
        .map((entry) => mapNotificationForUser(entry, user.id)),
      "createdAt"
    );

    const averageRating =
      snapshot.mealFeedback.length === 0
        ? 0
        : Number(
            (
              snapshot.mealFeedback.reduce(
                (accumulator, feedback) => accumulator + Number(feedback.rating || 0),
                0
              ) / snapshot.mealFeedback.length
            ).toFixed(2)
          );

    const groupedHostels = groupStudentsByHostel(students);
    const recentGeneralComplaints = sortDescending(
      visibleComplaints.filter((complaint) => complaint.section !== COMPLAINT_SECTIONS.ANTI_RAGGING),
      "updatedAt"
    ).slice(0, 10);
    const antiRaggingCases = sortDescending(
      visibleComplaints.filter((complaint) => complaint.section === COMPLAINT_SECTIONS.ANTI_RAGGING),
      "updatedAt"
    );

    return {
      metrics: statusCounts,
      students: sortDescending(students, "updatedAt"),
      studentSections: {
        boys: groupedHostels.boys,
        girls: groupedHostels.girls,
        visibleHostel:
          user.role === ROLES.WARDEN
            ? user.hostelType
            : null
      },
      overdueStudents: students.filter((entry) => entry.status === STATUS.OVERDUE),
      recentMovements: sortDescending(visibleMovements, "updatedAt").slice(0, 20),
      complaintSummary: {
        total: visibleComplaints.length,
        general: recentGeneralComplaints,
        antiRagging: antiRaggingCases,
        byStatus: {
          [COMPLAINT_STATUS.PENDING]: visibleComplaints.filter(
            (entry) => entry.status === COMPLAINT_STATUS.PENDING
          ).length,
          [COMPLAINT_STATUS.IN_PROGRESS]: visibleComplaints.filter(
            (entry) => entry.status === COMPLAINT_STATUS.IN_PROGRESS
          ).length,
          [COMPLAINT_STATUS.RESOLVED]: visibleComplaints.filter(
            (entry) => entry.status === COMPLAINT_STATUS.RESOLVED
          ).length
        }
      },
      feeSummary: {
        ...totalFees,
        defaulters: students
          .filter((entry) => entry.feePending > 0)
          .sort((left, right) => right.feePending - left.feePending)
          .slice(0, 10),
        paymentReviewQueue: visibleFees
          .flatMap(({ student, fee }) =>
            (fee?.paymentRequests || [])
              .filter((request) => request.status === "SUBMITTED")
              .map((request) => ({
                ...request,
                student: sanitizeStudent(student),
                feeStatus: fee.status
              }))
          )
          .sort((left, right) => new Date(right.submittedAt) - new Date(left.submittedAt))
      },
      messAnalytics: {
        averageRating,
        totalFeedback: snapshot.mealFeedback.length,
        feedback: sortDescending(snapshot.mealFeedback, "createdAt").slice(0, 10),
        mealLeaves: sortDescending(snapshot.mealLeaves, "createdAt").slice(0, 10)
      },
      overdueTrends: [...overdueTrendMap.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((left, right) => new Date(left.date) - new Date(right.date))
        .slice(-7),
      notifications: visibleNotifications.slice(0, 15),
      sosAlerts: sortDescending(
        visibleSosAlerts
          .map((alert) => ({
            ...alert,
            student: sanitizeStudent(
              visibleStudents.find((student) => student.id === alert.studentId)
            )
          }))
          .filter((alert) => userCanAccessStudent(user, alert.student)),
        "createdAt"
      ),
      config: snapshot.config,
      hostelScope:
        user.role === ROLES.ADMIN
          ? "ALL_HOSTELS"
          : user.hostelType || HOSTEL_TYPES.BOYS
    };
  }
}

module.exports = {
  DashboardService
};
