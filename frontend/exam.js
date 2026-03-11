/* ═══════════════════════════════════════════
   EXAM ENGINE — Full featured
   ═══════════════════════════════════════════ */

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── State ────────────────────────────────── */
let questions        = [];
let answers          = [];
let flagged          = new Set();
let remainingSeconds = 0;
let timerInterval    = null;
let examSubmitted    = false;
let violationCount   = 0;
const MAX_VIOLATIONS = 3;

const testId      = localStorage.getItem('testId');
const studentName = localStorage.getItem('studentName');
const studentReg  = localStorage.getItem('studentReg');

if (!testId || !studentReg) location.href = '/';

/* ── Security ─────────────────────────────── */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) showSecurityWarning('Tab switching detected');
});
document.addEventListener('keydown', e => {
  if (e.ctrlKey && ['c','v','x','a'].includes(e.key.toLowerCase())) {
    e.preventDefault(); showSecurityWarning('Copy/paste blocked');
  }
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
    e.preventDefault();
  }
});
document.addEventListener('contextmenu', e => { e.preventDefault(); });
window.addEventListener('blur', () => showSecurityWarning('Window focus lost'));
window.addEventListener('beforeunload', e => { if (!examSubmitted) { e.preventDefault(); e.returnValue = ''; } });

function showSecurityWarning(reason) {
  if (examSubmitted) return;
  violationCount++;
  document.getElementById('warningText').innerText =
    `${reason}\nViolation ${violationCount} of ${MAX_VIOLATIONS}`;
  document.getElementById('warningBox').classList.add('open');
  if (violationCount >= MAX_VIOLATIONS) setTimeout(finalSubmit, 1500);
}
function closeWarning() { document.getElementById('warningBox').classList.remove('open'); }

/* ── Timer ────────────────────────────────── */
function startTimer() {
  clearInterval(timerInterval);
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    remainingSeconds--;
    updateTimerDisplay();
    if (remainingSeconds <= 0) { clearInterval(timerInterval); finalSubmit(); }
  }, 1000);
}
function updateTimerDisplay() {
  const el = document.getElementById('timerDisplay');
  if (!el) return;
  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;
  el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  el.className = remainingSeconds < 60 ? 'danger' : remainingSeconds < 300 ? 'warn' : '';
}

/* ── Load Exam ────────────────────────────── */
async function loadExam() {
  let test;
  try {
    const res = await fetch(`/api/tests/${testId}`);
    if (!res.ok) throw new Error();
    test = await res.json();
  } catch {
    document.getElementById('examContainer').innerHTML =
      '<div class="q-exam-card" style="text-align:center; color:var(--danger);">Failed to load exam. Please refresh.</div>';
    return;
  }

  document.getElementById('examTitle').textContent = test.title || 'Examination';
  document.title = test.title || 'Examination';

  questions = test.shuffleQuestions !== false ? shuffleArray(test.questions || []) : [...(test.questions || [])];
  answers   = questions.map(q => q.type === 'MSQ' ? [] : null);

  remainingSeconds = (test.duration || 30) * 60;
  startTimer();

  document.getElementById('confirmTotal').textContent = questions.length;

  renderAllQuestions(test);
  buildNavigator();
  updateProgress();
}

/* ── Render questions ─────────────────────── */
function renderAllQuestions(test) {
  const container = document.getElementById('examContainer');
  container.innerHTML = '';

  questions.forEach((q, qi) => {
    const card = document.createElement('div');
    card.className = 'q-exam-card';
    card.id = `qcard-${qi}`;

    const marks = q.marks || 1;
    const typeLabel = q.type === 'MCQ' ? 'Single correct' : q.type === 'MSQ' ? 'Multiple correct' : 'Numeric answer';
    const typeBadgeClass = q.type === 'MCQ' ? 'badge-blue' : q.type === 'MSQ' ? 'badge-purple' : 'badge-orange';

    let html = `
      <div class="q-exam-header">
        <div>
          <div class="q-exam-num">Question ${qi + 1} of ${questions.length}</div>
          <div style="display:flex; gap:8px; margin-top:4px; flex-wrap:wrap;">
            <span class="badge ${typeBadgeClass}">${typeLabel}</span>
            <span class="badge badge-gray">${marks} mark${marks !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <button class="flag-btn" id="flagBtn-${qi}" onclick="toggleFlag(${qi})">🚩 Flag</button>
      </div>
      <div class="q-exam-text" style="margin-bottom:16px;">${q.question}</div>
    `;

    if (q.image) {
      html += `<img src="${q.image}" style="max-width:100%; max-height:280px; border-radius:10px; margin-bottom:16px; display:block;">`;
    }

    if (q.type === 'MCQ' || q.type === 'MSQ') {
      const opts = test.shuffleOptions !== false
        ? shuffleArray(q.options.map((o, i) => ({ o, i })))
        : q.options.map((o, i) => ({ o, i }));

      opts.forEach(({ o, i }) => {
        const inputType = q.type === 'MCQ' ? 'radio' : 'checkbox';
        html += `
          <label class="exam-option" id="opt-${qi}-${i}">
            <input type="${inputType}" name="q${qi}" data-qi="${qi}" data-idx="${i}"
                   onchange="handleAnswer(${qi}, ${i}, this)">
            <span>${o}</span>
          </label>
        `;
      });
    }

    if (q.type === 'NAT') {
      html += `
        <input type="number" step="any" placeholder="Enter your numeric answer"
               data-qi="${qi}" oninput="handleNAT(${qi}, this)"
               style="max-width:240px; font-size:16px; font-weight:700;">
      `;
    }

    card.innerHTML = html;
    container.appendChild(card);
  });
}

