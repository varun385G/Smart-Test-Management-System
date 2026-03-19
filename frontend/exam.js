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

let scheduledStartTime  = null;   // Date object if exam has a scheduled start
let waitingInterval     = null;   // countdown interval for waiting room

let lastViolationTime = 0;
const VIOLATION_COOLDOWN_MS = 1500;
const violationLog = [];

// ── SESSION TOKEN SECURITY ────────────────────
let _examSessionToken = sessionStorage.getItem('examToken') || localStorage.getItem('examToken');

let testId      = sessionStorage.getItem('testId');
let studentName = sessionStorage.getItem('studentName');
let studentReg  = sessionStorage.getItem('studentReg');

if (!testId || !studentReg) {
  testId      = localStorage.getItem('testId');
  studentName = localStorage.getItem('studentName');
  studentReg  = localStorage.getItem('studentReg');
  if (testId && studentReg) {
    sessionStorage.setItem('testId', testId);
    sessionStorage.setItem('studentName', studentName || '');
    sessionStorage.setItem('studentReg', studentReg);
  }
}

if (!testId || !studentReg) { location.href = '/'; }

let _tokenVerified = false;

async function _fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return r;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

async function verifySessionToken() {
  const isRefresh = sessionStorage.getItem('_examPageRefreshing') === '1';
  sessionStorage.removeItem('_examPageRefreshing');

  if (!_examSessionToken) {
    _examSessionToken = sessionStorage.getItem('examToken') || localStorage.getItem('examToken');
  }

  const hasLocalCreds = localStorage.getItem('testId') && localStorage.getItem('studentReg');
  if (!_examSessionToken && !hasLocalCreds && !isRefresh) {
    location.href = '/';
    return false;
  }

  if (!_examSessionToken) return true;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 600));
      const res = await _fetchWithTimeout('/api/student/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: _examSessionToken })
      }, 8000);

      if (!res.ok) continue;

      const d = await res.json();
      if (d.valid) return true;

      if (!hasLocalCreds && !isRefresh) {
        location.href = '/';
        return false;
      }
      return true;

    } catch (_) {
      // retry
    }
  }

  return true;
}

/* ── Security events ──────────────────────── */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) recordViolation('Tab switch detected');
});
let _contextMenuOpen = false;
document.addEventListener('contextmenu', e => {
  e.preventDefault();
  _contextMenuOpen = true;
  setTimeout(() => { _contextMenuOpen = false; }, 1500);
});
document.addEventListener('click',   () => { _contextMenuOpen = false; });
document.addEventListener('keydown',  e => {
  _contextMenuOpen = false;
  if (e.ctrlKey && ['c','v','x','a'].includes(e.key.toLowerCase())) {
    e.preventDefault(); recordViolation('Copy/paste attempt blocked');
  }
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
    e.preventDefault();
  }
});

window.addEventListener('blur', () => {
  if (_contextMenuOpen) return;
  recordViolation('Window focus lost');
});

window.addEventListener('pagehide', () => {
  if (examSubmitted || examLocked || !examStarted) return;
  sessionStorage.setItem('_examPageRefreshing', '1');
  try {
    const remapped = remapAnswers();
    const savePayload = JSON.stringify({ testId, studentName, studentReg, answers: remapped, remainingSeconds });
    navigator.sendBeacon('/api/exam/save-progress', new Blob([savePayload], { type: 'application/json' }));
  } catch (_) {}
});

window.addEventListener('beforeunload', e => {
  if (!examSubmitted && !examLocked && examStarted) { e.preventDefault(); e.returnValue = ''; }
});

history.pushState(null, '', location.href);
window.addEventListener('popstate', () => {
  history.pushState(null, '', location.href);
  recordViolation('Back button pressed');
});

