console.log("exam.js loaded");

// ================= BASIC CHECK =================
const testId = localStorage.getItem("testId");

if (!testId) {
  alert("No test selected");
  window.location.href = "/student";
}

// ================= TIMER =================
let timerInterval;
let timeLeft = 0;

function startTimer(minutes) {
  timeLeft = minutes * 60;
  const timerEl = document.getElementById("timer");

  timerInterval = setInterval(() => {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;

    timerEl.innerText = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      alert("⏱ Time is up! Exam will be submitted automatically.");
      submitExam();
    }

    timeLeft--;
  }, 1000);
}

// ================= ANTI-CHEATING =================
function enforceFullscreen() {
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen();
  }
}

function disableCopyPaste() {
  document.addEventListener("copy", e => e.preventDefault());
  document.addEventListener("paste", e => e.preventDefault());
  document.addEventListener("contextmenu", e => e.preventDefault());
}

function detectTabSwitch(autoSubmit) {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && autoSubmit) {
      alert("Tab switch detected. Exam will be submitted.");
      submitExam();
    }
  });
}

// ================= LOAD EXAM =================
fetch(`/api/tests/${testId}`)
  .then(res => res.json())
  .then(data => {

    document.getElementById("testTitle").innerText = data.title;

    // ⏱️ START TIMER
    if (!data.duration || data.duration <= 0) {
      alert("Invalid exam duration");
      return;
    }
    startTimer(data.duration);

    // 🔐 APPLY SECURITY
    if (data.security) {
      if (data.security.fullscreen) enforceFullscreen();
      if (data.security.disableCopyPaste) disableCopyPaste();
      detectTabSwitch(data.security.autoSubmitOnTabChange);
    }

    let questions = data.questions;

    // Shuffle questions
    if (data.shuffleQuestions) {
      questions = questions.sort(() => Math.random() - 0.5);
    }

    const container = document.getElementById("questions");
    container.innerHTML = "";

    questions.forEach((q, qi) => {
      let options = q.options.map((opt, i) => ({ opt, i }));

      // Shuffle options
      if (data.shuffleOptions) {
        options = options.sort(() => Math.random() - 0.5);
      }

      const div = document.createElement("div");
      div.className = "question";

      div.innerHTML = `
        <h4>${qi + 1}. ${q.question}</h4>
        ${options.map(o => `
          <label>
            <input type="radio" name="q${qi}" value="${o.i}">
            ${o.opt}
          </label><br>
        `).join("")}
      `;

      container.appendChild(div);
    });
  })
  .catch(err => {
    console.error(err);
    alert("Failed to load exam");
  });

// ================= SUBMIT EXAM =================
async function submitExam() {
  clearInterval(timerInterval);

  const studentName = localStorage.getItem("studentName");
  const studentReg = localStorage.getItem("studentReg");

  const answers = [];
  document.querySelectorAll(".question").forEach((q, i) => {
    const selected = q.querySelector("input[type=radio]:checked");
    answers[i] = selected ? parseInt(selected.value) : -1;
  });

  try {
    const res = await fetch("/api/exam/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testId,
        studentName,
        studentReg,
        answers
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message);
      return;
    }

    localStorage.setItem("attempted", "yes");
    alert(`Score: ${data.score}/${data.total}`);
    window.location.href = "/student-result.html";

  } catch (err) {
    console.error(err);
    alert("Submission failed");
  }
}
