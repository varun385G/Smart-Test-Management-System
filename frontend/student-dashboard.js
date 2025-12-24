console.log("student-dashboard.js loaded");

const studentName = localStorage.getItem("studentName");
const testId = localStorage.getItem("testId");
const attempted = localStorage.getItem("attempted");

document.getElementById("name").innerText = studentName || "N/A";
document.getElementById("testId").innerText = testId || "N/A";

if (attempted === "yes") {
  document.getElementById("status").innerText = "Attempted";
  document.getElementById("startBtn").disabled = true;
} else {
  document.getElementById("status").innerText = "Available";
}

document.getElementById("startBtn").onclick = () => {
  window.location.href = "/exam.html";
};

document.getElementById("resultBtn").onclick = () => {
  window.location.href = "/student-result.html";
};
