// ================= BASIC DATA =================
let violationCount = 0;
const MAX_VIOLATIONS = 3;

let remainingSeconds = 0;
let timerInterval = null;
let examSubmitted = false;

const testId = localStorage.getItem("testId");
const studentName = localStorage.getItem("studentName");
const studentReg = localStorage.getItem("studentReg");

let questions = [];
let answers = [];

// ================= SAFETY CHECK =================
if (!testId || !studentReg) {
  alert("Invalid exam session. Please re-enter the test.");
  window.location.href = "/student.html";
}

// ================= SECURITY =================
function registerViolation(reason) {
  if (examSubmitted) return;

  violationCount++;

  alert(`Warning ${violationCount}/${MAX_VIOLATIONS}\n${reason}`);

  // Log violation (optional backend)
  fetch("/api/exam/violation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ testId, studentReg, reason, count: violationCount })
  }).catch(() => {});

  if (violationCount >= MAX_VIOLATIONS) {
    autoSubmit("Multiple violations detected");
  }
}

// ================= FULLSCREEN =================
function enterFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen && !document.fullscreenElement) {
    el.requestFullscreen().catch(() => {});
  }
}

let fullscreenInitialized = false;

document.addEventListener("fullscreenchange", () => {
  if (!fullscreenInitialized || examSubmitted) return;

  if (!document.fullscreenElement) {
    registerViolation("Exited fullscreen mode");
    setTimeout(enterFullscreen, 500);
  }
});

// ================= TAB SWITCH =================
document.addEventListener("visibilitychange", () => {
  if (!examSubmitted && document.hidden) {
    registerViolation("Tab switched");
  }
});

// ================= COPY / PASTE =================
document.addEventListener("contextmenu", e => e.preventDefault());

document.addEventListener("keydown", e => {
  if (e.ctrlKey && ["c", "v", "x"].includes(e.key.toLowerCase())) {
    e.preventDefault();
    registerViolation("Copy/Paste attempt");
  }
});

// ================= TIMER =================
function startTimer() {
  updateTimerUI();

  timerInterval = setInterval(() => {
    if (examSubmitted) {
      clearInterval(timerInterval);
      return;
    }

    remainingSeconds--;

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      autoSubmit("Time is up");
      return;
    }

    updateTimerUI();
  }, 1000);
}

function updateTimerUI() {
  const el = document.getElementById("timer");
  if (!el) return;

  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;
  el.innerText = `Time: ${m}:${String(s).padStart(2, "0")}`;
}

// ================= LOAD EXAM =================
async function loadExam() {
  try {
    const res = await fetch(`/api/tests/${testId}`);
    if (!res.ok) throw new Error("Test not found");

    const data = await res.json();

    questions = data.questions || [];
    answers = new Array(questions.length).fill(null);

    remainingSeconds = (data.duration || 30) * 60;
    startTimer();

    const container = document.getElementById("examContainer");
    container.innerHTML = "";

    questions.forEach((q, i) => {
      const div = document.createElement("div");
      div.className = "question";
      div.innerHTML = `<b>Q${i + 1}. ${q.question}</b>`;

      q.options.forEach((opt, idx) => {
        const label = document.createElement("label");
        label.className = "option";

        label.innerHTML = `
          <span>${opt}</span>
          <input type="radio" name="q${i}">
        `;

        label.querySelector("input").onchange = () => {
          answers[i] = idx;
        };

        div.appendChild(label);
      });

      container.appendChild(div);
    });

    fullscreenInitialized = true;
  } catch (err) {
    document.getElementById("examContainer").innerHTML =
      "<p>Failed to load exam.</p>";
    console.error(err);
  }
}

// ================= SUBMIT =================
function submitExam() {
  if (examSubmitted) return;

  examSubmitted = true;
  clearInterval(timerInterval);

  fetch("/api/exam/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ testId, studentName, studentReg, answers })
  })
    .then(res => res.json())
    .then(data => {
      // ✅ mark attempt
      localStorage.setItem("attempted", "yes");
      localStorage.setItem("lastResult", JSON.stringify(data));

      alert(`Exam submitted!\nScore: ${data.score}/${data.total}`);
      window.location.href = "/student-result.html";
    })
    .catch(() => alert("Submission failed"));
}

function autoSubmit(reason) {
  if (examSubmitted) return;
  alert(reason);
  submitExam();
}

// ================= START =================
enterFullscreen();
setTimeout(() => (fullscreenInitialized = true), 1000);
loadExam();
