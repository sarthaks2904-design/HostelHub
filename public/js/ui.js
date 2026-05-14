function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString();
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleDateString();
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function hostelLabel(value) {
  if (value === "GIRLS_HOSTEL") {
    return "Girls Hostel";
  }

  if (value === "BOYS_HOSTEL") {
    return "Boys Hostel";
  }

  return value || "Hostel";
}

function statusBadge(status) {
  return `<span class="status-badge status-${String(status).toLowerCase()}">${escapeHtml(status)}</span>`;
}

function chip(label, className = "") {
  return `<span class="chip ${className}">${escapeHtml(label)}</span>`;
}

function metricCard(label, value, accent, caption = "") {
  return `
    <article class="metric-card">
      <div class="metric-accent ${accent}"></div>
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
      <div class="metric-caption">${escapeHtml(caption)}</div>
    </article>
  `;
}

function infoRow(label, value) {
  return `
    <div class="info-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function receiptPreview(image, altText = "Uploaded receipt") {
  if (!image) {
    return `<div class="empty-state">No image attached.</div>`;
  }

  return `<img src="${image}" alt="${escapeHtml(altText)}" class="payment-proof" />`;
}

function notificationList(notifications) {
  if (!notifications.length) {
    return emptyState("No notifications available.");
  }

  return notifications
    .map(
      (notification) => `
        <article class="stack-card">
          <div class="stack-head">
            <div>
              <h4>${escapeHtml(notification.title)}</h4>
              <span class="meta-line">${escapeHtml(notification.type)} | ${formatDateTime(
                notification.createdAt
              )}</span>
            </div>
            ${
              notification.read
                ? chip("Read", "chip-muted")
                : `<button class="chip chip-action" data-action="mark-notification-read" data-id="${escapeHtml(
                    notification.id
                  )}">Mark read</button>`
            }
          </div>
          <p>${escapeHtml(notification.message)}</p>
        </article>
      `
    )
    .join("");
}

function movementTable(movements) {
  if (!movements.length) {
    return emptyState("No movement logs available.");
  }

  return `
    <div class="table-shell">
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Purpose</th>
            <th>Status</th>
            <th>Exit</th>
            <th>Expected</th>
            <th>Return</th>
            <th>Mode</th>
          </tr>
        </thead>
        <tbody>
          ${movements
            .map(
              (movement) => `
                <tr>
                  <td>${escapeHtml(movement.student?.name || "You")}</td>
                  <td>${escapeHtml(movement.purpose)}</td>
                  <td>${escapeHtml(movement.status)}</td>
                  <td>${formatDateTime(movement.exitTime)}</td>
                  <td>${formatDateTime(movement.expectedReturnTime)}</td>
                  <td>${formatDateTime(movement.returnTime)}</td>
                  <td>${escapeHtml(movement.mode)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function complaintCards(complaints, staff = false) {
  if (!complaints.length) {
    return emptyState("No complaints available.");
  }

  return complaints
    .map(
      (complaint) => `
        <article class="stack-card">
          <div class="stack-head">
            <div>
              <h4>${escapeHtml(complaint.title)}</h4>
              <span class="meta-line">${escapeHtml(complaint.category)} | ${formatDateTime(
                complaint.createdAt
              )}</span>
            </div>
            ${chip(complaint.status)}
          </div>
          <p>${escapeHtml(complaint.description)}</p>
          <div class="badge-row">
            ${chip(
              complaint.section === "ANTI_RAGGING" ? "Anti-Ragging" : "General",
              complaint.section === "ANTI_RAGGING" ? "chip-danger" : ""
            )}
            ${
              complaint.student
                ? chip(`${complaint.student.name} | ${hostelLabel(complaint.student.hostelType)}`)
                : ""
            }
          </div>
          ${
            complaint.evidenceImage
              ? `
                <div class="evidence-shell">
                  <div class="meta-line">Attached proof: ${escapeHtml(
                    complaint.evidenceName || "image"
                  )}</div>
                  ${receiptPreview(complaint.evidenceImage, complaint.title)}
                </div>
              `
              : ""
          }
          ${
            complaint.resolutionNote
              ? `<div class="meta-line">Resolution note: ${escapeHtml(complaint.resolutionNote)}</div>`
              : ""
          }
          ${
            staff
              ? `
                <form class="inline-form" data-form="complaint-status" data-id="${escapeHtml(
                  complaint.id
                )}">
                  <select name="status">
                    ${["Pending", "In Progress", "Resolved"]
                      .map(
                        (status) => `
                          <option value="${status}" ${
                            complaint.status === status ? "selected" : ""
                          }>${status}</option>
                        `
                      )
                      .join("")}
                  </select>
                  <input name="resolutionNote" type="text" value="${escapeHtml(
                    complaint.resolutionNote || ""
                  )}" placeholder="Resolution note" />
                  <button type="submit">Update</button>
                </form>
              `
              : ""
          }
        </article>
      `
    )
    .join("");
}

function messMenuView(menu) {
  if (!menu?.days?.length) {
    return emptyState("Mess menu is not configured yet.");
  }

  return `
    <div class="menu-grid">
      ${menu.days
        .map(
          (day, index) => `
            <article class="stack-card menu-card">
              <div class="stack-head">
                <h4>${escapeHtml(day.day)}</h4>
                <span class="meta-line">Day ${index + 1}</span>
              </div>
              ${infoRow("Breakfast", day.breakfast)}
              ${infoRow("Lunch", day.lunch)}
              ${infoRow("Snacks", day.snacks)}
              ${infoRow("Dinner", day.dinner)}
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function feedbackCards(feedback) {
  if (!feedback.length) {
    return emptyState("No meal ratings submitted yet.");
  }

  return feedback
    .map(
      (item) => `
        <article class="stack-card">
          <div class="stack-head">
            <div>
              <h4>${escapeHtml(item.day)} | ${escapeHtml(item.mealType)}</h4>
              <span class="meta-line">${formatDateTime(item.createdAt)}</span>
            </div>
            ${chip(`${item.rating}/5`)}
          </div>
          <p>${escapeHtml(item.feedback || "No written feedback.")}</p>
        </article>
      `
    )
    .join("");
}

function leaveCards(leaves) {
  if (!leaves.length) {
    return emptyState("No meal leave applications yet.");
  }

  return leaves
    .map(
      (leave) => `
        <article class="stack-card">
          <div class="stack-head">
            <div>
              <h4>${escapeHtml(leave.reason)}</h4>
              <span class="meta-line">${escapeHtml(leave.fromDate)} to ${escapeHtml(
                leave.toDate
              )}</span>
            </div>
            ${chip(leave.status)}
          </div>
          <p>Meals: ${escapeHtml(leave.meals.join(", "))}</p>
        </article>
      `
    )
    .join("");
}

function sosCards(alerts, staff = false) {
  if (!alerts.length) {
    return emptyState("No SOS alerts.");
  }

  return alerts
    .map(
      (alert) => `
        <article class="stack-card sos-card">
          <div class="stack-head">
            <div>
              <h4>${escapeHtml(alert.student?.name || "You")}</h4>
              <span class="meta-line">Room ${escapeHtml(alert.roomNumber)} | ${formatDateTime(
                alert.createdAt
              )}</span>
            </div>
            ${chip(alert.status, alert.status === "OPEN" ? "chip-danger" : "")}
          </div>
          <p>${escapeHtml(alert.message)}</p>
          ${
            staff && alert.status === "OPEN"
              ? `<button class="pill-button danger" data-action="resolve-sos" data-id="${escapeHtml(
                  alert.id
                )}">Resolve Alert</button>`
              : ""
          }
        </article>
      `
    )
    .join("");
}

function paymentRequestCards(feeRecord, canReview = false) {
  const requests = feeRecord?.paymentRequests || [];
  if (!requests.length) {
    return emptyState("No payment receipts uploaded yet.");
  }

  return requests
    .map(
      (request) => `
        <article class="stack-card">
          <div class="stack-head">
            <div>
              <h4>${escapeHtml(request.installmentLabel)}</h4>
              <span class="meta-line">Submitted ${formatDateTime(request.submittedAt)}</span>
            </div>
            ${chip(request.status, request.status === "REJECTED" ? "chip-danger" : "")}
          </div>
          <div class="panel-grid two">
            <div>
              ${infoRow("Amount", formatCurrency(request.amount))}
              ${infoRow("Confirmed", formatCurrency(request.confirmedAmount || 0))}
              ${infoRow("Reviewed", formatDateTime(request.reviewedAt))}
            </div>
            <div class="receipt-frame">
              ${receiptPreview(request.receiptImage, request.installmentLabel)}
            </div>
          </div>
          <p>${escapeHtml(request.note || "No note attached.")}</p>
          ${
            request.reviewNote
              ? `<div class="meta-line">Admin note: ${escapeHtml(request.reviewNote)}</div>`
              : ""
          }
          ${
            canReview && request.status === "SUBMITTED"
              ? `
                <form class="form-grid compact-form" data-form="payment-review" data-student-id="${escapeHtml(
                  feeRecord.student.id
                )}" data-payment-id="${escapeHtml(request.id)}">
                  <label>
                    <span>Action</span>
                    <select name="action">
                      <option value="APPROVE">Approve</option>
                      <option value="REJECT">Reject</option>
                    </select>
                  </label>
                  <label>
                    <span>Confirmed Amount</span>
                    <input type="number" name="confirmedAmount" value="${escapeHtml(
                      request.amount
                    )}" />
                  </label>
                  <label>
                    <span>Next Installment Due</span>
                    <input type="date" name="nextInstallmentDueDate" />
                  </label>
                  <label>
                    <span>Due Date</span>
                    <input type="date" name="dueDate" />
                  </label>
                  <label class="full-width">
                    <span>Review Note</span>
                    <input type="text" name="reviewNote" placeholder="Optional admin note" />
                  </label>
                  <button type="submit">Submit Review</button>
                </form>
              `
              : ""
          }
        </article>
      `
    )
    .join("");
}

function reminderTimeline(reminders) {
  if (!reminders?.length) {
    return emptyState("No fee reminders sent yet.");
  }

  return reminders
    .map(
      (reminder) => `
        <article class="timeline-item">
          <strong>${escapeHtml(reminder.message)}</strong>
          <span>${formatDateTime(reminder.createdAt)}</span>
          <span>Due: ${formatDate(reminder.dueDate)}</span>
        </article>
      `
    )
    .join("");
}

function ledgerTimeline(ledger) {
  if (!ledger?.length) {
    return emptyState("No fee timeline entries yet.");
  }

  return ledger
    .map(
      (entry) => `
        <article class="timeline-item">
          <strong>${escapeHtml(entry.type)}</strong>
          <span>${formatDateTime(entry.timestamp)}</span>
          <span>${formatCurrency(entry.amount || 0)}</span>
          <span>${escapeHtml(entry.note || "")}</span>
        </article>
      `
    )
    .join("");
}

function renderAuth() {
  return `
    <div class="auth-shell">
      <section class="hero-card">
        <span class="eyebrow">Hostel Management System</span>
        <h1>HostelHub</h1>
        <div class="demo-box">
          <h3>Demo Credentials</h3>
          <p>Admin: <strong>admin</strong> / <strong>Admin@123</strong></p>
          <p>Male Warden: <strong>warden</strong> / <strong>Warden@123</strong></p>
          <p>Female Warden: <strong>warden-girls</strong> / <strong>Warden@123</strong></p>
          <p>Student: <strong>ENR2026001</strong> / <strong>Student@123</strong></p>
        </div>
      </section>

      <section class="auth-card">
        <div class="panel-grid">
          <form class="stack-card" data-form="login">
            <div class="stack-head">
              <h3>Sign In</h3>
            </div>
            <label>
              <span>Select Role</span>
              <select name="role">
                <option value="STUDENT">Student</option>
                <option value="WARDEN">Warden</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            <label>
              <span>Enrollment/Username</span>
              <input name="identifier" type="text" placeholder="Enrollment number or username" required />
            </label>
            <label>
              <span>Password</span>
              <input name="password" type="password" placeholder="Password" required />
            </label>
            <button type="submit">Login</button>
          </form>

          <form class="stack-card" data-form="register">
            <div class="stack-head">
              <h3>Student Registration</h3>
            </div>
            <div class="form-grid">
              <label>
                <span>Full Name</span>
                <input name="name" type="text" required />
              </label>
              <label>
                <span>Enrollment Number</span>
                <input name="enrollmentNumber" type="text" required />
              </label>
              <label>
                <span>Room Number</span>
                <input name="roomNumber" type="text" required />
              </label>
              <label>
                <span>Floor</span>
                <input name="floor" type="text" required />
              </label>
              <label>
                <span>Contact Number</span>
                <input name="contactNumber" type="text" required />
              </label>
              <label>
                <span>Parent Contact Number</span>
                <input name="parentContactNumber" type="text" required />
              </label>
              <label>
                <span>Location</span>
                <input name="location" type="text" placeholder="City or Village" required />
              </label>
              <label>
                <span>College</span>
                <input name="collegeName" type="text" required />
              </label>
              <label>
                <span>Branch / Department</span>
                <input name="department" type="text" required />
              </label>
              <label>
                <span>Year</span>
                <input name="academicYear" type="text" placeholder="Third Year" required />
              </label>
              <label>
                <span>Hostel Type</span>
                <select name="hostelType" required>
                  <option value="BOYS_HOSTEL">Boys Hostel</option>
                  <option value="GIRLS_HOSTEL">Girls Hostel</option>
                </select>
              </label>
              <label>
                <span>Password</span>
                <input name="password" type="password" placeholder="Minimum 8 characters" required />
              </label>
            </div>
            <button type="submit">Create Student Account</button>
          </form>
        </div>
      </section>
    </div>
  `;
}

function renderNav(user, currentPage) {
  const items =
    user.role === "STUDENT"
      ? [
          ["dashboard", "Dashboard"],
          ["fees", "Fees"],
          ["movements", "Movements"],
          ["complaints", "Complaints"],
          ["anti-ragging", "Anti-Ragging"],
          ["mess", "Mess"],
          ["notifications", "Notifications"],
          ["emergency", "Emergency"]
        ]
      : [
          ["dashboard", "Dashboard"],
          ["students", "Students"],
          ["fees", "Fees"],
          ["movements", "IN-OUT"],
          ["complaints", "Complaints"],
          ["anti-ragging", "Anti-Ragging"],
          ["notifications", "Notifications"],
          ["mess", "Mess"],
          ["emergency", "Emergency"],
          ["settings", "Settings"]
        ];

  return items
    .map(
      ([value, label]) => `
        <button class="nav-link ${currentPage === value ? "active" : ""}" data-action="navigate" data-page="${value}">
          ${escapeHtml(label)}
        </button>
      `
    )
    .join("");
}

function currentFeeRecord(state) {
  if (state.user.role === "STUDENT") {
    return state.fees[0] || null;
  }

  return (
    state.fees.find((fee) => fee.student.id === state.selectedFeeStudentId) ||
    state.fees[0] ||
    null
  );
}

function renderStudentDashboard(state) {
  const dashboard = state.dashboard;
  const fee = currentFeeRecord(state);
  const attendance =
    dashboard?.attendance || { percentage: 0, presentDays: 0, absentDays: 0, lateCount: 0 };
  const profile = dashboard?.profile || {};
  const currentStatus = dashboard?.currentStatus?.value || "IN";

  return `
    <section class="content-grid">
      <article class="hero-panel">
        <div>
          <span class="eyebrow">Student Dashboard</span>
          <h2>${escapeHtml(profile.name || "")}</h2>
          <p>${escapeHtml(profile.enrollmentNumber || "")} | ${hostelLabel(
    profile.hostelType
  )} | Room ${escapeHtml(profile.roomNumber || "")}</p>
        </div>
        <div class="hero-status">${statusBadge(currentStatus)}</div>
      </article>

      <div class="metrics-row">
        ${metricCard("Fee Status", fee?.status || "Pending", "accent-blue", "Current hostel fee state")}
        ${metricCard("Pending Fee", formatCurrency(fee?.pending || 0), "accent-red", "Outstanding dues")}
        ${metricCard(
          "Next Due Date",
          fee?.nextInstallmentDueDate ? formatDate(fee.nextInstallmentDueDate) : "Nil",
          "accent-gold",
          "Next installment or cleared balance"
        )}
        ${metricCard(
          "Unread Alerts",
          String(dashboard?.metrics?.unreadNotifications || 0),
          "accent-green",
          "Notification items waiting"
        )}
      </div>

      <article class="panel">
        <div class="panel-head">
          <h3>Profile and Academic Details</h3>
        </div>
        <div class="panel-grid two">
          <div class="stack-card">
            ${infoRow("Name", profile.name || "")}
            ${infoRow("Enrollment", profile.enrollmentNumber || "")}
            ${infoRow("Contact", profile.contactNumber || "")}
            ${infoRow("Parent Contact", profile.parentContactNumber || "")}
            ${infoRow("Location", profile.location || "")}
            ${infoRow("Hostel", hostelLabel(profile.hostelType))}
          </div>
          <div class="stack-card">
            ${infoRow("College", profile.collegeName || "")}
            ${infoRow("Department", profile.department || "")}
            ${infoRow("Academic Year", profile.academicYear || "")}
            ${infoRow("Room", profile.roomNumber || "")}
            ${infoRow("Floor", profile.floor || "")}
            ${infoRow("Attendance", `${attendance.percentage || 0}%`)}
          </div>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Fee Snapshot</h3>
        </div>
        <div class="panel-grid two">
          <div class="stack-card">
            ${infoRow("Total Fee", formatCurrency(fee?.total || 0))}
            ${infoRow("Paid", formatCurrency(fee?.paid || 0))}
            ${infoRow("Pending", formatCurrency(fee?.pending || 0))}
            ${infoRow("Fine", formatCurrency(fee?.fine || 0))}
            ${infoRow("Status", fee?.status || "Pending")}
          </div>
          <div class="stack-card qr-card">
            ${
              state.qr?.image
                ? `<img src="${state.qr.image}" alt="Student QR code" class="qr-image" />`
                : emptyState("QR code loading...")
            }
            <div class="meta-line">QR token is available in your hostel access panel.</div>
          </div>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Latest Payment and Complaints</h3>
        </div>
        <div class="panel-grid two">
          <div class="stack-list">${paymentRequestCards(fee, false)}</div>
          <div class="stack-list">
            ${complaintCards((dashboard?.antiRaggingComplaints || []).concat(dashboard?.complaints || []).slice(0, 4))}
          </div>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Notifications</h3>
        </div>
        <div class="stack-list">${notificationList(state.notifications.slice(0, 6))}</div>
      </article>
    </section>
  `;
}

function renderStudentFees(state) {
  const fee = currentFeeRecord(state);

  return `
    <section class="content-grid">
      <div class="metrics-row">
        ${metricCard("Fee Status", fee?.status || "Pending", "accent-blue", "Paid, pending, or fine charges")}
        ${metricCard("Outstanding", formatCurrency(fee?.pending || 0), "accent-red", "Pending amount")}
        ${metricCard("Fine Charges", formatCurrency(fee?.fine || 0), "accent-gold", "Admin-controlled fines")}
        ${metricCard(
          "Next Installment",
          fee?.nextInstallmentDueDate ? formatDate(fee.nextInstallmentDueDate) : "Nil",
          "accent-green",
          "Admin-confirmed due date"
        )}
      </div>

      <article class="panel">
        <div class="panel-head">
          <h3>Upload Payment Receipt</h3>
        </div>
        <form class="form-grid" data-form="fee-payment">
          <label>
            <span>Amount</span>
            <input type="number" name="amount" required />
          </label>
          <label>
            <span>Installment Label</span>
            <input type="text" name="installmentLabel" placeholder="Second Installment" required />
          </label>
          <label class="full-width">
            <span>Receipt Image</span>
            <input type="file" name="receiptImage" accept="image/*" required />
          </label>
          <label class="full-width">
            <span>Note</span>
            <textarea name="note" rows="3" placeholder="Payment mode, reference number, or note"></textarea>
          </label>
          <button type="submit">Submit Receipt for Admin Verification</button>
        </form>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Payment Requests and Confirmation History</h3>
        </div>
        <div class="stack-list">${paymentRequestCards(fee, false)}</div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Reminders and Timeline</h3>
        </div>
        <div class="panel-grid two">
          <div class="timeline-list">${reminderTimeline(fee?.reminders || [])}</div>
          <div class="timeline-list">${ledgerTimeline(fee?.ledger || [])}</div>
        </div>
      </article>
    </section>
  `;
}

function renderStudentMovements(state) {
  const openMovement = state.dashboard?.currentStatus?.openMovement;

  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <h3>Exit Request</h3>
        </div>
        <form class="form-grid" data-form="exit-request">
          <label>
            <span>Purpose</span>
            <select name="purpose" required>
              <option value="City">City</option>
              <option value="Medical">Medical</option>
              <option value="Home">Home</option>
              <option value="College">College</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label>
            <span>Expected Return</span>
            <input type="datetime-local" name="expectedReturnTime" required />
          </label>
          <label class="full-width">
            <span>Note</span>
            <textarea name="note" rows="3" placeholder="Optional note for the warden"></textarea>
          </label>
          <button type="submit">Submit Exit Request</button>
        </form>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Manual Return</h3>
        </div>
        <div class="stack-card">
          ${
            openMovement
              ? `
                ${infoRow("Purpose", openMovement.purpose)}
                ${infoRow("Expected Return", formatDateTime(openMovement.expectedReturnTime))}
                <button class="pill-button" data-action="return-self">Mark Return</button>
              `
              : emptyState("No active exit record.")
          }
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Entry and Exit History</h3>
        </div>
        ${movementTable(state.movements)}
      </article>
    </section>
  `;
}

function renderComplaintForm(formName, title, section, includeEvidence) {
  return `
    <form class="form-grid" data-form="${formName}">
      <input type="hidden" name="section" value="${escapeHtml(section)}" />
      <label>
        <span>Title</span>
        <input type="text" name="title" required />
      </label>
      <label>
        <span>Category</span>
        <input type="text" name="category" required />
      </label>
      <label class="full-width">
        <span>Description</span>
        <textarea name="description" rows="4" required></textarea>
      </label>
      ${
        includeEvidence
          ? `
            <label class="full-width">
              <span>Proof or Evidence</span>
              <input type="file" name="evidenceImage" accept="image/*" />
            </label>
          `
          : ""
      }
      <button type="submit">${escapeHtml(title)}</button>
    </form>
  `;
}

function renderStudentComplaints(state) {
  const complaints = state.complaints.filter((complaint) => complaint.section !== "ANTI_RAGGING");
  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <h3>Create General Complaint</h3>
        </div>
        ${renderComplaintForm("new-complaint", "Submit Complaint", "GENERAL", false)}
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Complaint History</h3>
        </div>
        <div class="stack-list">${complaintCards(complaints)}</div>
      </article>
    </section>
  `;
}

function renderStudentAntiRagging(state) {
  const complaints = state.complaints.filter((complaint) => complaint.section === "ANTI_RAGGING");
  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <h3>Anti-Ragging Complaint</h3>
        </div>
        ${renderComplaintForm(
          "anti-ragging-complaint",
          "Submit Anti-Ragging Complaint",
          "ANTI_RAGGING",
          true
        )}
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Anti-Ragging History</h3>
        </div>
        <div class="stack-list">${complaintCards(complaints)}</div>
      </article>
    </section>
  `;
}

function renderStudentMess(state) {
  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <h3>Weekly Mess Menu</h3>
        </div>
        ${messMenuView(state.menu)}
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Rate Meals</h3>
        </div>
        <form class="form-grid" data-form="meal-feedback">
          <label>
            <span>Day</span>
            <input type="text" name="day" placeholder="Wednesday" required />
          </label>
          <label>
            <span>Meal Type</span>
            <select name="mealType">
              <option value="Breakfast">Breakfast</option>
              <option value="Lunch">Lunch</option>
              <option value="Snacks">Snacks</option>
              <option value="Dinner">Dinner</option>
            </select>
          </label>
          <label>
            <span>Rating</span>
            <select name="rating">
              <option value="5">5</option>
              <option value="4">4</option>
              <option value="3">3</option>
              <option value="2">2</option>
              <option value="1">1</option>
            </select>
          </label>
          <label class="full-width">
            <span>Feedback</span>
            <textarea name="feedback" rows="3"></textarea>
          </label>
          <button type="submit">Submit Meal Feedback</button>
        </form>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Meal Leave</h3>
        </div>
        <form class="form-grid" data-form="meal-leave">
          <label>
            <span>From Date</span>
            <input type="date" name="fromDate" required />
          </label>
          <label>
            <span>To Date</span>
            <input type="date" name="toDate" required />
          </label>
          <label class="full-width">
            <span>Reason</span>
            <input type="text" name="reason" required />
          </label>
          <label class="full-width">
            <span>Meals</span>
            <div class="checkbox-row">
              <label><input type="checkbox" name="meals" value="Breakfast" /> Breakfast</label>
              <label><input type="checkbox" name="meals" value="Lunch" /> Lunch</label>
              <label><input type="checkbox" name="meals" value="Snacks" /> Snacks</label>
              <label><input type="checkbox" name="meals" value="Dinner" /> Dinner</label>
            </div>
          </label>
          <button type="submit">Apply for Meal Leave</button>
        </form>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Your Feedback and Leave History</h3>
        </div>
        <div class="panel-grid two">
          <div class="stack-list">${feedbackCards(state.feedback)}</div>
          <div class="stack-list">${leaveCards(state.leaves)}</div>
        </div>
      </article>
    </section>
  `;
}

function renderStudentNotifications(state) {
  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <h3>Notifications Center</h3>
        </div>
        <div class="stack-list">${notificationList(state.notifications)}</div>
      </article>
    </section>
  `;
}

function renderStudentEmergency(state) {
  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <h3>Emergency SOS</h3>
        </div>
        <form class="form-grid" data-form="sos">
          <label class="full-width">
            <span>Message</span>
            <textarea name="message" rows="4" placeholder="Describe the emergency."></textarea>
          </label>
          <button type="submit" class="danger">Trigger SOS Alert</button>
        </form>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>SOS History</h3>
        </div>
        <div class="stack-list">${sosCards(state.sos)}</div>
      </article>
    </section>
  `;
}

function renderStaffDashboard(state) {
  const metrics = state.dashboard?.metrics || { total: 0, in: 0, out: 0, overdue: 0 };
  const feeSummary = state.dashboard?.feeSummary || { pending: 0, fine: 0, paid: 0, pendingApprovals: 0 };
  const complaintSummary = state.dashboard?.complaintSummary || { total: 0, antiRagging: [] };
  const paymentQueue = feeSummary.paymentReviewQueue || [];

  return `
    <section class="content-grid">
      <div class="metrics-row">
        ${metricCard("All Students", String(metrics.total), "accent-blue", "Total Registered Students")}
        ${metricCard("Students IN", String(metrics.in), "accent-green", "Inside hostel")}
        ${metricCard("Students OUT", String(metrics.out), "accent-gold", "Currently outside")}
        ${metricCard("Payment Overdue", String(metrics.overdue), "accent-red", "Requires Immediate Attention")}
      </div>

      <div class="metrics-row">
        ${metricCard("Pending Fee", formatCurrency(feeSummary.pending), "accent-red", "Total Pending Fees")}
        ${metricCard("Collected Fee", formatCurrency(feeSummary.paid), "accent-green", "Payments Accepted")}
        ${metricCard("Fine Charges", formatCurrency(feeSummary.fine), "accent-gold", "Manual and Rule-based fines")}
        ${metricCard("Pending Approvals", String(feeSummary.pendingApprovals || 0), "accent-blue", "Pending Receipt Verification")}
      </div>

      <article class="panel">
        <div class="panel-head">
          <h3>Payment verification list</h3>
        </div>
        <div class="stack-list">
          ${
            paymentQueue.length
              ? paymentQueue
                  .slice(0, 6)
                  .map(
                    (item) => `
                      <article class="stack-card">
                        <div class="stack-head">
                          <div>
                            <h4>${escapeHtml(item.student.name)}</h4>
                            <span class="meta-line">${escapeHtml(
                              item.installmentLabel
                            )} | ${formatDateTime(item.submittedAt)}</span>
                          </div>
                          ${chip(item.status)}
                        </div>
                        ${infoRow("Hostel", hostelLabel(item.student.hostelType))}
                        ${infoRow("Amount", formatCurrency(item.amount))}
                      </article>
                    `
                  )
                  .join("")
              : emptyState("No payment receipts are waiting for review.")
          }
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Anti-Ragging Alerts</h3>
        </div>
        <div class="stack-list">
          ${
            complaintSummary.antiRagging?.length
              ? complaintCards(complaintSummary.antiRagging.slice(0, 4), false)
              : emptyState("No anti-ragging complaints in this scope.")
          }
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Notifications</h3>
        </div>
        <div class="stack-list">${notificationList(state.notifications.slice(0, 8))}</div>
      </article>
    </section>
  `;
}

function renderStudentDirectorySection(title, students, selectedStudentId) {
  return `
    <article class="panel">
      <div class="panel-head">
        <h3>${escapeHtml(title)}</h3>
      </div>
      <div class="student-grid">
        ${
          students.length
            ? students
                .map(
                  (student) => `
                    <article class="stack-card ${selectedStudentId === student.id ? "selected-card" : ""}">
                      <div class="stack-head">
                        <div>
                          <h4>${escapeHtml(student.name)}</h4>
                          <span class="meta-line">${escapeHtml(
                            student.enrollmentNumber
                          )} | Room ${escapeHtml(student.roomNumber)}</span>
                        </div>
                        ${statusBadge(student.status)}
                      </div>
                      ${infoRow("Contact", student.contactNumber)}
                      ${infoRow("Parent Contact", student.parentContactNumber)}
                      ${infoRow("Location", student.location)}
                      ${infoRow("Fee Status", student.feeStatus)}
                      ${infoRow("Due Fine", formatCurrency(student.fine))}
                      <button data-action="open-student-profile" data-id="${escapeHtml(
                        student.id
                      )}">Open Profile</button>
                    </article>
                  `
                )
                .join("")
            : emptyState("No students in this section.")
        }
      </div>
    </article>
  `;
}

function renderStudentProfilePane(profile) {
  if (!profile) {
    return emptyState("Choose a student to view the full profile.");
  }

  return `
    <article class="panel">
      <div class="panel-head">
        <h3>${escapeHtml(profile.profile.name)}</h3>
        ${chip(hostelLabel(profile.profile.hostelType))}
      </div>
      <div class="profile-sections">
        <div class="stack-card">
          <h4>Personal</h4>
          ${infoRow("Enrollment", profile.profile.enrollmentNumber)}
          ${infoRow("Contact", profile.profile.contactNumber)}
          ${infoRow("Parent Contact", profile.profile.parentContactNumber)}
          ${infoRow("Location", profile.profile.location)}
          ${infoRow("Room", profile.profile.roomNumber)}
          ${infoRow("Floor", profile.profile.floor)}
        </div>
        <div class="stack-card">
          <h4>Academic</h4>
          ${infoRow("College", profile.profile.collegeName)}
          ${infoRow("Department", profile.profile.department)}
          ${infoRow("Academic Year", profile.profile.academicYear)}
          ${infoRow("Hostel", hostelLabel(profile.profile.hostelType))}
          ${infoRow("Current Status", profile.profile.status)}
        </div>
        <div class="stack-card">
          <h4>Fee Snapshot</h4>
          ${infoRow("Status", profile.fee?.status || "Pending")}
          ${infoRow("Total", formatCurrency(profile.fee?.total || 0))}
          ${infoRow("Paid", formatCurrency(profile.fee?.paid || 0))}
          ${infoRow("Pending", formatCurrency(profile.fee?.pending || 0))}
          ${infoRow("Fine", formatCurrency(profile.fee?.fine || 0))}
          ${infoRow(
            "Next Installment",
            profile.fee?.nextInstallmentDueDate ? formatDate(profile.fee.nextInstallmentDueDate) : "Nil"
          )}
        </div>
      </div>
      <div class="panel-grid two">
        <div class="stack-card">
          <h4>Recent Movements</h4>
          ${movementTable(profile.movements.slice(0, 5))}
        </div>
        <div class="stack-card">
          <h4>Complaint Overview</h4>
          <div class="stack-list">${complaintCards(profile.antiRaggingComplaints.concat(profile.complaints).slice(0, 4))}</div>
        </div>
      </div>
    </article>
  `;
}

function renderStudentsPage(state) {
  const boys = state.students.filter((student) => student.hostelType === "BOYS_HOSTEL");
  const girls = state.students.filter((student) => student.hostelType === "GIRLS_HOSTEL");

  return `
    <section class="content-grid">
      ${renderStudentDirectorySection("Boys Hostel", boys, state.selectedStudentId)}
      ${renderStudentDirectorySection("Girls Hostel", girls, state.selectedStudentId)}
      ${renderStudentProfilePane(state.studentProfile)}
    </section>
  `;
}

function renderFeeList(fees, selectedFeeStudentId) {
  if (!fees.length) {
    return emptyState("No fee records available.");
  }

  return fees
    .map(
      (fee) => `
        <article class="stack-card ${selectedFeeStudentId === fee.student.id ? "selected-card" : ""}">
          <div class="stack-head">
            <div>
              <h4>${escapeHtml(fee.student.name)}</h4>
              <span class="meta-line">${hostelLabel(fee.student.hostelType)} | ${escapeHtml(
                fee.student.enrollmentNumber
              )}</span>
            </div>
            ${chip(fee.status)}
          </div>
          ${infoRow("Pending", formatCurrency(fee.pending))}
          ${infoRow("Fine", formatCurrency(fee.fine))}
          ${infoRow("Due Date", formatDate(fee.dueDate))}
          ${infoRow(
            "Receipts",
            String(
              (fee.paymentRequests || []).filter((request) => request.status === "SUBMITTED").length
            )
          )}
          <button data-action="select-fee-record" data-id="${escapeHtml(
            fee.student.id
          )}">Open Fee Record</button>
        </article>
      `
    )
    .join("");
}

function renderAdminFeeControls(fee) {
  if (!fee || !fee.student || fee.student.role === "STUDENT" && fee.student.id === undefined) {
    return "";
  }

  return `
    <article class="panel">
      <div class="panel-head">
        <h3>Admin Fee Controls</h3>
      </div>
      <form class="form-grid" data-form="fee-update" data-student-id="${escapeHtml(
        fee.student.id
      )}">
        <label>
          <span>Total Fee</span>
          <input type="number" name="total" value="${escapeHtml(fee.total || 0)}" />
        </label>
        <label>
          <span>Paid Amount</span>
          <input type="number" name="paid" value="${escapeHtml(fee.paid || 0)}" />
        </label>
        <label>
          <span>Pending Amount</span>
          <input type="number" name="pending" value="${escapeHtml(fee.pending || 0)}" />
        </label>
        <label>
          <span>Manual Fine Delta</span>
          <input type="number" name="manualFineDelta" value="0" />
        </label>
        <label>
          <span>Due Date</span>
          <input type="date" name="dueDate" value="${fee.dueDate ? String(fee.dueDate).slice(0, 10) : ""}" />
        </label>
        <label>
          <span>Next Installment Due</span>
          <input type="date" name="nextInstallmentDueDate" value="${
            fee.nextInstallmentDueDate ? String(fee.nextInstallmentDueDate).slice(0, 10) : ""
          }" />
        </label>
        <label class="full-width">
          <span>Admin Note</span>
          <textarea name="note" rows="2"></textarea>
        </label>
        <label class="full-width">
          <span>Notification Message for Student</span>
          <textarea name="notificationMessage" rows="2"></textarea>
        </label>
        <button type="submit">Update Fee Record</button>
      </form>

      <form class="form-grid compact-form" data-form="fee-reminder" data-student-id="${escapeHtml(
        fee.student.id
      )}">
        <label class="full-width">
          <span>Reminder Message</span>
          <input type="text" name="message" required />
        </label>
        <label>
          <span>Reminder Due Date</span>
          <input type="date" name="dueDate" />
        </label>
        <button type="submit">Send Reminder</button>
      </form>
    </article>
  `;
}

function renderFeeDetail(state) {
  const fee = currentFeeRecord(state);
  if (!fee) {
    return emptyState("Select a fee record to inspect payments and reminders.");
  }

  return `
    <article class="panel">
      <div class="panel-head">
        <h3>${escapeHtml(fee.student.name)} | Fee Record</h3>
        ${chip(fee.status)}
      </div>
      <div class="panel-grid two">
        <div class="stack-card">
          ${infoRow("Hostel", hostelLabel(fee.student.hostelType))}
          ${infoRow("Contact", fee.student.contactNumber)}
          ${infoRow("Parent Contact", fee.student.parentContactNumber)}
          ${infoRow("Location", fee.student.location)}
          ${infoRow("Total", formatCurrency(fee.total))}
          ${infoRow("Paid", formatCurrency(fee.paid))}
          ${infoRow("Pending", formatCurrency(fee.pending))}
          ${infoRow("Fine", formatCurrency(fee.fine))}
          ${infoRow("Due Date", formatDate(fee.dueDate))}
          ${infoRow(
            "Next Installment",
            fee.nextInstallmentDueDate ? formatDate(fee.nextInstallmentDueDate) : "Nil"
          )}
        </div>
        <div class="stack-card">
          <h4>Payment Receipts</h4>
          <div class="stack-list">${paymentRequestCards(fee, state.user.role === "ADMIN")}</div>
        </div>
      </div>
    </article>
    <article class="panel">
      <div class="panel-head">
        <h3>Fee Timeline</h3>
      </div>
      <div class="panel-grid two">
        <div class="timeline-list">${reminderTimeline(fee.reminders || [])}</div>
        <div class="timeline-list">${ledgerTimeline(fee.ledger || [])}</div>
      </div>
    </article>
    ${state.user.role === "ADMIN" ? renderAdminFeeControls(fee) : ""}
  `;
}

function renderStaffFees(state) {
  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <h3>Student Fee Records</h3>
        </div>
        <div class="detail-shell">
          <div class="list-pane">${renderFeeList(state.fees, state.selectedFeeStudentId)}</div>
          <div class="detail-pane">${renderFeeDetail(state)}</div>
        </div>
      </article>
    </section>
  `;
}

