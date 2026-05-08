const { FEE_STATUS, HOSTEL_TYPES, ROLES, STATUS } = require("../config");

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const clone = { ...user };
  delete clone.passwordHash;
  return clone;
}

function sanitizeStudent(student) {
  const publicStudent = sanitizeUser(student);
  if (!publicStudent) {
    return null;
  }

  return {
    id: publicStudent.id,
    name: publicStudent.name,
    enrollmentNumber: publicStudent.enrollmentNumber,
    roomNumber: publicStudent.roomNumber,
    floor: publicStudent.floor,
    contactNumber: publicStudent.contactNumber || "",
    parentContactNumber: publicStudent.parentContactNumber || "",
    location: publicStudent.location || "",
    collegeName: publicStudent.collegeName || "",
    department: publicStudent.department || "",
    academicYear: publicStudent.academicYear || "",
    hostelType: publicStudent.hostelType || HOSTEL_TYPES.BOYS,
    gender: publicStudent.gender || "",
    role: ROLES.STUDENT,
    status: publicStudent.status,
    lastSeenAt: publicStudent.lastSeenAt,
    createdAt: publicStudent.createdAt,
    updatedAt: publicStudent.updatedAt
  };
}

function sortDescending(items, key = "createdAt") {
  return [...items].sort((left, right) => {
    const leftValue = new Date(left[key] || 0).getTime();
    const rightValue = new Date(right[key] || 0).getTime();
    return rightValue - leftValue;
  });
}

function getOpenMovement(movements, studentId) {
  return sortDescending(
    movements.filter(
      (movement) =>
        movement.studentId === studentId &&
        movement.returnTime === null &&
        ["OPEN", "OVERDUE"].includes(movement.status)
    ),
    "exitTime"
  )[0] || null;
}

function calculatePending(total, paid, fine) {
  return Math.max(0, Number(total || 0) - Number(paid || 0) + Number(fine || 0));
}

function determineFeeStatus(fee) {
  const pending = calculatePending(fee.total, fee.paid, fee.fine);
  if (pending <= 0) {
    return FEE_STATUS.PAID;
  }

  if (Number(fee.fine || 0) > 0) {
    return FEE_STATUS.FINE_CHARGES;
  }

  return FEE_STATUS.PENDING;
}

function buildFeeView(fee) {
  if (!fee) {
    return null;
  }

  const pending = calculatePending(fee.total, fee.paid, fee.fine);
  return {
    ...fee,
    pending,
    status: determineFeeStatus(fee),
    nextInstallmentDueDate: fee.nextInstallmentDueDate || null,
    dueDate: fee.dueDate || null,
    paymentRequests: sortDescending(fee.paymentRequests || [], "submittedAt"),
    reminders: sortDescending(fee.reminders || [], "createdAt"),
    ledger: sortDescending(fee.ledger || [], "timestamp")
  };
}

function notificationVisibleToUser(notification, user) {
  if (!notification || !user) {
    return false;
  }

  if (notification.audience === "ALL") {
    return true;
  }

  if ((notification.recipientIds || []).includes(user.id)) {
    return true;
  }

  if ((notification.recipientRoles || []).includes(user.role)) {
    return true;
  }

  return false;
}

function mapNotificationForUser(notification, userId) {
  return {
    ...notification,
    read: (notification.readBy || []).some((entry) => entry.userId === userId)
  };
}

function statusColor(status) {
  if (status === STATUS.IN) {
    return "green";
  }

  if (status === STATUS.OUT) {
    return "yellow";
  }

  return "red";
}

function userCanAccessStudent(user, student) {
  if (!user || !student) {
    return false;
  }

  if (user.role === ROLES.ADMIN) {
    return true;
  }

  if (user.role === ROLES.WARDEN) {
    if (!user.hostelType) {
      return true;
    }

    return user.hostelType === student.hostelType;
  }

  return user.role === ROLES.STUDENT && user.id === student.id;
}

function filterStudentsByScope(user, students) {
  return students.filter((student) => userCanAccessStudent(user, student));
}

function groupStudentsByHostel(students) {
  return {
    boys: students.filter((student) => student.hostelType === HOSTEL_TYPES.BOYS),
    girls: students.filter((student) => student.hostelType === HOSTEL_TYPES.GIRLS)
  };
}

module.exports = {
  sanitizeUser,
  sanitizeStudent,
  sortDescending,
  getOpenMovement,
  calculatePending,
  determineFeeStatus,
  buildFeeView,
  notificationVisibleToUser,
  mapNotificationForUser,
  statusColor,
  userCanAccessStudent,
  filterStudentsByScope,
  groupStudentsByHostel
};
