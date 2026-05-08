const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createServer } = require("../src/app");

async function createHarness() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "hostelhub-"));
  const context = await createServer({
    storeOptions: { dataDir },
    startScheduler: false
  });

  async function cleanup() {
    context.services.scheduler.stop();
    context.io.close();
    context.server.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }

  return {
    ...context,
    dataDir,
    cleanup
  };
}

test("bootstrap creates hostel-scoped wardens and filters their student dashboard", async (t) => {
  const harness = await createHarness();
  t.after(() => harness.cleanup());

  const boysWardenSession = await harness.services.authService.authenticate({
    role: "WARDEN",
    identifier: "warden",
    password: "Warden@123"
  });
  const girlsWardenSession = await harness.services.authService.authenticate({
    role: "WARDEN",
    identifier: "warden-girls",
    password: "Warden@123"
  });

  const boysDashboard = await harness.services.hostelService.getDashboardForUser(
    boysWardenSession.user
  );
  const girlsDashboard = await harness.services.hostelService.getDashboardForUser(
    girlsWardenSession.user
  );

  assert.ok(boysDashboard.students.every((student) => student.hostelType === "BOYS_HOSTEL"));
  assert.ok(girlsDashboard.students.every((student) => student.hostelType === "GIRLS_HOSTEL"));
  assert.ok(boysDashboard.metrics.total > 0);
  assert.ok(girlsDashboard.metrics.total > 0);
});

test("student registration requires the expanded academic and hostel profile fields", async (t) => {
  const harness = await createHarness();
  t.after(() => harness.cleanup());

  await assert.rejects(
    harness.services.authService.registerStudent({
      name: "Incomplete Student",
      enrollmentNumber: "ENR2026999",
      password: "Student@123",
      roomNumber: "D-110",
      floor: "1"
    }),
    /All registration fields are required/
  );

  const session = await harness.services.authService.registerStudent({
    name: "Riya Sen",
    enrollmentNumber: "ENR2026998",
    password: "Student@123",
    roomNumber: "G-204",
    floor: "2",
    contactNumber: "9999999991",
    parentContactNumber: "9999999992",
    location: "Indore",
    collegeName: "Tech University",
    department: "CSE",
    academicYear: "Third Year",
    hostelType: "GIRLS_HOSTEL"
  });

  assert.equal(session.user.hostelType, "GIRLS_HOSTEL");
  assert.equal(session.user.department, "CSE");
});

test("student fee receipt submission and admin approval update the fee timeline", async (t) => {
  const harness = await createHarness();
  t.after(() => harness.cleanup());

  const studentId = "stu-001";
  const feesBefore = await harness.services.hostelService.getFeeRecords({
    id: studentId,
    role: "STUDENT"
  });
  const beforeRecord = feesBefore[0];

  await harness.services.hostelService.submitFeePayment(studentId, {
    amount: beforeRecord.pending,
    installmentLabel: "Final Installment",
    note: "Net banking transfer",
    receiptImage: "data:image/png;base64,AAAA",
    receiptName: "receipt.png"
  });

  const pendingAfterSubmission = (
    await harness.services.hostelService.getFeeRecords({ id: studentId, role: "STUDENT" })
  )[0];
  const submittedRequest = pendingAfterSubmission.paymentRequests[0];
  assert.equal(submittedRequest.status, "SUBMITTED");

  const approvedFee = await harness.services.hostelService.reviewFeePayment(
    studentId,
    submittedRequest.id,
    {
      action: "APPROVE",
      confirmedAmount: beforeRecord.pending,
      reviewNote: "Receipt verified."
    },
    {
      id: "admin-root",
      role: "ADMIN",
      name: "Hostel Administrator"
    }
  );

  assert.equal(approvedFee.pending, 0);
  assert.equal(approvedFee.status, "Paid");
  assert.equal(approvedFee.paymentRequests[0].status, "APPROVED");
  assert.ok(approvedFee.paymentRequests[0].reviewedAt);
});

test("only admin can update student fee records and send reminders", async (t) => {
  const harness = await createHarness();
  t.after(() => harness.cleanup());

  await assert.rejects(
    harness.services.hostelService.updateStudentFeeRecord(
      "stu-002",
      {
        manualFineDelta: 500,
        note: "Late mess dues"
      },
      {
        id: "warden-boys",
        role: "WARDEN",
        hostelType: "BOYS_HOSTEL"
      }
    ),
    /Only admins can update fee records/
  );

  const updatedFee = await harness.services.hostelService.updateStudentFeeRecord(
    "stu-002",
    {
      manualFineDelta: 500,
      note: "Hostel rules fine",
      notificationMessage: "A fine has been added to your fee record."
    },
    {
      id: "admin-root",
      role: "ADMIN",
      name: "Hostel Administrator"
    }
  );

  assert.equal(updatedFee.fine >= 500, true);

  const reminderFee = await harness.services.hostelService.sendFeeReminder(
    "stu-002",
    {
      message: "Please clear your hostel dues before the deadline."
    },
    {
      id: "admin-root",
      role: "ADMIN",
      name: "Hostel Administrator"
    }
  );

  assert.ok(reminderFee.reminders.length >= 1);
});

test("anti-ragging complaints keep evidence and stay hostel scoped for wardens", async (t) => {
  const harness = await createHarness();
  t.after(() => harness.cleanup());

  const complaint = await harness.services.hostelService.createComplaint("stu-004", {
    title: "Senior intimidation",
    category: "Safety",
    description: "Repeated threats near the hostel stairwell.",
    section: "ANTI_RAGGING",
    evidenceImage: "data:image/jpeg;base64,BBBB",
    evidenceName: "proof.jpg"
  });

  assert.equal(complaint.section, "ANTI_RAGGING");
  assert.equal(complaint.evidenceName, "proof.jpg");

  const femaleWardenComplaints = await harness.services.hostelService.getComplaints(
    {
      id: "warden-girls",
      role: "WARDEN",
      hostelType: "GIRLS_HOSTEL"
    },
    { section: "ANTI_RAGGING" }
  );
  const maleWardenComplaints = await harness.services.hostelService.getComplaints(
    {
      id: "warden-boys",
      role: "WARDEN",
      hostelType: "BOYS_HOSTEL"
    },
    { section: "ANTI_RAGGING" }
  );

  assert.ok(femaleWardenComplaints.some((entry) => entry.id === complaint.id));
  assert.ok(!maleWardenComplaints.some((entry) => entry.id === complaint.id));
});

test("automation still promotes late exits to overdue and QR scan can check the student back in", async (t) => {
  const harness = await createHarness();
  t.after(() => harness.cleanup());

  const studentId = "stu-001";
  await harness.services.hostelService.requestExit(studentId, {
    purpose: "City",
    expectedReturnTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    note: "Short trip"
  });

  await harness.services.hostelService.processAutomations();

  let students = await harness.services.store.read("students");
  let student = students.find((entry) => entry.id === studentId);
  assert.equal(student.status, "OVERDUE");

  const qr = await harness.services.hostelService.getStudentQrCode(studentId);
  const result = await harness.services.hostelService.scanQr(
    {
      id: "warden-boys",
      role: "WARDEN",
      name: "Male Warden",
      hostelType: "BOYS_HOSTEL"
    },
    {
      qrToken: qr.token
    }
  );

  students = await harness.services.store.read("students");
  student = students.find((entry) => entry.id === studentId);
  assert.equal(result.action, "CHECK_IN");
  assert.equal(student.status, "IN");
});