function renderStaffMovements(state) {
  const activeStudents = state.students.filter((student) => student.status !== "IN");
  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <h3>QR Scan Simulation</h3>
        </div>
        <form class="form-grid" data-form="scan-qr">
          <label>
            <input type="text" name="qrToken" required placeholder="Paste student QR token" />
          </label>
          <label>
            <span>Purpose</span>
            <select name="purpose">
              <option value="College">College</option>
              <option value="City">City</option>
              <option value="Medical">Medical</option>
              <option value="Home">Home</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label>
            <span>Expected Return</span>
            <input type="datetime-local" name="expectedReturnTime" />
          </label>
          <button type="submit">Simulate Scan</button>
        </form>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Manual Return Marking</h3>
        </div>
        <form class="form-grid" data-form="staff-return">
          <label>
            <span>Student</span>
            <select name="studentId" required>
              <option value="">Select student</option>
              ${activeStudents
                .map(
                  (student) => `
                    <option value="${escapeHtml(student.id)}">${escapeHtml(
                      `${student.name} (${student.enrollmentNumber})`
                    )}</option>
                  `
                )
                .join("")}
            </select>
          </label>
          <button type="submit">Mark Return</button>
        </form>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Live Entry and Exit Logs</h3>
        </div>
        ${movementTable(state.movements)}
      </article>
    </section>
  `;
}

function renderStaffComplaints(state) {
  const complaints = state.complaints.filter((complaint) => complaint.section !== "ANTI_RAGGING");
  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <h3>Complaint Management</h3>
        </div>
        <div class="stack-list">${complaintCards(complaints, true)}</div>
      </article>
    </section>
  `;
}