function recordViolation(reason) {
  if (!examStarted) return;
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

/* ── Checkbox toggle ──────────────────────── */
function toggleStartBtn() {
  const cb  = document.getElementById('agreeCheckbox');
  const btn = document.getElementById('startExamBtn');
  const lbl = document.getElementById('agreeLabel');
  if (!btn) return;
  if (cb && cb.checked) {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor  = 'pointer';
    if (lbl) { lbl.style.borderColor = 'var(--primary)'; lbl.style.background = '#eff6ff'; }
  } else {
    btn.disabled = true;
    btn.style.opacity = '0.45';
    btn.style.cursor  = 'not-allowed';
    if (lbl) { lbl.style.borderColor = 'var(--border)'; lbl.style.background = 'var(--bg)'; }
  }
}

/* ── Waiting Room ─────────────────────────── */
function showWaitingRoom(scheduledStart, testTitle) {
  const wr = document.getElementById('waitingRoomScreen');
  const ds = document.getElementById('disclaimerScreen');
  if (ds) ds.style.display = 'none';
  if (wr) { wr.style.display = 'flex'; }

  const titleEl = document.getElementById('waitingRoomTitle');
  const timeEl  = document.getElementById('waitingScheduledTime');
  if (titleEl) titleEl.textContent = testTitle || 'Upcoming Exam';
  if (timeEl)  timeEl.textContent  = new Date(scheduledStart).toLocaleString('en-IN', {
    weekday:'long', year:'numeric', month:'long', day:'numeric',
    hour:'2-digit', minute:'2-digit'
  });

  clearInterval(waitingInterval);
  waitingInterval = setInterval(() => {
    const diff = new Date(scheduledStart) - new Date();
    if (diff <= 0) {
      clearInterval(waitingInterval);
      showExamLivePopup();
      return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const pad = n => String(n).padStart(2, '0');
    const cdH = document.getElementById('cdHours');
    const cdM = document.getElementById('cdMinutes');
    const cdS = document.getElementById('cdSeconds');
    if (cdH) cdH.textContent = pad(h);
    if (cdM) cdM.textContent = pad(m);
    if (cdS) cdS.textContent = pad(s);
  }, 1000);
}

function showExamLivePopup() {
  const wr = document.getElementById('waitingRoomScreen');
  const popup = document.getElementById('examLivePopup');
  if (wr) wr.style.display = 'none';
  if (popup) popup.style.display = 'flex';
}

function enterExamFromWaiting() {
  const popup = document.getElementById('examLivePopup');
  if (popup) popup.style.display = 'none';
  examStarted = true;
  localStorage.setItem('disclaimerSeen_' + testId, '1');
  function begin() {
    startTimer();
    autoSaveInterval = setInterval(autoSaveProgress, 10000);
    updateSubmitLock();
    renderQuestion(0);
  }
  if (examReady) { begin(); }
  else { const w = setInterval(() => { if (examReady) { clearInterval(w); begin(); } }, 100); }
}

/* ── Disclaimer 2-min countdown ──────────────── */
let _disclaimerCountdownInterval = null;

function showDisclaimerCountdown(scheduledStart) {
  clearInterval(_disclaimerCountdownInterval);

  const btn = document.getElementById('startExamBtn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.45'; btn.style.cursor = 'not-allowed'; }

  const footer = btn ? btn.parentElement : null;
  let cdBar = document.getElementById('disclaimerCdBar');
  if (!cdBar && footer) {
    cdBar = document.createElement('div');
    cdBar.id = 'disclaimerCdBar';
    cdBar.style.cssText = 'margin-bottom:14px; text-align:center;';
    footer.insertBefore(cdBar, btn);
  }

  function tick() {
    const diff = new Date(scheduledStart) - new Date();
    if (diff <= 0) {
      clearInterval(_disclaimerCountdownInterval);
      localStorage.removeItem('examScheduledStart');
      scheduledStartTime = null;
      if (cdBar) cdBar.innerHTML = `<div style="color:var(--success); font-weight:700; font-size:15px; padding:10px 0;">🟢 Exam is now live!</div>`;
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.background = '#16a34a';
        btn.textContent = '🚀 Start Exam Now →';
      }
      return;
    }
    const totalSecs = Math.floor(diff / 1000);
    const mm = Math.floor(totalSecs / 60);
    const ss = totalSecs % 60;
    const pad = n => String(n).padStart(2, '0');
    if (cdBar) {
      cdBar.innerHTML = `
        <div style="font-size:12px; color:var(--muted); margin-bottom:8px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Exam starts in</div>
        <div style="display:inline-flex; gap:10px; justify-content:center;">
          <div style="background:var(--bg); border:1.5px solid var(--border); border-radius:8px; padding:8px 14px; min-width:52px; text-align:center;">
            <div style="font-size:24px; font-weight:900; font-variant-numeric:tabular-nums; line-height:1; color:var(--primary);">${pad(mm)}</div>
            <div style="font-size:9px; color:var(--muted); text-transform:uppercase; margin-top:2px;">Min</div>
          </div>
          <div style="font-size:24px; font-weight:900; color:var(--muted); line-height:52px;">:</div>
          <div style="background:var(--bg); border:1.5px solid var(--border); border-radius:8px; padding:8px 14px; min-width:52px; text-align:center;">
            <div style="font-size:24px; font-weight:900; font-variant-numeric:tabular-nums; line-height:1; color:var(--primary);">${pad(ss)}</div>
            <div style="font-size:9px; color:var(--muted); text-transform:uppercase; margin-top:2px;">Sec</div>
          </div>
        </div>`;
    }
  }

  tick();
  _disclaimerCountdownInterval = setInterval(tick, 1000);
}

/* ── Lock Exam ────────────────────────────── */
async function lockExam() {
  if (examLocked || examSubmitted) return;
  examLocked = true;
  clearInterval(timerInterval);
  clearInterval(autoSaveInterval);
  clearInterval(elapsedInterval);

  const _unlockPoll = setInterval(async () => {
    if (!examLocked) { clearInterval(_unlockPoll); return; }
    try {
      const r = await fetch(`/api/exam/lock-status/${testId}/${studentReg}`);
      if (!r.ok) return;
      const d = await r.json();
      if (!d.isLocked && !d.isForceSubmitted) {
        clearInterval(_unlockPoll);
        examLocked = false;
        const overlay = document.getElementById('lockOverlay');
        if (overlay) overlay.remove();
        document.querySelectorAll('input, textarea, button').forEach(el => el.disabled = false);
        if (d.remainingSeconds && d.remainingSeconds > 0) {
          remainingSeconds = d.remainingSeconds;
        }
        startTimer();
        autoSaveInterval = setInterval(autoSaveProgress, 10000);
        updateSubmitLock();
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#10b981;color:#fff;padding:14px 20px;border-radius:10px;font-size:14px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.2);';
        toast.textContent = '✅ Your exam has been unlocked. You may continue.';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
      } else if (d.isForceSubmitted) {
        clearInterval(_unlockPoll);
        examLocked = false;
        showSubmittedScreen(true);
      }
    } catch (_) {}
  }, 5000);

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

  if (_examSessionToken) {
    try {
      fetch('/api/student/invalidate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: _examSessionToken })
      });
    } catch (_) {}
    sessionStorage.removeItem('examToken');
    localStorage.removeItem('examToken');
  }

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
  if (_examSessionToken) {
    try { fetch('/api/student/invalidate-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: _examSessionToken }) }); } catch (_) {}
    sessionStorage.removeItem('examToken');
    localStorage.removeItem('examToken');
  }
  const overlay = document.getElementById('lockOverlay');
  if (overlay) overlay.remove();
  showSubmittedScreen();
}

/* ── Auto-save every 10 seconds ──────────── */
async function autoSaveProgress() {
  if (examSubmitted || examLocked) return;
  try {
    const remapped = remapAnswers();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    await fetch('/api/exam/save-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId, studentName, studentReg, answers: remapped, remainingSeconds }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
  } catch (_) {}
}

function saveNow() {
  if (examSubmitted || examLocked) return;
  autoSaveProgress();
}

/* ══════════════════════════════════════════
   RENDER SINGLE QUESTION
══════════════════════════════════════════ */
function renderQuestion(qi) {
  currentIndex = qi;
  if (testId) localStorage.setItem('currentIndex_' + testId, qi);
  const q = questions[qi];
  const container = document.getElementById('examContainer');

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
          ? `<button class="btn-save-next" id="saveOnlyBtn" onclick="saveOnly(${qi})" style="${isAnswered(qi) ? 'background:var(--success);color:white;border-color:var(--success);' : ''}">Save</button>`
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
  saveNow();
}

function handleNAT(qi, input) {
  answers[qi] = input.value !== '' ? Number(input.value) : null;
  saveNow();
}

function saveOnly(qi) {
  const hasAnswer = isAnswered(qi);
  if (hasAnswer) {
    if (questionStatus[qi] !== 'review') questionStatus[qi] = 'answered';
  } else {
    questionStatus[qi] = 'skipped';
  }
  updateAllNavBtns();
  updateProgress();
  saveNow();
  const btn = document.getElementById('saveOnlyBtn');
  if (btn) {
    if (hasAnswer) {
      btn.style.background = 'var(--success)';
      btn.style.color = 'white';
      btn.style.borderColor = 'var(--success)';
    } else {
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }
  }
}

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
  }
}

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

function clearAnswer(qi) {
  const q = questions[qi];
  answers[qi] = q.type === 'MSQ' ? [] : null;
  questionStatus[qi] = 'skipped';
  updateAllNavBtns();
  updateProgress();
  saveNow();
  renderQuestion(qi);
}

function goToPrev() {
  if (currentIndex > 0) renderQuestion(currentIndex - 1);
}

function goToQuestion(qi) {
  renderQuestion(qi);
}

function isAnswered(qi) {
  const ans = answers[qi];
  if (Array.isArray(ans)) return ans.length > 0;
  return ans !== null && ans !== undefined && ans !== '';
}

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

function confirmSubmit() {
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

  localStorage.removeItem('disclaimerSeen_' + testId);
  localStorage.removeItem('currentIndex_' + testId);

  document.getElementById('confirmBox').classList.remove('open');

  const ovl = document.createElement('div');
  ovl.id = '_submitOvl';
  ovl.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(15,23,42,0.7);display:flex;align-items:center;justify-content:center;font-family:var(--font-main);';
  ovl.innerHTML = '<div style="background:var(--card);border-radius:16px;padding:36px 32px;text-align:center;max-width:300px;width:90%;"><div style="font-size:40px;margin-bottom:12px;">📤</div><div style="font-weight:700;font-size:16px;margin-bottom:6px;">Submitting your exam…</div><div style="color:var(--muted);font-size:13px;">Please do not close this tab.</div></div>';
  document.body.appendChild(ovl);

  const remapped = remapAnswers();
  let success = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('/api/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, studentName, studentReg, answers: remapped, violationLog })
      });
      if (res.ok) { success = true; break; }
    } catch (_) {
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000));
    }
  }
  if (_examSessionToken) {
    try {
      await fetch('/api/student/invalidate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: _examSessionToken })
      });
    } catch (_) {}
    sessionStorage.removeItem('examToken');
    localStorage.removeItem('examToken');
  }
  ovl.remove();
  showSubmittedScreen(success);
}

