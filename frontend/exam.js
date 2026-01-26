// ================= UTILS =================
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ================= STATE =================
let questions = [];
let answers = [];
let remainingSeconds = 0;
let timerInterval = null;
let examSubmitted = false;

let violationCount = 0;
const MAX_VIOLATIONS = 3;

const testId = localStorage.getItem("testId");
const studentName = localStorage.getItem("studentName");
const studentReg = localStorage.getItem("studentReg");

if (!testId || !studentReg) location.href = "/";

// ================= FORCE TIMER VISIBILITY =================
function forceTimerVisible() {
  const el = document.getElementById("timer");
  if (!el) return;

  el.style.display = "block";
  el.style.visibility = "visible";
  el.style.opacity = "1";
  el.style.color = "#000";
  el.style.fontWeight = "bold";
  el.style.zIndex = "99999";
}

// ================= WARNING UI =================
function showWarning(reason) {
  if (examSubmitted) return;

  violationCount++;

  const box = document.getElementById("warningBox");
  box.querySelector("p").innerText =
    `⚠️ ${reason}\nWarning ${violationCount}/${MAX_VIOLATIONS}`;
  box.style.display = "flex";

  if (violationCount >= MAX_VIOLATIONS) {
    setTimeout(finalSubmit, 1000);
  }
}

function closeWarning() {
  document.getElementById("warningBox").style.display = "none";
}

// ================= SECURITY =================
document.addEventListener("visibilitychange", () => {
  if (document.hidden) showWarning("Tab switching detected");
});

document.addEventListener("keydown", e => {
  if (e.ctrlKey && ["c", "v", "x"].includes(e.key.toLowerCase())) {
    e.preventDefault();
    showWarning("Copy / Paste detected");
  }
});

document.addEventListener("contextmenu", e => {
  e.preventDefault();
  showWarning("Right click disabled");
});

window.addEventListener("blur", () => {
  showWarning("App switched / minimized");
});

// ================= TIMER =================
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);

  forceTimerVisible();
  updateTimer();

  timerInterval = setInterval(() => {
    remainingSeconds--;
    updateTimer();

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      finalSubmit();
    }
  }, 1000);
}

function updateTimer() {
  const el = document.getElementById("timer");
  if (!el) return;

  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;

  el.textContent = `Time: ${m}:${String(s).padStart(2, "0")}`;
}

// ================= LOAD EXAM =================
async function loadExam() {
  forceTimerVisible();

  // TEMP timer so user ALWAYS sees something
  remainingSeconds = 30 * 60;
  startTimer();

  let test;
  try {
    const res = await fetch(`/api/tests/${testId}`);
    if (!res.ok) throw new Error();
    test = await res.json();
  } catch {
    showWarning("Failed to load exam");
    return;
  }

  questions = shuffleArray(test.questions || []);
  answers = questions.map(q => (q.type === "MSQ" ? [] : null));

  remainingSeconds = (test.duration || 30) * 60;
  startTimer();

  const container = document.getElementById("examContainer");
  container.innerHTML = "";

  questions.forEach((q, qi) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "16px";

    let html = `<h4>Q${qi + 1}. ${q.question}</h4>`;

    if (q.image) {
      html += `<img src="${q.image}" style="max-width:100%;margin:10px 0">`;
    }

    if (q.type === "MCQ" || q.type === "MSQ") {
      shuffleArray(q.options.map((o, i) => ({ o, i }))).forEach(({ o, i }) => {
        html += `
          <label class="option" style="justify-content:space-between">
            <span>${o}</span>
            <input type="${q.type === "MCQ" ? "radio" : "checkbox"}"
                   name="q${qi}" data-index="${i}">
          </label>
        `;
      });
    }

    if (q.type === "NAT") {
      html += `
        <input type="number"
               placeholder="Enter numeric answer"
               style="width:100%;padding:12px;margin-top:10px">
      `;
    }

    card.innerHTML = html;
    container.appendChild(card);

    card.querySelectorAll("input").forEach(inp => {
      inp.onchange = () => {
        const idx = Number(inp.dataset.index);
        if (q.type === "MCQ") answers[qi] = idx;
        if (q.type === "MSQ") {
          answers[qi] = answers[qi] || [];
          inp.checked
            ? answers[qi].push(idx)
            : answers[qi] = answers[qi].filter(x => x !== idx);
        }
        if (q.type === "NAT") answers[qi] = Number(inp.value);
      };
    });
  });
}

// ================= SUBMIT =================
function confirmSubmit() {
  document.getElementById("confirmBox").style.display = "flex";
}

function cancelSubmit() {
  document.getElementById("confirmBox").style.display = "none";
}

async function finalSubmit() {
  if (examSubmitted) return;
  examSubmitted = true;
  clearInterval(timerInterval);

  await fetch("/api/exam/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      testId,
      studentName,
      studentReg,
      answers
    })
  });

  document.body.innerHTML = `
    <div class="container center">
      <div class="card">
        <h2>Exam Finished</h2>
        <p class="muted">Thank you. You may leave.</p>
        <br>
        <button onclick="location.href='/'">Leave</button>
      </div>
    </div>
  `;
}

// ================= START =================
document.addEventListener("DOMContentLoaded", loadExam);