function renderStaffAntiRagging(state) {
  const complaints = state.complaints.filter((complaint) => complaint.section === "ANTI_RAGGING");
  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <h3>Anti-Ragging Cases</h3>
        </div>
        <div class="stack-list">${complaintCards(complaints, true)}</div>
      </article>
    </section>
  `;
}

function renderStaffNotifications(state) {
  const students = state.students || [];
  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <h3>Send Notification</h3>
        </div>
        <form class="form-grid" data-form="send-notification">
          <label>
            <span>Title</span>
            <input type="text" name="title" required />
          </label>
          <label>
            <span>Type</span>
            <select name="type">
              <option value="GENERAL">General</option>
              <option value="EMERGENCY">Emergency</option>
              <option value="PERSONAL">Personal</option>
            </select>
          </label>
          <label>
            <span>Audience</span>
            <select name="audience">
              <option value="ALL">All Visible Students</option>
              <option value="STAFF">Staff</option>
              <option value="SELECTED">Selected Student</option>
            </select>
          </label>
          <label>
            <span>Student</span>
            <select name="recipientId">
              <option value="">Optional student recipient</option>
              ${students
                .map(
                  (student) => `
                    <option value="${escapeHtml(student.id)}">${escapeHtml(
                      `${student.name} (${student.enrollmentNumber})`
                    )}</option>
                  `
                )
                .join("")}
            </select>
          </label>
          <label class="full-width">
            <span>Message</span>
            <textarea name="message" rows="4" required></textarea>
          </label>
          <button type="submit">Send Notification</button>
        </form>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Notification Log</h3>
        </div>
        <div class="stack-list">${notificationList(state.notifications)}</div>
      </article>
    </section>
  `;
}

