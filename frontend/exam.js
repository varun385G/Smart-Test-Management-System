/* ═══════════════════════════════════════════
   EXAM ENGINE — full featured
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
let autoSaveInterval = null;
let examSubmitted    = false;
let examLocked       = false;
let violationCount   = 0;
const MAX_VIOLATIONS = 3;

// Violation dedup: 1.5s cooldown so visibilitychange+blur don't double-count
let lastViolationTime = 0;
const VIOLATION_COOLDOWN_MS = 1500;

const violationLog = [];

const testId      = localStorage.getItem('testId');
const studentName = localStorage.getItem('studentName');
const studentReg  = localStorage.getItem('studentReg');

if (!testId || !studentReg) location.href = '/';

/* ── Security events ──────────────────────── */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) recordViolation('Tab switch detected');
});
document.addEventListener('keydown', e => {
  if (e.ctrlKey && ['c','v','x','a'].includes(e.key.toLowerCase())) {
    e.preventDefault(); recordViolation('Copy/paste attempt blocked');
  }
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
    e.preventDefault();
  }
});
document.addEventListener('contextmenu', e => { e.preventDefault(); });
window.addEventListener('blur', () => recordViolation('Window focus lost'));
window.addEventListener('beforeunload', e => {
  if (!examSubmitted && !examLocked) { e.preventDefault(); e.returnValue = ''; }
});

function recordViolation(reason) {
  if (examSubmitted || examLocked) return;
  const now = Date.now();
  if (now - lastViolationTime < VIOLATION_COOLDOWN_MS) return;
  lastViolationTime = now;

  violationCount++;
  violationLog.push({ reason, timestamp: new Date().toISOString() });

  document.getElementById('warningText').innerText =
    `${reason}\nViolation ${violationCount} of ${MAX_VIOLATIONS}`;
  document.getElementById('warningBox').classList.add('open');

  if (violationCount >= MAX_VIOLATIONS) {
    setTimeout(lockExam, 1200);
  }
}

function closeWarning() { document.getElementById('warningBox').classList.remove('open'); }

/* ── Lock Exam ────────────────────────────── */
async function lockExam() {
  if (examLocked || examSubmitted) return;
  examLocked = true;
  clearInterval(timerInterval);
  clearInterval(autoSaveInterval);

  document.getElementById('warningBox').classList.remove('open');
  document.getElementById('confirmBox').classList.remove('open');
  document.querySelectorAll('input, textarea, button').forEach(el => el.disabled = true);

  const remappedAnswers = remapAnswers();

  let lockCode = '----';
  try {
    const res = await fetch('/api/exam/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId, studentName, studentReg, answers: remappedAnswers, violationLog })
    });
    const data = await res.json();
    if (data.lockCode) lockCode = data.lockCode;
  } catch (_) {}

  const overlay = document.createElement('div');
  overlay.id = 'lockOverlay';
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:9999;
    background:rgba(15,23,42,0.97);
    display:flex; align-items:center; justify-content:center;
    font-family:var(--font-main);
  `;
  overlay.innerHTML = `
    <div style="background:var(--card); border-radius:16px; padding:40px 32px; max-width:460px; width:90%; text-align:center; border:2px solid #ef4444;">
      <div style="font-size:56px; margin-bottom:12px;">🔒</div>
      <h2 style="color:#ef4444; font-size:22px; margin-bottom:8px;">Exam Locked</h2>
      <p style="color:var(--text); font-weight:600; margin-bottom:4px;">Malpractice Detected</p>
      <p style="color:var(--muted); font-size:14px; margin-bottom:20px;">
        Your exam has been locked after <strong>${MAX_VIOLATIONS} security violations</strong>.
      </p>
      <div style="background:var(--bg); border-radius:10px; padding:14px 18px; margin-bottom:20px; text-align:left;">
        <div style="font-size:12px; font-weight:700; color:var(--muted); margin-bottom:8px; text-transform:uppercase;">Student Details</div>
        <div style="font-size:14px;"><strong>Name:</strong> ${studentName}</div>
        <div style="font-size:14px;"><strong>Reg No:</strong> ${studentReg}</div>
        <div style="font-size:14px;"><strong>Test ID:</strong> ${testId}</div>
      </div>
      <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:14px 18px; margin-bottom:20px;">
        <div style="font-size:12px; font-weight:700; color:#dc2626; margin-bottom:6px; text-transform:uppercase;">Violation Log</div>
        ${violationLog.map((v, i) => `
          <div style="font-size:13px; color:var(--text); text-align:left; padding:3px 0; border-bottom:1px solid #fee2e2;">
            <strong>${i+1}.</strong> ${v.reason}
            <span style="color:var(--muted); font-size:11px;">— ${new Date(v.timestamp).toLocaleTimeString()}</span>
          </div>
        `).join('')}
      </div>
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:12px 16px; margin-bottom:20px;">
        <div style="font-size:12px; font-weight:700; color:#92400e; margin-bottom:4px;">Show this screen to your invigilator</div>
        <div style="font-size:13px; color:var(--muted);">Only the staff who created this test can unlock or submit your exam.</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

