import { api } from "./api.js";
import { connectSocket, disconnectSocket } from "./socket.js";
import { resetData, setState, state } from "./state.js";
import { renderApp, showToast } from "./ui.js";

const root = document.getElementById("root");
let refreshTimer = null;

function render() {
  renderApp(root, state);
}

function normalizeDateValue(value) {
  return value ? new Date(value).toISOString() : undefined;
}

function scheduleRefresh(delay = 500) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(async () => {
    if (!state.user) {
      return;
    }

    try {
      await hydrateApp();
    } catch (error) {
      showToast(error.message, "error");
    }
  }, delay);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read the selected image file."));
    reader.readAsDataURL(file);
  });
}

async function hydrateApp() {
  if (!state.user) {
    return;
  }

  const requests = [
    api.dashboard(),
    api.fees(),
    api.movements(),
    api.complaints(),
    api.notifications(),
    api.messMenu(),
    api.mealFeedback(),
    api.mealLeaves(),
    api.sos()
  ];

  if (state.user.role === "STUDENT") {
    requests.push(api.studentQr());
  } else {
    requests.push(api.students(), api.config());
  }

  const result = await Promise.all(requests);
  const commonState = {
    dashboard: result[0],
    fees: result[1],
    movements: result[2],
    complaints: result[3],
    notifications: result[4],
    menu: result[5],
    feedback: result[6],
    leaves: result[7],
    sos: result[8]
  };

  if (state.user.role === "STUDENT") {
    setState({
      ...commonState,
      qr: result[9],
      students: [],
      studentProfile: null,
      selectedStudentId: null,
      selectedFeeStudentId: result[1][0]?.student?.id || null,
      config: null
    });
    render();
    return;
  }

  const students = result[9];
  const config = result[10];
  let selectedStudentId = state.selectedStudentId;
  if (!students.some((student) => student.id === selectedStudentId)) {
    selectedStudentId = students[0]?.id || null;
  }

  let selectedFeeStudentId = state.selectedFeeStudentId;
  if (!result[1].some((fee) => fee.student.id === selectedFeeStudentId)) {
    selectedFeeStudentId = result[1][0]?.student?.id || null;
  }

  let studentProfile = null;
  if (selectedStudentId) {
    studentProfile = await api.studentProfile(selectedStudentId);
  }

  setState({
    ...commonState,
    students,
    studentProfile,
    selectedStudentId,
    selectedFeeStudentId,
    config,
    qr: null
  });
  render();
}

function attachRealtime() {
  connectSocket((event, payload) => {
    if (event === "session:ready") {
      return;
    }

    if (event === "notification:created") {
      showToast(payload.title || "New notification", payload.type === "EMERGENCY" ? "error" : "info");
    } else if (event === "alert:overdue") {
      showToast("Overdue alert updated for hostel staff.", "error");
    } else if (event === "sos:created") {
      showToast("Emergency SOS alert received.", "error");
    } else if (event === "movement:created" || event === "movement:updated") {
      showToast("Entry and exit log updated.", "success");
    } else if (event === "student:status") {
      showToast("Student status changed in real time.", "success");
    } else if (event === "fee:updated") {
      showToast("Fee record updated.", "success");
    } else if (event === "complaint:created" || event === "complaint:updated") {
      showToast("Complaint data updated.", "info");
    }

    scheduleRefresh(400);
  });
}

async function startSession(user) {
  setState({
    user,
    currentPage: "dashboard",
    selectedStudentId: null,
    selectedFeeStudentId: null,
    studentProfile: null
  });
  render();
  attachRealtime();
  await hydrateApp();
}

async function endSession() {
  disconnectSocket();
  resetData();
  setState({
    user: null,
    currentPage: "dashboard"
  });
  render();
}

function collectMenuDays(form) {
  const formData = new FormData(form);
  const days = [];
  for (let index = 0; index < 7; index += 1) {
    days.push({
      day: formData.get(`day-${index}`),
      breakfast: formData.get(`breakfast-${index}`),
      lunch: formData.get(`lunch-${index}`),
      snacks: formData.get(`snacks-${index}`),
      dinner: formData.get(`dinner-${index}`)
    });
  }

  return days;
}

async function createComplaintPayload(formData) {
  const file = formData.get("evidenceImage");
  const evidenceImage = file instanceof File && file.size > 0 ? await fileToDataUrl(file) : null;
  return {
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description"),
    section: formData.get("section"),
    evidenceImage,
    evidenceName: file instanceof File && file.size > 0 ? file.name : null
  };
}

