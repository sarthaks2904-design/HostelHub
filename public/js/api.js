async function request(path, options = {}) {
  const config = {
    method: options.method || "GET",
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  };

  if (options.body !== undefined) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, config);
  const data = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "Request failed.");
  }

  return data;
}

export const api = {
  me: () => request("/api/auth/me"),
  login: (payload) => request("/api/auth/login", { method: "POST", body: payload }),
  register: (payload) => request("/api/auth/register", { method: "POST", body: payload }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  dashboard: () => request("/api/dashboard"),
  students: () => request("/api/students"),
  studentProfile: (id) => request(`/api/students/${id}/profile`),
  studentQr: () => request("/api/students/me/qr"),
  fees: () => request("/api/fees"),
  submitFeePayment: (payload) => request("/api/fees/me/payments", { method: "POST", body: payload }),
  reviewFeePayment: (studentId, paymentId, payload) =>
    request(`/api/fees/${studentId}/payments/${paymentId}`, {
      method: "PATCH",
      body: payload
    }),
  updateFeeRecord: (studentId, payload) =>
    request(`/api/fees/${studentId}`, { method: "PATCH", body: payload }),
  sendFeeReminder: (studentId, payload) =>
    request(`/api/fees/${studentId}/reminders`, { method: "POST", body: payload }),
  movements: () => request("/api/movements"),
  createExit: (payload) => request("/api/movements/exit", { method: "POST", body: payload }),
  markReturn: (payload) => request("/api/movements/return", { method: "POST", body: payload }),
  scanQr: (payload) => request("/api/movements/scan", { method: "POST", body: payload }),
  complaints: (section) =>
    request(section ? `/api/complaints?section=${encodeURIComponent(section)}` : "/api/complaints"),
  createComplaint: (payload) => request("/api/complaints", { method: "POST", body: payload }),
  updateComplaint: (id, payload) =>
    request(`/api/complaints/${id}`, { method: "PATCH", body: payload }),
  notifications: () => request("/api/notifications"),
  createNotification: (payload) =>
    request("/api/notifications", { method: "POST", body: payload }),
  markNotificationRead: (id) =>
    request(`/api/notifications/${id}/read`, { method: "PATCH" }),
  messMenu: () => request("/api/mess/menu"),
  updateMessMenu: (payload) => request("/api/mess/menu", { method: "PUT", body: payload }),
  mealFeedback: () => request("/api/mess/feedback"),
  submitMealFeedback: (payload) =>
    request("/api/mess/feedback", { method: "POST", body: payload }),
  mealLeaves: () => request("/api/mess/leaves"),
  applyMealLeave: (payload) => request("/api/mess/leaves", { method: "POST", body: payload }),
  sos: () => request("/api/sos"),
  triggerSos: (payload) => request("/api/sos", { method: "POST", body: payload }),
  resolveSos: (id) => request(`/api/sos/${id}/resolve`, { method: "PATCH" }),
  config: () => request("/api/config"),
  updateConfig: (payload) => request("/api/config", { method: "PUT", body: payload })
};