function showSubmittedScreen(success = true) {
  examSubmitted = true;
  document.body.innerHTML = `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg); font-family:var(--font-main); padding:20px;">
      <div style="width:100%; max-width:480px;">

        <div class="card" style="text-align:center; padding:32px; margin-bottom:20px;">
          <div style="font-size:56px; margin-bottom:16px;">${success ? '✅' : '⚠️'}</div>
          <h2 style="font-size:22px; margin-bottom:8px;">${success ? 'Exam Submitted!' : 'Submission Issue'}</h2>
          <p style="color:var(--muted); font-size:14px; margin-bottom:0;">
            ${success
              ? 'Your answers have been recorded.<br>Results will be available once published by your staff.'
              : 'There was a network error submitting your exam.<br><strong>Your answers were auto-saved.</strong><br>Please inform your invigilator immediately.'}
          </p>
        </div>

        ${success ? `
        <div class="card" style="padding:28px;" id="feedbackCard">
          <div style="font-size:15px; font-weight:800; margin-bottom:4px;">📝 Quick Feedback</div>
          <div style="font-size:13px; color:var(--muted); margin-bottom:20px;">Rate your experience (1 = Very Poor, 5 = Excellent)</div>

          ${[
            ['q1','Overall functionality of the examination software'],
            ['q2','Clarity and relevance of the questions'],
            ['q3','Support and guidance provided by staff'],
            ['q4','Overall experience with this online test system']
          ].map(([id, label]) => `
            <div style="margin-bottom:18px;">
              <div style="font-size:13.5px; font-weight:600; margin-bottom:8px; color:var(--text);">${label}</div>
              <div style="display:flex; gap:8px;">
                ${[1,2,3,4,5].map(n => `
                  <button type="button" onclick="selectRating('${id}',${n})" id="${id}_${n}"
                    style="width:40px;height:40px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg);font-weight:700;font-size:14px;cursor:pointer;transition:all 0.15s;"
                    onmouseover="this.style.borderColor='var(--primary)'"
                    onmouseout="if(!this.classList.contains('sel'))this.style.borderColor='var(--border)'">
                    ${n}
                  </button>`).join('')}
              </div>
            </div>`).join('')}

          <div style="margin-bottom:18px;">
            <label style="font-size:13.5px; font-weight:600; display:block; margin-bottom:8px; color:var(--text);">Suggestions (optional)</label>
            <textarea id="fbSuggestion" rows="3" placeholder="Any suggestions or comments…"
              style="width:100%; padding:10px 12px; border:1.5px solid var(--border); border-radius:10px; font-size:13.5px; font-family:var(--font-main); background:var(--bg); color:var(--text); resize:vertical; box-sizing:border-box;"></textarea>
          </div>

          <div id="fbMsg" style="font-size:13px; margin-bottom:10px; min-height:18px;"></div>
          <div style="display:flex; gap:10px;">
            <button onclick="submitFeedback()" class="btn btn-primary" style="flex:1;" id="fbSubmitBtn">Submit Feedback</button>
            <button onclick="skipFeedback()" class="btn" style="flex:0 0 auto;">Skip</button>
          </div>
        </div>
        ` : ''}

        <div id="returnHomeDiv" style="${success ? 'display:none;' : ''}">
          <button onclick="location.href='/'" class="btn btn-primary" style="width:100%;">Return to Home</button>
        </div>

      </div>
    </div>
  `;
}

