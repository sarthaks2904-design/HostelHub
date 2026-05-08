export const state = {
  user: null,
  currentPage: "dashboard",
  dashboard: null,
  students: [],
  studentProfile: null,
  selectedStudentId: null,
  fees: [],
  selectedFeeStudentId: null,
  movements: [],
  complaints: [],
  notifications: [],
  menu: null,
  feedback: [],
  leaves: [],
  sos: [],
  config: null,
  qr: null,
  loading: false
};

export function setState(patch) {
  Object.assign(state, patch);
}

export function resetData() {
  state.dashboard = null;
  state.students = [];
  state.studentProfile = null;
  state.selectedStudentId = null;
  state.fees = [];
  state.selectedFeeStudentId = null;
  state.movements = [];
  state.complaints = [];
  state.notifications = [];
  state.menu = null;
  state.feedback = [];
  state.leaves = [];
  state.sos = [];
  state.config = null;
  state.qr = null;
}

export function isStudent() {
  return state.user?.role === "STUDENT";
}

export function isStaff() {
  return state.user?.role === "ADMIN" || state.user?.role === "WARDEN";
}