/* ── Remap answers: shuffled index → original index ── */
function remapAnswers() {
  const totalQ = questions.length;
  const remapped = new Array(totalQ).fill(null);
  questions.forEach((q, shuffledIdx) => {
    const origIdx = q._origIdx !== undefined ? q._origIdx : shuffledIdx;
    const ans = answers[shuffledIdx];
    remapped[origIdx] = Array.isArray(ans) ? [...ans] : ans;
  });
  return remapped;
}

/* ── Timer ────────────────────────────────── */
function startTimer() {
  clearInterval(timerInterval);
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    remainingSeconds--;
    updateTimerDisplay();
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      // If locked → force submit with current answers; else normal submit
      if (examLocked) {
        timerExpiredForceSubmit();
      } else {
        finalSubmit();
      }
    }
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

/* Timer expired while locked → force-submit with existing saved answers */
async function timerExpiredForceSubmit() {
  clearInterval(autoSaveInterval);
  try {
    // The server already has the saved answers from lockExam()
    // We call submit API which will overwrite with calculated score
    const remapped = remapAnswers();
    await fetch('/api/exam/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId, studentName, studentReg, answers: remapped, violationLog })
    });
  } catch (_) {}
  // Remove lock overlay and show submitted screen
  const overlay = document.getElementById('lockOverlay');
  if (overlay) overlay.remove();
  showSubmittedScreen();
}

/* ── Auto-save progress every 30 seconds ──── */
async function autoSaveProgress() {
  if (examSubmitted || examLocked) return;
  try {
    const remapped = remapAnswers();
    await fetch('/api/exam/save-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId, studentName, studentReg, answers: remapped, remainingSeconds })
    });
  } catch (_) {}
}

/* ── Load Exam ────────────────────────────── */
async function loadExam() {
  // Check lock / submit status first (handles page refresh scenarios)
  let lockData = null;
  try {
    const lockRes = await fetch(`/api/exam/lock-status/${testId}/${studentReg}`);
    if (lockRes.ok) lockData = await lockRes.json();
  } catch (_) {}

  // 1. Force-submitted by staff → show submitted screen, stop here
  if (lockData && lockData.isForceSubmitted) {
    showSubmittedScreen();
    return;
  }

  // 2. Still locked → show lock screen, stop here
  if (lockData && lockData.isLocked) {
    renderLockScreenOnly(lockData.lockCode);
    return;
  }

  // Load test data
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

  const originalQuestions = test.questions || [];
  questions = test.shuffleQuestions !== false ? shuffleArray([...originalQuestions]) : [...originalQuestions];

  // Tag each question with its original index for answer remapping
  questions.forEach(q => {
    q._origIdx = originalQuestions.findIndex(orig =>
      orig.question === q.question && orig.type === q.type
    );
  });

  // Default blank answers
  answers = questions.map(q => q.type === 'MSQ' ? [] : null);

  // 3. Restore saved answers + remaining timer if student previously started (unlock resume or crash recovery)
  if (lockData && lockData.exists && lockData.savedAnswers && lockData.savedAnswers.length > 0) {
    questions.forEach((q, shuffledIdx) => {
      const origIdx = q._origIdx !== undefined ? q._origIdx : shuffledIdx;
      const saved = lockData.savedAnswers[origIdx];
      if (saved !== undefined && saved !== null) {
        if (q.type === 'MSQ') {
          answers[shuffledIdx] = Array.isArray(saved) ? [...saved] : [];
        } else {
          answers[shuffledIdx] = saved;
        }
      }
    });
  }

  // 4. Restore remaining timer — if saved use it, otherwise start fresh
  const fullDuration = (test.duration || 30) * 60;
  if (lockData && lockData.remainingSeconds !== null && lockData.remainingSeconds !== undefined && lockData.remainingSeconds > 0) {
    remainingSeconds = lockData.remainingSeconds;
  } else {
    remainingSeconds = fullDuration;
  }

  startTimer();

  // Start periodic auto-save every 30 seconds
  autoSaveInterval = setInterval(autoSaveProgress, 30000);

  document.getElementById('confirmTotal').textContent = questions.length;

  const hasNegative = questions.some(q => q.negativeMarkingEnabled && q.negativeMarks > 0);
  if (hasNegative) {
    const banner = document.getElementById('negativeMarkingBanner');
    if (banner) banner.style.display = 'flex';
  }

  renderAllQuestions(test);
  restoreAnswersInUI();
  buildNavigator();
  updateProgress();
}

