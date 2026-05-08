const bcrypt = require("bcrypt");
const {
  FEE_STATUS,
  HOSTEL_TYPES,
  JWT_COOKIE_NAME,
  ROLES,
  STATUS
} = require("../config");
const { createQrToken, createId } = require("../storage/seed");
const { signToken, verifyToken } = require("../utils/token");
const { addDays, nowIso } = require("../utils/time");
const { sanitizeStudent, sanitizeUser } = require("../utils/domain");

class AuthService {
  constructor(store) {
    this.store = store;
  }

  async authenticate({ role, identifier, password }) {
    if (!role || !identifier || !password) {
      throw new Error("Role, identifier, and password are required.");
    }

    const normalizedRole = String(role).toUpperCase();
    const normalizedIdentifier = String(identifier).trim();
    const snapshot = await this.store.readMany(["admins", "wardens", "students"]);
    let user;

    if (normalizedRole === ROLES.ADMIN) {
      user = snapshot.admins.find(
        (entry) => String(entry.username).toLowerCase() === normalizedIdentifier.toLowerCase()
      );
    } else if (normalizedRole === ROLES.WARDEN) {
      user = snapshot.wardens.find(
        (entry) => String(entry.username).toLowerCase() === normalizedIdentifier.toLowerCase()
      );
    } else if (normalizedRole === ROLES.STUDENT) {
      user = snapshot.students.find(
        (entry) =>
          String(entry.enrollmentNumber).toLowerCase() === normalizedIdentifier.toLowerCase()
      );
    } else {
      throw new Error("Unsupported role.");
    }

    if (!user) {
      throw new Error("Invalid credentials.");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new Error("Invalid credentials.");
    }

    const publicUser = normalizedRole === ROLES.STUDENT ? sanitizeStudent(user) : sanitizeUser(user);
    const token = signToken({
      sub: user.id,
      role: user.role,
      name: user.name
    });

    return {
      token,
      user: publicUser
    };
  }

  async registerStudent(payload) {
    const requiredFields = [
      "name",
      "enrollmentNumber",
      "password",
      "roomNumber",
      "floor",
      "contactNumber",
      "parentContactNumber",
      "location",
      "collegeName",
      "department",
      "academicYear",
      "hostelType"
    ];
    const missingField = requiredFields.find((field) => !String(payload[field] || "").trim());
    if (missingField) {
      throw new Error("All registration fields are required.");
    }

    if (String(payload.password).length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    if (
      ![HOSTEL_TYPES.BOYS, HOSTEL_TYPES.GIRLS].includes(String(payload.hostelType).trim())
    ) {
      throw new Error("Invalid hostel type selected.");
    }

    const createdAt = nowIso();
    const enrollmentNumber = String(payload.enrollmentNumber).trim().toUpperCase();
    const hostelType = String(payload.hostelType).trim();
    const passwordHash = await bcrypt.hash(payload.password, 10);

    const student = await this.store.transact(
      ["students", "fees", "attendance", "notifications"],
      async (data) => {
        const existing = data.students.find(
          (entry) => entry.enrollmentNumber.toLowerCase() === enrollmentNumber.toLowerCase()
        );

        if (existing) {
          throw new Error("Enrollment number is already registered.");
        }

        const newStudent = {
          id: createId("student"),
          role: ROLES.STUDENT,
          name: String(payload.name).trim(),
          enrollmentNumber,
          roomNumber: String(payload.roomNumber).trim(),
          floor: String(payload.floor).trim(),
          contactNumber: String(payload.contactNumber).trim(),
          parentContactNumber: String(payload.parentContactNumber).trim(),
          location: String(payload.location).trim(),
          collegeName: String(payload.collegeName).trim(),
          department: String(payload.department).trim(),
          academicYear: String(payload.academicYear).trim(),
          hostelType,
          gender: hostelType === HOSTEL_TYPES.GIRLS ? "Female" : "Male",
          passwordHash,
          qrToken: createQrToken(enrollmentNumber),
          status: STATUS.IN,
          lastSeenAt: createdAt,
          createdAt,
          updatedAt: createdAt
        };

        data.students.push(newStudent);
        data.fees.push({
          studentId: newStudent.id,
          total: 60000,
          paid: 0,
          pending: 60000,
          fine: 0,
          status: FEE_STATUS.PENDING,
          dueDate: addDays(createdAt, 21).toISOString(),
          nextInstallmentDueDate: addDays(createdAt, 45).toISOString(),
          violationCount: 0,
          paymentRequests: [],
          reminders: [],
          ledger: [],
          lastUpdatedAt: createdAt
        });
        data.attendance.push({
          studentId: newStudent.id,
          percentage: 100,
          presentDays: 0,
          absentDays: 0,
          lateCount: 0,
          records: []
        });
        data.notifications.push({
          id: createId("notification"),
          title: "Welcome to HostelHub",
          message:
            "Your hostel account is ready. Check your dashboard for fee updates, movements, and complaints.",
          type: "SYSTEM",
          audience: "SELECTED",
          recipientIds: [newStudent.id],
          recipientRoles: [],
          readBy: [],
          createdBy: "system",
          createdAt
        });

        return newStudent;
      }
    );

    const publicUser = sanitizeStudent(student);
    return {
      token: signToken({
        sub: student.id,
        role: student.role,
        name: student.name
      }),
      user: publicUser
    };
  }

  async getUserById(userId, roleHint) {
    const snapshot = await this.store.readMany(["admins", "wardens", "students"]);
    const role = roleHint ? String(roleHint).toUpperCase() : null;

    if (!role || role === ROLES.ADMIN) {
      const admin = snapshot.admins.find((entry) => entry.id === userId);
      if (admin) {
        return sanitizeUser(admin);
      }
    }

    if (!role || role === ROLES.WARDEN) {
      const warden = snapshot.wardens.find((entry) => entry.id === userId);
      if (warden) {
        return sanitizeUser(warden);
      }
    }

    if (!role || role === ROLES.STUDENT) {
      const student = snapshot.students.find((entry) => entry.id === userId);
      if (student) {
        return sanitizeStudent(student);
      }
    }

    return null;
  }

  async resolveToken(token) {
    const payload = verifyToken(token);
    const user = await this.getUserById(payload.sub, payload.role);

    if (!user) {
      throw new Error("Session is no longer valid.");
    }

    return user;
  }

  async resolveRequestUser(req) {
    const token = req.cookies?.[JWT_COOKIE_NAME] || null;
    if (!token) {
      return null;
    }

    return this.resolveToken(token);
  }

  async resolveSocketUser(rawCookieHeader) {
    const cookiePairs = String(rawCookieHeader || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);
    const cookieMap = Object.fromEntries(
      cookiePairs.map((pair) => {
        const separatorIndex = pair.indexOf("=");
        return [pair.slice(0, separatorIndex), decodeURIComponent(pair.slice(separatorIndex + 1))];
      })
    );
    const token = cookieMap[JWT_COOKIE_NAME];
    if (!token) {
      throw new Error("Missing authentication token.");
    }

    return this.resolveToken(token);
  }
}

module.exports = {
  AuthService
};
