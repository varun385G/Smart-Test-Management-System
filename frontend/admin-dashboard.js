const role = localStorage.getItem("role");
const staffName = localStorage.getItem("staffName");

if (!role || !staffName) {
  window.location.href = "/staff";
}

document.getElementById("staffName").innerText = "Welcome, " + staffName;

document.getElementById("roleTitle").innerText =
  role === "admin" ? "Administrator Dashboard" : "Staff Dashboard";

// Hide admin cards for staff
if (role !== "admin") {
  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = "none";
  });
}

// ===== NAVIGATION =====
function goToCreateTest() {
  window.location.href = "/create-test.html";
}

function goToManageTests() {
  window.location.href = "/manage-tests.html";
}

function goToResults() {
  window.location.href = role === "admin"
    ? "/admin-results.html"
    : "/results-dashboard.html";
}

function goCreateStaff() {
  window.location.href = "/create-staff.html";
}

function goManageStaff() {
  window.location.href = "/manage-staff.html";
}

function logout() {
  localStorage.clear();
  window.location.href = "/";
}