/* Render lock screen only (on page refresh while locked) */
function renderLockScreenOnly(lockCode) {
  examLocked = true;
  clearInterval(timerInterval);
  document.querySelectorAll('input, textarea, button').forEach(el => el.disabled = true);

  const overlay = document.createElement('div');
  overlay.id = 'lockOverlay';
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:9999;
    background:rgba(15,23,42,0.97);
    display:flex; align-items:center; justify-content:center;
    font-family:var(--font-main);
  `;
  overlay.innerHTML = `
    <div style="background:var(--card); border-radius:16px; padding:40px 32px; max-width:460px; width:90%; text-align:center; border:2px solid #ef4444;">
      <div style="font-size:56px; margin-bottom:12px;">🔒</div>
      <h2 style="color:#ef4444; font-size:22px; margin-bottom:8px;">Exam is Locked</h2>
      <p style="color:var(--muted); font-size:14px; margin-bottom:20px;">
        Your exam was locked due to security violations.
      </p>
      <div style="background:var(--bg); border-radius:10px; padding:14px 18px; margin-bottom:20px; text-align:left;">
        <div style="font-size:12px; font-weight:700; color:var(--muted); margin-bottom:8px; text-transform:uppercase;">Student Details</div>
        <div style="font-size:14px;"><strong>Name:</strong> ${studentName}</div>
        <div style="font-size:14px;"><strong>Reg No:</strong> ${studentReg}</div>
        <div style="font-size:14px;"><strong>Test ID:</strong> ${testId}</div>
      </div>
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:12px 16px; margin-bottom:20px;">
        <div style="font-size:12px; font-weight:700; color:#92400e; margin-bottom:4px;">Show this screen to your invigilator</div>
        <div style="font-size:13px; color:var(--muted);">Only the staff who created this test can unlock your exam.</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
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

    let negBadge = '';
    if (q.negativeMarkingEnabled && q.negativeMarks > 0) {
      negBadge = `<span class="badge badge-red" style="font-size:11px;">−${q.negativeMarks} for wrong</span>`;
    }

    let msqHint = '';
    if (q.type === 'MSQ') {
      msqHint = `<div style="background:#f5f3ff; border:1px solid #c4b5fd; border-radius:8px; padding:8px 12px; margin-bottom:12px; font-size:12.5px; color:#5b21b6;">
        💡 <strong>Select all correct answers.</strong> Partial marks awarded. Wrong selections reduce your score.
      </div>`;
    }

    let html = `
      <div class="q-exam-header">
        <div>
          <div class="q-exam-num">Question ${qi + 1} of ${questions.length}</div>
          <div style="display:flex; gap:8px; margin-top:4px; flex-wrap:wrap;">
            <span class="badge ${typeBadgeClass}">${typeLabel}</span>
            <span class="badge badge-gray">${marks} mark${marks !== 1 ? 's' : ''}</span>
            ${negBadge}
          </div>
        </div>
        <button class="flag-btn" id="flagBtn-${qi}" onclick="toggleFlag(${qi})">🚩 Flag</button>
      </div>
      <div class="q-exam-text" style="margin-bottom:12px;">${q.question}</div>
      ${msqHint}
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

/* ── Restore saved answers into UI after render ── */
function restoreAnswersInUI() {
  questions.forEach((q, qi) => {
    const saved = answers[qi];
    if (saved === null || saved === undefined) return;

    if (q.type === 'MCQ') {
      document.querySelectorAll(`[data-qi="${qi}"]`).forEach(inp => {
        if (Number(inp.dataset.idx) === saved) {
          inp.checked = true;
          inp.closest('.exam-option').classList.add('selected');
        }
      });
    } else if (q.type === 'MSQ') {
      if (!Array.isArray(saved)) return;
      document.querySelectorAll(`[data-qi="${qi}"]`).forEach(inp => {
        if (saved.includes(Number(inp.dataset.idx))) {
          inp.checked = true;
          inp.closest('.exam-option').classList.add('selected');
        }
      });
    } else if (q.type === 'NAT') {
      const input = document.querySelector(`input[type="number"][data-qi="${qi}"]`);
      if (input && saved !== null && saved !== undefined && saved !== '') {
        input.value = saved;
      }
    }
    updateNavigatorBtn(qi);
  });
}

/* ── Answer handling ──────────────────────── */
function handleAnswer(qi, idx, input) {
  const q = questions[qi];
  if (q.type === 'MCQ') {
    answers[qi] = idx;
    document.querySelectorAll(`[data-qi="${qi}"]`).forEach(inp => {
      inp.closest('.exam-option').classList.toggle('selected', inp.checked);
    });
  }
  if (q.type === 'MSQ') {
    if (!Array.isArray(answers[qi])) answers[qi] = [];
    if (input.checked) { if (!answers[qi].includes(idx)) answers[qi].push(idx); }
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
  if (examSubmitted || examLocked) return;
  examSubmitted = true;
  clearInterval(timerInterval);
  clearInterval(autoSaveInterval);

  document.getElementById('confirmBox').classList.remove('open');

  const remapped = remapAnswers();

  try {
    await fetch('/api/exam/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId, studentName, studentReg, answers: remapped, violationLog })
    });
  } catch (_) {}

  showSubmittedScreen();
}

function showSubmittedScreen() {
  examSubmitted = true;
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