async function handleFormSubmission(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) {
    return;
  }

  event.preventDefault();
  const formType = form.dataset.form;
  const formData = new FormData(form);

  try {
    if (formType === "login") {
      const result = await api.login({
        role: formData.get("role"),
        identifier: formData.get("identifier"),
        password: formData.get("password")
      });
      showToast("Login successful.", "success");
      await startSession(result.user);
      return;
    }

    if (formType === "register") {
      const result = await api.register({
        name: formData.get("name"),
        enrollmentNumber: formData.get("enrollmentNumber"),
        roomNumber: formData.get("roomNumber"),
        floor: formData.get("floor"),
        contactNumber: formData.get("contactNumber"),
        parentContactNumber: formData.get("parentContactNumber"),
        location: formData.get("location"),
        collegeName: formData.get("collegeName"),
        department: formData.get("department"),
        academicYear: formData.get("academicYear"),
        hostelType: formData.get("hostelType"),
        password: formData.get("password")
      });
      showToast("Student account created.", "success");
      await startSession(result.user);
      return;
    }

    if (formType === "exit-request") {
      await api.createExit({
        purpose: formData.get("purpose"),
        expectedReturnTime: normalizeDateValue(formData.get("expectedReturnTime")),
        note: formData.get("note")
      });
      showToast("Exit request recorded.", "success");
    } else if (formType === "fee-payment") {
      const file = formData.get("receiptImage");
      await api.submitFeePayment({
        amount: Number(formData.get("amount")),
        installmentLabel: formData.get("installmentLabel"),
        note: formData.get("note"),
        receiptImage: await fileToDataUrl(file),
        receiptName: file instanceof File ? file.name : null
      });
      showToast("Payment receipt submitted for admin review.", "success");
    } else if (formType === "new-complaint" || formType === "anti-ragging-complaint") {
      await api.createComplaint(await createComplaintPayload(formData));
      showToast("Complaint submitted.", "success");
    } else if (formType === "meal-feedback") {
      await api.submitMealFeedback({
        day: formData.get("day"),
        mealType: formData.get("mealType"),
        rating: Number(formData.get("rating")),
        feedback: formData.get("feedback")
      });
      showToast("Meal feedback submitted.", "success");
    } else if (formType === "meal-leave") {
      await api.applyMealLeave({
        fromDate: formData.get("fromDate"),
        toDate: formData.get("toDate"),
        reason: formData.get("reason"),
        meals: formData.getAll("meals")
      });
      showToast("Meal leave application submitted.", "success");
    } else if (formType === "sos") {
      await api.triggerSos({
        message: formData.get("message")
      });
      showToast("SOS alert sent.", "error");
    } else if (formType === "scan-qr") {
      await api.scanQr({
        qrToken: formData.get("qrToken"),
        purpose: formData.get("purpose"),
        expectedReturnTime: normalizeDateValue(formData.get("expectedReturnTime"))
      });
      showToast("QR scan processed.", "success");
    } else if (formType === "staff-return") {
      await api.markReturn({
        studentId: formData.get("studentId")
      });
      showToast("Return marked successfully.", "success");
    } else if (formType === "complaint-status") {
      await api.updateComplaint(form.dataset.id, {
        status: formData.get("status"),
        resolutionNote: formData.get("resolutionNote")
      });
      showToast("Complaint status updated.", "success");
    } else if (formType === "send-notification") {
      const audience = formData.get("audience");
      const recipientId = formData.get("recipientId");
      await api.createNotification({
        title: formData.get("title"),
        type: formData.get("type"),
        audience,
        recipientIds: audience === "SELECTED" && recipientId ? [recipientId] : [],
        message: formData.get("message")
      });
      showToast("Notification sent.", "success");
    } else if (formType === "menu-update") {
      await api.updateMessMenu({
        weekOf: state.menu?.weekOf,
        days: collectMenuDays(form)
      });
      showToast("Mess menu updated.", "success");
    } else if (formType === "config-update") {
      await api.updateConfig({
        curfewTime: formData.get("curfewTime"),
        violationFine: Number(formData.get("violationFine")),
        overdueGraceMinutes: Number(formData.get("overdueGraceMinutes")),
        defaultExitHours: Number(formData.get("defaultExitHours"))
      });
      showToast("Hostel settings updated.", "success");
    } else if (formType === "payment-review") {
      await api.reviewFeePayment(form.dataset.studentId, form.dataset.paymentId, {
        action: formData.get("action"),
        confirmedAmount: Number(formData.get("confirmedAmount")),
        nextInstallmentDueDate: formData.get("nextInstallmentDueDate") || undefined,
        dueDate: formData.get("dueDate") || undefined,
        reviewNote: formData.get("reviewNote")
      });
      showToast("Payment review submitted.", "success");
    } else if (formType === "fee-update") {
      await api.updateFeeRecord(form.dataset.studentId, {
        total: formData.get("total"),
        paid: formData.get("paid"),
        pending: formData.get("pending"),
        manualFineDelta: formData.get("manualFineDelta"),
        dueDate: formData.get("dueDate") || null,
        nextInstallmentDueDate: formData.get("nextInstallmentDueDate") || null,
        note: formData.get("note"),
        notificationMessage: formData.get("notificationMessage")
      });
      showToast("Fee record updated.", "success");
    } else if (formType === "fee-reminder") {
      await api.sendFeeReminder(form.dataset.studentId, {
        message: formData.get("message"),
        dueDate: formData.get("dueDate") || null
      });
      showToast("Fee reminder sent.", "success");
    }

    form.reset();
    await hydrateApp();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function handleClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }

  const action = actionTarget.dataset.action;

  try {
    if (action === "navigate") {
      setState({ currentPage: actionTarget.dataset.page });
      render();
      return;
    }

    if (action === "logout") {
      await api.logout();
      await endSession();
      showToast("Logged out.", "success");
      return;
    }

    if (action === "return-self") {
      await api.markReturn({});
      showToast("Return marked.", "success");
      await hydrateApp();
      return;
    }

    if (action === "mark-notification-read") {
      await api.markNotificationRead(actionTarget.dataset.id);
      await hydrateApp();
      return;
    }

    if (action === "resolve-sos") {
      await api.resolveSos(actionTarget.dataset.id);
      showToast("SOS alert resolved.", "success");
      await hydrateApp();
      return;
    }

    if (action === "open-student-profile") {
      const studentId = actionTarget.dataset.id;
      const profile = await api.studentProfile(studentId);
      setState({ selectedStudentId: studentId, studentProfile: profile, currentPage: "students" });
      render();
      return;
    }

    if (action === "select-fee-record") {
      setState({ selectedFeeStudentId: actionTarget.dataset.id, currentPage: "fees" });
      render();
    }
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function bootstrap() {
  render();

  try {
    const session = await api.me();
    await startSession(session.user);
  } catch {
    await endSession();
  }
}

document.addEventListener("submit", handleFormSubmission);
document.addEventListener("click", handleClick);

bootstrap();