function renderMessEditor(menu, isAdmin) {
  if (!isAdmin) {
    return messMenuView(menu);
  }

  const days = menu?.days || [];
  return `
    <form class="menu-grid" data-form="menu-update">
      ${days
        .map(
          (day, index) => `
            <article class="stack-card menu-card">
              <input type="hidden" name="day-${index}" value="${escapeHtml(day.day)}" />
              <div class="stack-head">
                <h4>${escapeHtml(day.day)}</h4>
                <span class="meta-line">Editable</span>
              </div>
              <label><span>Breakfast</span><input name="breakfast-${index}" value="${escapeHtml(
                day.breakfast
              )}" /></label>
              <label><span>Lunch</span><input name="lunch-${index}" value="${escapeHtml(
                day.lunch
              )}" /></label>
              <label><span>Snacks</span><input name="snacks-${index}" value="${escapeHtml(
                day.snacks
              )}" /></label>
              <label><span>Dinner</span><input name="dinner-${index}" value="${escapeHtml(
                day.dinner
              )}" /></label>
            </article>
          `
        )
        .join("")}
      <div class="full-width">
        <button type="submit">Save Weekly Menu</button>
      </div>
    </form>
  `;
}

function renderStaffMess(state) {
  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <h3>${state.user.role === "ADMIN" ? "Mess Menu Management" : "Mess Menu"}</h3>
        </div>
        ${renderMessEditor(state.menu, state.user.role === "ADMIN")}
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Meal Ratings</h3>
        </div>
        <div class="stack-list">${feedbackCards(state.feedback)}</div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h3>Meal Leave Requests</h3>
        </div>
        <div class="stack-list">${leaveCards(state.leaves)}</div>
      </article>
    </section>
  `;
}

function renderStaffEmergency(state) {
  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <h3>Emergency SOS Feed</h3>
        </div>
        <div class="stack-list">${sosCards(state.sos, true)}</div>
      </article>
    </section>
  `;
}

