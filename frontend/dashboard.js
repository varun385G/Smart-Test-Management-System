const role = localStorage.getItem("role");
const staffName = localStorage.getItem("staffName");

// 🔐 Protect dashboard
if (!role || !staffName) {
  window.location.href = "/staff";
}

// 👋 Welcome message
document.getElementById("staffName").innerText = "Welcome, " + staffName;

// 👑 Hide admin-only cards for staff
if (role !== "admin") {
  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = "none";
  });
}

// ================= NAVIGATION =================

function goToCreateTest() {
  window.location.href = "/create-test.html";
}

function goToManageTests() {
  window.location.href = "/manage-tests.html";
}

// 🔥 IMPORTANT FIX: Role-based Results Page
function goToResults() {
  if (role === "admin") {
    window.location.href = "/admin-results.html";
  } else {
    window.location.href = "/results-dashboard.html";
  }
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
function addActivity(text) {
  const activities = JSON.parse(localStorage.getItem("activities")) || [];

  activities.unshift({
    text,
    time: new Date().toLocaleString()
  });

  localStorage.setItem("activities", JSON.stringify(activities.slice(0, 5)));
}
function loadActivities() {
  const list = document.querySelector(".activity ul");
  list.innerHTML = "";

  const activities = JSON.parse(localStorage.getItem("activities")) || [];

  if (activities.length === 0) {
    list.innerHTML = "<li>No recent activity</li>";
    return;
  }

  activities.forEach(a => {
    const li = document.createElement("li");
    li.innerText = `${a.text} (${a.time})`;
    list.appendChild(li);
  });
}

loadActivities();