const _fbRatings = {};

function selectRating(qid, val) {
  _fbRatings[qid] = val;
  for (let i = 1; i <= 5; i++) {
    const btn = document.getElementById(qid + '_' + i);
    if (!btn) continue;
    if (i <= val) {
      btn.classList.add('sel');
      btn.style.background = 'var(--primary)';
      btn.style.color = 'white';
      btn.style.borderColor = 'var(--primary)';
    } else {
      btn.classList.remove('sel');
      btn.style.background = 'var(--bg)';
      btn.style.color = '';
      btn.style.borderColor = 'var(--border)';
    }
  }
}

async function submitFeedback() {
  const required = ['q1','q2','q3','q4'];
  const missing = required.filter(q => !_fbRatings[q]);
  const msg = document.getElementById('fbMsg');
  if (missing.length) {
    msg.style.color = 'var(--danger)';
    msg.textContent = 'Please rate all 4 questions before submitting.';
    return;
  }
  const btn = document.getElementById('fbSubmitBtn');
  btn.disabled = true; btn.textContent = 'Submitting…';
  try {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testId, studentName, studentReg,
        q1: _fbRatings.q1, q2: _fbRatings.q2,
        q3: _fbRatings.q3, q4: _fbRatings.q4,
        suggestion: (document.getElementById('fbSuggestion') || {}).value || ''
      })
    });
  } catch (_) {}
  const card = document.getElementById('feedbackCard');
  if (card) card.innerHTML = '<div style="text-align:center;padding:20px;"><div style="font-size:32px;margin-bottom:8px;">🙏</div><div style="font-weight:700;">Thank you for your feedback!</div></div>';
  const ret = document.getElementById('returnHomeDiv');
  if (ret) { ret.style.display = 'block'; }
  setTimeout(() => { location.href = '/'; }, 2000);
}