/* ── Answer handling ──────────────────────── */
function handleAnswer(qi, idx, input) {
  const q = questions[qi];
  if (q.type === 'MCQ') {
    answers[qi] = idx;
    // Style options
    document.querySelectorAll(`[data-qi="${qi}"]`).forEach(inp => {
      inp.closest('.exam-option').classList.toggle('selected', inp.checked);
    });
  }
  if (q.type === 'MSQ') {
    if (!Array.isArray(answers[qi])) answers[qi] = [];
    if (input.checked) answers[qi].push(idx);
    else answers[qi] = answers[qi].filter(x => x !== idx);
    input.closest('.exam-option').classList.toggle('selected', input.checked);
  }
  updateNavigatorBtn(qi);
  updateProgress();
}
function handleNAT(qi, input) {
  answers[qi] = input.value !== '' ? Number(input.value) : null;
  updateNavigatorBtn(qi);
  updateProgress();
}

/* ── Navigator ────────────────────────────── */
function buildNavigator() {
  const grid = document.getElementById('navGrid');
  grid.innerHTML = questions.map((_, i) => `
    <button class="nav-btn" id="navBtn-${i}" onclick="scrollToQ(${i})">${i + 1}</button>
  `).join('');
}

function updateNavigatorBtn(qi) {
  const btn = document.getElementById(`navBtn-${qi}`);
  if (!btn) return;
  const isAnswered = Array.isArray(answers[qi]) ? answers[qi].length > 0 : answers[qi] !== null;
  btn.classList.toggle('answered', isAnswered);
  btn.classList.toggle('flagged', flagged.has(qi));
}

function scrollToQ(qi) {
  const card = document.getElementById(`qcard-${qi}`);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleFlag(qi) {
  flagged.has(qi) ? flagged.delete(qi) : flagged.add(qi);
  const btn = document.getElementById(`flagBtn-${qi}`);
  if (btn) btn.classList.toggle('flagged', flagged.has(qi));
  updateNavigatorBtn(qi);
  document.getElementById('flaggedCount').textContent = flagged.size;
}

function updateProgress() {
  const answered = answers.filter(a => Array.isArray(a) ? a.length > 0 : a !== null).length;
  const pct = questions.length ? (answered / questions.length * 100) : 0;
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('answeredCount').textContent = answered;
  document.getElementById('confirmAnswered').textContent = answered;
}

/* ── Submit ───────────────────────────────── */
function confirmSubmit() { document.getElementById('confirmBox').classList.add('open'); }
function cancelSubmit()  { document.getElementById('confirmBox').classList.remove('open'); }

async function finalSubmit() {
  if (examSubmitted) return;
  examSubmitted = true;
  clearInterval(timerInterval);

  document.getElementById('confirmBox').classList.remove('open');

  try {
    await fetch('/api/exam/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId, studentName, studentReg, answers })
    });
  } catch (_) {}

  document.body.innerHTML = `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg); font-family:var(--font-main);">
      <div class="card" style="max-width:400px; width:90%; text-align:center; padding:40px;">
        <div style="font-size:56px; margin-bottom:16px;">✅</div>
        <h2 style="font-size:22px; margin-bottom:8px;">Exam Submitted!</h2>
        <p style="color:var(--muted); font-size:14px; margin-bottom:24px;">
          Your answers have been recorded.<br>Results will be available once published by your staff.
        </p>
        <button onclick="location.href='/'" class="btn btn-primary" style="width:100%;">Return to Home</button>
      </div>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', loadExam);