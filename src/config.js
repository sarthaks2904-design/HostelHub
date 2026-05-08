const path = require("node:path");

const ROOT_DIR = process.cwd();
const DATA_DIR = process.env.HOSTELHUB_DATA_DIR || path.join(ROOT_DIR, "data");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

const ROLES = Object.freeze({
  ADMIN: "ADMIN",
  WARDEN: "WARDEN",
  STUDENT: "STUDENT"
});

const HOSTEL_TYPES = Object.freeze({
  BOYS: "BOYS_HOSTEL",
  GIRLS: "GIRLS_HOSTEL"
});

const STATUS = Object.freeze({
  IN: "IN",
  OUT: "OUT",
  OVERDUE: "OVERDUE"
});

const COMPLAINT_STATUS = Object.freeze({
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved"
});

const COMPLAINT_SECTIONS = Object.freeze({
  GENERAL: "GENERAL",
  ANTI_RAGGING: "ANTI_RAGGING"
});

const NOTIFICATION_TYPES = Object.freeze({
  GENERAL: "GENERAL",
  EMERGENCY: "EMERGENCY",
  PERSONAL: "PERSONAL",
  SYSTEM: "SYSTEM"
});

const FEE_STATUS = Object.freeze({
  PAID: "Paid",
  PENDING: "Pending",
  FINE_CHARGES: "Fine Charges"
});

const PAYMENT_REVIEW_STATUS = Object.freeze({
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
});

const COLLECTIONS = Object.freeze({
  admins: { file: "admins.json", defaultValue: [] },
  wardens: { file: "wardens.json", defaultValue: [] },
  students: { file: "students.json", defaultValue: [] },
  fees: { file: "fees.json", defaultValue: [] },
  attendance: { file: "attendance.json", defaultValue: [] },
  movements: { file: "movements.json", defaultValue: [] },
  complaints: { file: "complaints.json", defaultValue: [] },
  notifications: { file: "notifications.json", defaultValue: [] },
  messMenu: { file: "mess-menu.json", defaultValue: { weekOf: "", days: [] } },
  mealFeedback: { file: "meal-feedback.json", defaultValue: [] },
  mealLeaves: { file: "meal-leaves.json", defaultValue: [] },
  sosAlerts: { file: "sos-alerts.json", defaultValue: [] },
  config: {
    file: "config.json",
    defaultValue: {
      curfewTime: "22:00",
      violationFine: 250,
      overdueGraceMinutes: 0,
      defaultExitHours: 4
    }
  }
});

const DEFAULT_ACCOUNTS = Object.freeze({
  admin: {
    id: "admin-root",
    name: "Hostel Administrator",
    username: "admin",
    role: ROLES.ADMIN,
    password: "Admin@123"
  },
  wardens: [
    {
      id: "warden-boys",
      name: "Male Warden",
      username: "warden",
      role: ROLES.WARDEN,
      hostelType: HOSTEL_TYPES.BOYS,
      gender: "Male",
      password: "Warden@123"
    },
    {
      id: "warden-girls",
      name: "Female Warden",
      username: "warden-girls",
      role: ROLES.WARDEN,
      hostelType: HOSTEL_TYPES.GIRLS,
      gender: "Female",
      password: "Warden@123"
    }
  ],
  students: [
    {
      id: "stu-001",
      name: "Aarav Sharma",
      enrollmentNumber: "ENR2026001",
      roomNumber: "A-101",
      floor: "1",
      contactNumber: "9876543201",
      parentContactNumber: "9876500101",
      location: "Lucknow",
      collegeName: "National Institute of Technology",
      department: "Computer Science Engineering",
      academicYear: "Third Year",
      hostelType: HOSTEL_TYPES.BOYS,
      gender: "Male",
      password: "Student@123",
      status: STATUS.IN
    },
    {
      id: "stu-002",
      name: "Ishita Verma",
      enrollmentNumber: "ENR2026002",
      roomNumber: "G-203",
      floor: "2",
      contactNumber: "9876543202",
      parentContactNumber: "9876500102",
      location: "Bhopal",
      collegeName: "State Engineering College",
      department: "Electronics and Communication",
      academicYear: "Second Year",
      hostelType: HOSTEL_TYPES.GIRLS,
      gender: "Female",
      password: "Student@123",
      status: STATUS.OUT
    },
    {
      id: "stu-003",
      name: "Kabir Nair",
      enrollmentNumber: "ENR2026003",
      roomNumber: "B-305",
      floor: "3",
      contactNumber: "9876543203",
      parentContactNumber: "9876500103",
      location: "Kochi",
      collegeName: "Institute of Technology",
      department: "Mechanical Engineering",
      academicYear: "Final Year",
      hostelType: HOSTEL_TYPES.BOYS,
      gender: "Male",
      password: "Student@123",
      status: STATUS.OVERDUE
    },
    {
      id: "stu-004",
      name: "Meera Patel",
      enrollmentNumber: "ENR2026004",
      roomNumber: "G-110",
      floor: "1",
      contactNumber: "9876543204",
      parentContactNumber: "9876500104",
      location: "Ahmedabad",
      collegeName: "University School of Engineering",
      department: "Civil Engineering",
      academicYear: "First Year",
      hostelType: HOSTEL_TYPES.GIRLS,
      gender: "Female",
      password: "Student@123",
      status: STATUS.IN
    }
  ]
});

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  PUBLIC_DIR,
  PORT: Number(process.env.PORT || 3000),
  JWT_SECRET: process.env.JWT_SECRET || "hostelhub-development-secret-change-me",
  JWT_COOKIE_NAME: "hostelhub_token",
  JWT_TTL: "12h",
  ROLES,
  HOSTEL_TYPES,
  STATUS,
  COMPLAINT_STATUS,
  COMPLAINT_SECTIONS,
  NOTIFICATION_TYPES,
  FEE_STATUS,
  PAYMENT_REVIEW_STATUS,
  COLLECTIONS,
  DEFAULT_ACCOUNTS,
  SCHEDULER_INTERVAL_MS: Number(process.env.SCHEDULER_INTERVAL_MS || 30000)
};