function renderSettings(state) {
  const config = state.config || {};
  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <h3>Rules and penalty settings</h3>
        </div>
        <form class="form-grid" data-form="config-update">
          <label>
            <span>Curfew Time</span>
            <input type="time" name="curfewTime" value="${escapeHtml(config.curfewTime || "22:00")}" />
          </label>
          <label>
            <span>Fine amount</span>
            <input type="number" name="violationFine" value="${escapeHtml(
              config.violationFine || 250
            )}" />
          </label>
          <label>
            <span>Allowed late time</span>
            <input type="number" name="overdueGraceMinutes" value="${escapeHtml(
              config.overdueGraceMinutes || 0
            )}" />
          </label>
          <label>
            <span>Regular exit time</span>
            <input type="number" name="defaultExitHours" value="${escapeHtml(
              config.defaultExitHours || 4
            )}" />
          </label>
          <button type="submit">Update Hostel Settings</button>
        </form>
      </article>
    </section>
  `;
}

function renderCurrentPage(state) {
  if (state.user.role === "STUDENT") {
    if (state.currentPage === "fees") return renderStudentFees(state);
    if (state.currentPage === "movements") return renderStudentMovements(state);
    if (state.currentPage === "complaints") return renderStudentComplaints(state);
    if (state.currentPage === "anti-ragging") return renderStudentAntiRagging(state);
    if (state.currentPage === "mess") return renderStudentMess(state);
    if (state.currentPage === "notifications") return renderStudentNotifications(state);
    if (state.currentPage === "emergency") return renderStudentEmergency(state);
    return renderStudentDashboard(state);
  }

  if (state.currentPage === "students") return renderStudentsPage(state);
  if (state.currentPage === "fees") return renderStaffFees(state);
  if (state.currentPage === "movements") return renderStaffMovements(state);
  if (state.currentPage === "complaints") return renderStaffComplaints(state);
  if (state.currentPage === "anti-ragging") return renderStaffAntiRagging(state);
  if (state.currentPage === "notifications") return renderStaffNotifications(state);
  if (state.currentPage === "mess") return renderStaffMess(state);
  if (state.currentPage === "emergency") return renderStaffEmergency(state);
  if (state.currentPage === "settings") return renderSettings(state);
  return renderStaffDashboard(state);
}

export function renderApp(root, state) {
  if (!state.user) {
    root.innerHTML = renderAuth();
    return;
  }

  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div>
          <div class="brand-mark">HH</div>
          <h1>HostelHub</h1>
        </div>
        <div class="user-chip">
          <strong>${escapeHtml(state.user.name)}</strong>
          <span>${escapeHtml(titleCase(state.user.role))}</span>
          ${
            state.user.hostelType
              ? `<span>${escapeHtml(hostelLabel(state.user.hostelType))}</span>`
              : ""
          }
        </div>
        <nav class="nav-list">
          ${renderNav(state.user, state.currentPage)}
        </nav>
        <button class="logout-link" data-action="logout">Logout</button>
      </aside>

      <main class="main-shell">
        <header class="topbar">
          <div>
            <h2>${escapeHtml(titleCase(state.currentPage))}</h2>
          </div>
          <div class="topbar-meta">
            <span>${escapeHtml(titleCase(state.user.role))}</span>
            <span>${new Date().toLocaleString()}</span>
          </div>
        </header>
        ${renderCurrentPage(state)}
      </main>
    </div>
  `;
}

export function showToast(message, type = "info") {
  const toastRoot = document.getElementById("toast-root");
  if (!toastRoot) {
    return;
  }

  const element = document.createElement("div");
  element.className = `toast toast-${type}`;
  element.textContent = message;
  toastRoot.appendChild(element);

  window.setTimeout(() => {
    element.classList.add("fade-out");
  }, 2400);

  window.setTimeout(() => {
    element.remove();
  }, 3000);
}