function skipFeedback() {
  const card = document.getElementById('feedbackCard');
  if (card) card.style.display = 'none';
  const ret = document.getElementById('returnHomeDiv');
  if (ret) ret.style.display = 'block';
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

  const storedStart = localStorage.getItem('examScheduledStart');
  scheduledStartTime = storedStart || test.scheduledStart || null;

  const creditEl = document.getElementById('staffCreditText');
  if (creditEl) {
    if (test.createdBy) {
      try {
        const staffRes = await fetch(`/api/staff/name/${test.createdBy}`);
        if (staffRes.ok) {
          const staffData = await staffRes.json();
          creditEl.innerHTML = staffData.name
            ? `Test created by <strong>${staffData.name}</strong>`
            : `Test ID: <strong>${testId}</strong>`;
        }
      } catch (_) {
        creditEl.innerHTML = `Test ID: <strong>${testId}</strong>`;
      }
    } else {
      creditEl.innerHTML = `Test ID: <strong>${testId}</strong>`;
    }
  }

  const originalQuestions = test.questions || [];
  questions = test.shuffleQuestions !== false ? shuffleArray([...originalQuestions]) : [...originalQuestions];

  const _assignedOrigIdx = new Set();
  questions.forEach(q => {
    let idx = originalQuestions.findIndex((orig, i) =>
      !_assignedOrigIdx.has(i) &&
      orig.question === q.question &&
      orig.type === q.type &&
      (orig.marks || 1) === (q.marks || 1)
    );
    if (idx === -1) {
      idx = originalQuestions.findIndex((orig, i) =>
        !_assignedOrigIdx.has(i) &&
        orig.question === q.question &&
        orig.type === q.type
      );
    }
    q._origIdx = idx;
    if (idx !== -1) _assignedOrigIdx.add(idx);
    if ((q.type === 'MCQ' || q.type === 'MSQ') && test.shuffleOptions !== false) {
      q._shuffledOpts = shuffleArray(q.options.map((o, i) => ({ o, i })));
    } else {
      q._shuffledOpts = q.options ? q.options.map((o, i) => ({ o, i })) : [];
    }
  });

  totalDurationSeconds = (test.duration || 30) * 60;
  if (test.submitAfterMinutes) {
    submitAfterSeconds = test.submitAfterMinutes * 60;
  } else {
    submitAfterSeconds = null;
  }

  answers        = questions.map(q => q.type === 'MSQ' ? [] : null);
  questionStatus = questions.map(() => 'unvisited');

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

  if (lockData && lockData.remainingSeconds != null && lockData.remainingSeconds > 0) {
    remainingSeconds = lockData.remainingSeconds;
  } else {
    remainingSeconds = totalDurationSeconds;
  }

  document.getElementById('confirmTotal').textContent = questions.length;

  const hasNegative = questions.some(q => q.negativeMarkingEnabled && q.negativeMarks > 0);
  if (hasNegative) {
    const banner = document.getElementById('negativeMarkingBanner');
    if (banner) banner.style.display = 'flex';
  }

  buildNavigator();
  updateProgress();
  examReady = true;
}

