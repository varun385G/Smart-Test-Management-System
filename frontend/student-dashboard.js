console.log("student-dashboard.js loaded");

const nameEl = document.getElementById("name");
const testIdEl = document.getElementById("testId");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const resultBtn = document.getElementById("resultBtn");

const studentName = localStorage.getItem("studentName");
const testId = localStorage.getItem("testId");
const attempted = localStorage.getItem("attempted");

/* Fill data safely */
nameEl.innerText = studentName || "N/A";
testIdEl.innerText = testId || "N/A";

/* Status handling */
if (attempted === "yes") {
  statusEl.innerText = "Attempted";
  statusEl.style.color = "var(--accent)";
  startBtn.disabled = true;
  startBtn.style.opacity = "0.6";
  startBtn.style.cursor = "not-allowed";
} else {
  statusEl.innerText = "Available";
  statusEl.style.color = "var(--primary)";
}

/* Button actions */
startBtn.onclick = () => {
  if (startBtn.disabled) return;
  window.location.href = "/exam.html";
};

resultBtn.onclick = () => {
  window.location.href = "/student-result.html";
};
