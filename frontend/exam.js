/* ═══════════════════════════════════════════
   EXAM ENGINE — one question at a time
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
let questions           = [];
let answers             = [];
let questionStatus      = [];   // 'unvisited' | 'answered' | 'skipped' | 'review'
let currentIndex        = 0;
let remainingSeconds    = 0;
let timerInterval       = null;
let autoSaveInterval    = null;
let examSubmitted       = false;
let examLocked          = false;
let violationCount      = 0;
let examReady           = false;
let examStarted         = false;  // true only after student dismisses disclaimer
let submitAfterSeconds  = null;   // null = no lock, else seconds from start when submit unlocks
let elapsedSeconds      = 0;      // how many seconds have passed since exam started
let elapsedInterval     = null;
const MAX_VIOLATIONS    = 3;

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

// Back button detection
history.pushState(null, '', location.href);
window.addEventListener('popstate', () => {
  history.pushState(null, '', location.href);
  recordViolation('Back button pressed');
});

function recordViolation(reason) {
  if (!examStarted) return;  // don't count violations during disclaimer
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
  clearInterval(elapsedInterval);

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

/* ── Remap answers: shuffled → original index ── */
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
    updateSubmitLock();
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      if (examLocked) { timerExpiredForceSubmit(); } else { finalSubmit(); }
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

/* ── Submit lock logic ────────────────────── */
let totalDurationSeconds = 0;

function updateSubmitLock() {
  if (submitAfterSeconds === null) return;
  const btn = document.getElementById('submitBtn');
  const msg = document.getElementById('submitLockMsg');
  if (!btn) return;

  const elapsed = totalDurationSeconds - remainingSeconds;
  const canSubmit = elapsed >= submitAfterSeconds;

  if (canSubmit) {
    btn.classList.remove('locked');
    btn.disabled = false;
    if (msg) msg.style.display = 'none';
  } else {
    btn.classList.add('locked');
    btn.disabled = true;
    const minsLeft = Math.ceil((submitAfterSeconds - elapsed) / 60);
    if (msg) {
      msg.style.display = 'block';
      msg.textContent = `🔒 Submit unlocks in ${minsLeft} min${minsLeft !== 1 ? 's' : ''}`;
    }
  }
}

function handleSubmitClick() {
  const btn = document.getElementById('submitBtn');
  if (btn && btn.classList.contains('locked')) return;
  confirmSubmit();
}

async function timerExpiredForceSubmit() {
  clearInterval(autoSaveInterval);
  try {
    const remapped = remapAnswers();
    await fetch('/api/exam/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId, studentName, studentReg, answers: remapped, violationLog })
    });
  } catch (_) {}
  const overlay = document.getElementById('lockOverlay');
  if (overlay) overlay.remove();
  showSubmittedScreen();
}

/* ── Auto-save every 10 seconds ──────────── */
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

/* ── Immediate save on each answer action ─── */
function saveNow() {
  if (examSubmitted || examLocked) return;
  autoSaveProgress();
}