/* ── Lock screen on refresh ───────────────── */
function renderLockScreenOnly(lockCode) {
  examLocked = true;
  clearInterval(timerInterval);
  document.querySelectorAll('input, textarea, button').forEach(el => el.disabled = true);

  const _unlockPoll2 = setInterval(async () => {
    if (!examLocked) { clearInterval(_unlockPoll2); return; }
    try {
      const r = await fetch(`/api/exam/lock-status/${testId}/${studentReg}`);
      if (!r.ok) return;
      const d = await r.json();
      if (!d.isLocked && !d.isForceSubmitted) {
        clearInterval(_unlockPoll2);
        const overlay2 = document.getElementById('lockOverlay');
        if (overlay2) overlay2.remove();
        document.body.innerHTML = `
          <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);font-family:var(--font-main);padding:20px;">
            <div class="card" style="text-align:center;padding:36px;max-width:420px;width:100%;">
              <div style="font-size:48px;margin-bottom:16px;">✅</div>
              <h3 style="margin-bottom:8px;color:var(--success);">Exam Unlocked!</h3>
              <p style="color:var(--muted);font-size:14px;margin-bottom:20px;">
                Your invigilator has unlocked your exam.<br>
                Please log in again to resume — your answers are saved.
              </p>
              <button class="btn btn-primary" style="width:100%;" onclick="location.href='/'">
                Go to Login →
              </button>
            </div>
          </div>`;
      } else if (d.isForceSubmitted) {
        clearInterval(_unlockPoll2);
        examLocked = false;
        showSubmittedScreen(true);
      }
    } catch (_) {}
  }, 5000);

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
  if (scheduledStartTime && new Date() < new Date(scheduledStartTime)) {
    showDisclaimerCountdown(scheduledStartTime);
    return;
  }

  examStarted = true;
  scheduledStartTime = null;
  localStorage.removeItem('examScheduledStart');
  localStorage.setItem('disclaimerSeen_' + testId, '1');
  const screen = document.getElementById('disclaimerScreen');
  if (screen) screen.style.display = 'none';

  function beginExam() {
    startTimer();
    autoSaveInterval = setInterval(autoSaveProgress, 10000);
    updateSubmitLock();
    renderQuestion(0);
  }

  if (examReady) {
    beginExam();
  } else {
    const wait = setInterval(() => {
      if (examReady) { clearInterval(wait); beginExam(); }
    }, 100);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const tokenOk = await verifySessionToken();
  if (!tokenOk) return;

  const alreadySeen = localStorage.getItem('disclaimerSeen_' + testId);
  if (alreadySeen) {
    const screen = document.getElementById('disclaimerScreen');
    if (screen) screen.style.display = 'none';
    examStarted = true;
    const wait = setInterval(() => {
      if (examReady) {
        clearInterval(wait);
        startTimer();
        autoSaveInterval = setInterval(autoSaveProgress, 10000);
        updateSubmitLock();
        const savedIdx = parseInt(localStorage.getItem('currentIndex_' + testId) || '0', 10);
        const qi = (savedIdx >= 0 && savedIdx < questions.length) ? savedIdx : 0;
        renderQuestion(qi);
      }
    }, 100);
  } else {
    const storedStart = localStorage.getItem('examScheduledStart');
    if (storedStart) {
      if (new Date(storedStart) > new Date()) {
        const wait = setInterval(() => {
          if (examReady) {
            clearInterval(wait);
            showDisclaimerCountdown(storedStart);
          }
        }, 100);
      } else {
        localStorage.removeItem('examScheduledStart');
        scheduledStartTime = null;
      }
    }
  }
  loadExam();
});