/* ══════════════════════════════════════════
   RENDER SINGLE QUESTION
══════════════════════════════════════════ */
function renderQuestion(qi) {
  currentIndex = qi;
  // Save current position so refresh can restore it
  if (testId) localStorage.setItem('currentIndex_' + testId, qi);
  const q = questions[qi];
  const container = document.getElementById('examContainer');

  // Mark as skipped if unvisited (visiting now for first time without answer)
  if (questionStatus[qi] === 'unvisited') {
    questionStatus[qi] = 'skipped';
  }
  updateAllNavBtns();

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
      Select all correct answers. Partial marks awarded. Wrong selections reduce your score.
    </div>`;
  }

  let html = `
    <div class="q-exam-card">
      <div class="q-exam-header">
        <div>
          <div class="q-exam-num">Question ${qi + 1} of ${questions.length}</div>
          <div style="display:flex; gap:8px; margin-top:4px; flex-wrap:wrap;">
            <span class="badge ${typeBadgeClass}">${typeLabel}</span>
            <span class="badge badge-gray">${marks} mark${marks !== 1 ? 's' : ''}</span>
            ${negBadge}
          </div>
        </div>
      </div>
      <div class="q-exam-text" style="margin-bottom:16px;">${q.question}</div>
      ${msqHint}
  `;

  if (q.image) {
    html += `<img src="${q.image}" style="max-width:100%; max-height:280px; border-radius:10px; margin-bottom:16px; display:block;">`;
  }

  if (q.type === 'MCQ' || q.type === 'MSQ') {
    const opts = q._shuffledOpts || q.options.map((o, i) => ({ o, i }));
    opts.forEach(({ o, i }) => {
      const inputType = q.type === 'MCQ' ? 'radio' : 'checkbox';
      const isSelected = q.type === 'MCQ'
        ? answers[qi] === i
        : Array.isArray(answers[qi]) && answers[qi].includes(i);
      html += `
        <label class="exam-option${isSelected ? ' selected' : ''}" id="opt-${qi}-${i}">
          <input type="${inputType}" name="q${qi}" data-qi="${qi}" data-idx="${i}"
                 ${isSelected ? 'checked' : ''}
                 onchange="handleAnswer(${qi}, ${i}, this)">
          <span>${o}</span>
        </label>
      `;
    });
  }

  if (q.type === 'NAT') {
    const savedVal = (answers[qi] !== null && answers[qi] !== undefined) ? answers[qi] : '';
    html += `
      <input type="number" step="any" placeholder="Enter your numeric answer"
             data-qi="${qi}" id="natInput-${qi}"
             value="${savedVal}"
             oninput="handleNAT(${qi}, this)"
             style="max-width:240px; font-size:16px; font-weight:700;">
    `;
  }

  const isFirst = qi === 0;
  const isLast  = qi === questions.length - 1;

  html += `
    <div class="exam-actions">
      <div class="left-btns">
        <button class="btn btn-sm" onclick="goToPrev()" ${isFirst ? 'disabled' : ''}>← Previous</button>
        <button class="btn-review" onclick="saveAndReview(${qi})">Save &amp; Review</button>
      </div>
      <div class="right-btns">
        <button class="btn btn-sm" onclick="clearAnswer(${qi})">Clear</button>
        ${isLast
          ? `<button class="btn-save-next" onclick="saveAndNext(${qi})">Save</button>`
          : `<button class="btn-save-next" onclick="saveAndNext(${qi})">Save &amp; Next →</button>`
        }
      </div>
    </div>
  `;

  html += `</div>`;
  container.innerHTML = html;

  updateAllNavBtns();
}

/* ── Answer handlers ──────────────────────── */
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
  // Save immediately on every answer change
  saveNow();
}

function handleNAT(qi, input) {
  answers[qi] = input.value !== '' ? Number(input.value) : null;
  saveNow();
}

/* ── Save & Next ──────────────────────────── */
function saveAndNext(qi) {
  const hasAnswer = isAnswered(qi);
  if (hasAnswer) {
    if (questionStatus[qi] !== 'review') questionStatus[qi] = 'answered';
  } else {
    questionStatus[qi] = 'skipped';
  }
  updateAllNavBtns();
  updateProgress();
  saveNow();

  if (qi < questions.length - 1) {
    renderQuestion(qi + 1);
  } else {
    handleSubmitClick();
  }
}

/* ── Save & Review ────────────────────────── */
function saveAndReview(qi) {
  if (!isAnswered(qi)) {
    alert('Please answer the question first, then click Save & Review.');
    return;
  }
  questionStatus[qi] = 'review';
  updateAllNavBtns();
  updateProgress();
  saveNow();
  if (qi < questions.length - 1) {
    renderQuestion(qi + 1);
  }
}

/* ── Clear answer ─────────────────────────── */
function clearAnswer(qi) {
  const q = questions[qi];
  answers[qi] = q.type === 'MSQ' ? [] : null;
  questionStatus[qi] = 'skipped';
  updateAllNavBtns();
  updateProgress();
  saveNow();
  renderQuestion(qi);
}

/* ── Prev / Nav ───────────────────────────── */
function goToPrev() {
  if (currentIndex > 0) renderQuestion(currentIndex - 1);
}

function goToQuestion(qi) {
  renderQuestion(qi);
}

/* ── Check if answered ────────────────────── */
function isAnswered(qi) {
  const ans = answers[qi];
  if (Array.isArray(ans)) return ans.length > 0;
  return ans !== null && ans !== undefined && ans !== '';
}

/* ── Navigator ────────────────────────────── */
function buildNavigator() {
  const grid = document.getElementById('navGrid');
  grid.innerHTML = questions.map((_, i) => `
    <button class="nav-btn" id="navBtn-${i}" onclick="goToQuestion(${i})">${i + 1}</button>
  `).join('');
}

function updateAllNavBtns() {
  questions.forEach((_, i) => {
    const btn = document.getElementById(`navBtn-${i}`);
    if (!btn) return;
    btn.classList.remove('answered', 'skipped', 'review', 'current');
    const status = questionStatus[i];
    if (status === 'answered') btn.classList.add('answered');
    else if (status === 'skipped') btn.classList.add('skipped');
    else if (status === 'review')  btn.classList.add('review');
    if (i === currentIndex) btn.classList.add('current');
  });
}

/* ── Progress ─────────────────────────────── */
function updateProgress() {
  const answered = questionStatus.filter(s => s === 'answered' || s === 'review').length;
  const pct = questions.length ? (answered / questions.length * 100) : 0;
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('answeredCount').textContent = answered;
  const reviewCount = questionStatus.filter(s => s === 'review').length;
  document.getElementById('flaggedCount').textContent = reviewCount;
  const confirmAnswered = document.getElementById('confirmAnswered');
  if (confirmAnswered) confirmAnswered.textContent = answered;
}

/* ── Submit ───────────────────────────────── */
function confirmSubmit() {
  // Populate summary
  const answered   = questionStatus.filter(s => s === 'answered').length;
  const review     = questionStatus.filter(s => s === 'review').length;
  const skipped    = questionStatus.filter(s => s === 'skipped').length;
  const unvisited  = questionStatus.filter(s => s === 'unvisited').length;
  const total      = questions.length;

  const sa = document.getElementById('summaryAnswered');
  const sr = document.getElementById('summaryReview');
  const su = document.getElementById('summaryUnanswered');
  const suv = document.getElementById('summaryUnvisited');
  const st = document.getElementById('summaryTotal');

  if (sa)  sa.textContent  = answered;
  if (sr)  sr.textContent  = review;
  if (su)  su.textContent  = skipped;
  if (suv) suv.textContent = unvisited;
  if (st)  st.textContent  = total;

  // Also update old confirmAnswered/confirmTotal if they exist
  const ca = document.getElementById('confirmAnswered');
  const ct = document.getElementById('confirmTotal');
  if (ca) ca.textContent = answered + review;
  if (ct) ct.textContent = total;

  document.getElementById('confirmBox').classList.add('open');
}
function cancelSubmit()  { document.getElementById('confirmBox').classList.remove('open'); }

async function finalSubmit() {
  if (examSubmitted || examLocked) return;
  examSubmitted = true;
  clearInterval(timerInterval);
  clearInterval(autoSaveInterval);
  clearInterval(elapsedInterval);

  // Clear disclaimer + position flags so next student on same device starts fresh
  localStorage.removeItem('disclaimerSeen_' + testId);
  localStorage.removeItem('currentIndex_' + testId);

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

/* ── Load Exam ────────────────────────────── */
async function loadExam() {
  let lockData = null;
  try {
    const lockRes = await fetch(`/api/exam/lock-status/${testId}/${studentReg}`);
    if (lockRes.ok) lockData = await lockRes.json();
  } catch (_) {}

  if (lockData && lockData.isForceSubmitted) { showSubmittedScreen(); return; }
  if (lockData && lockData.isLocked) { renderLockScreenOnly(lockData.lockCode); return; }

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

  questions.forEach(q => {
    q._origIdx = originalQuestions.findIndex(orig => orig.question === q.question && orig.type === q.type);
    // Pre-shuffle options once so they stay consistent while navigating back and forth
    if ((q.type === 'MCQ' || q.type === 'MSQ') && test.shuffleOptions !== false) {
      q._shuffledOpts = shuffleArray(q.options.map((o, i) => ({ o, i })));
    } else {
      q._shuffledOpts = q.options ? q.options.map((o, i) => ({ o, i })) : [];
    }
  });

  // Submit lock setup
  totalDurationSeconds = (test.duration || 30) * 60;
  if (test.submitAfterMinutes) {
    submitAfterSeconds = test.submitAfterMinutes * 60;
  } else {
    submitAfterSeconds = null;
  }

  // Default blank answers and statuses
  answers        = questions.map(q => q.type === 'MSQ' ? [] : null);
  questionStatus = questions.map(() => 'unvisited');

  // ── Restore saved answers and timer from server (survives refresh) ──
  if (lockData && lockData.exists && lockData.savedAnswers && lockData.savedAnswers.length > 0) {
    questions.forEach((q, shuffledIdx) => {
      const origIdx = q._origIdx !== undefined ? q._origIdx : shuffledIdx;
      const saved = lockData.savedAnswers[origIdx];
      if (saved !== undefined && saved !== null) {
        answers[shuffledIdx] = q.type === 'MSQ'
          ? (Array.isArray(saved) ? [...saved] : [])
          : saved;
        if (isAnswered(shuffledIdx)) questionStatus[shuffledIdx] = 'answered';
      }
    });
  }

  // ── Restore remaining timer from server ──
  // If server has a saved remainingSeconds use it, else start fresh
  if (lockData && lockData.remainingSeconds != null && lockData.remainingSeconds > 0) {
    remainingSeconds = lockData.remainingSeconds;
  } else {
    remainingSeconds = totalDurationSeconds;
  }

  startTimer();

  // Auto-save every 10 seconds (more frequent = better refresh recovery)
  autoSaveInterval = setInterval(autoSaveProgress, 10000);

  document.getElementById('confirmTotal').textContent = questions.length;

  const hasNegative = questions.some(q => q.negativeMarkingEnabled && q.negativeMarks > 0);
  if (hasNegative) {
    const banner = document.getElementById('negativeMarkingBanner');
    if (banner) banner.style.display = 'flex';
  }

  buildNavigator();
  updateProgress();
  updateSubmitLock();
  // Don't render the first question yet — wait for student to dismiss disclaimer
  examReady = true;
}

/* ── Lock screen on refresh ───────────────── */
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

/* ── Disclaimer screen ─────────────────── */
function startExam() {
  examStarted = true;  // now violations start counting
  // Mark disclaimer as seen for this exam session
  localStorage.setItem('disclaimerSeen_' + testId, '1');
  const screen = document.getElementById('disclaimerScreen');
  if (screen) screen.style.display = 'none';
  // If exam data is ready, render first question now
  if (examReady) {
    renderQuestion(0);
  } else {
    // Data still loading — poll until ready
    const wait = setInterval(() => {
      if (examReady) {
        clearInterval(wait);
        renderQuestion(0);
      }
    }, 100);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const alreadySeen = localStorage.getItem('disclaimerSeen_' + testId);
  if (alreadySeen) {
    // Hide disclaimer immediately
    const screen = document.getElementById('disclaimerScreen');
    if (screen) screen.style.display = 'none';
    examStarted = true;
    // Wait for loadExam to finish, then render the question
    const wait = setInterval(() => {
      if (examReady) {
        clearInterval(wait);
        // Restore last visited question index if saved
        const savedIdx = parseInt(localStorage.getItem('currentIndex_' + testId) || '0', 10);
        const qi = (savedIdx >= 0 && savedIdx < questions.length) ? savedIdx : 0;
        renderQuestion(qi);
      }
    }, 100);
  }
  loadExam();
});