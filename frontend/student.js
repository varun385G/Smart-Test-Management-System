async function handleSubmit() {
  const testId   = document.getElementById('testId').value.trim().toUpperCase();
  const password = document.getElementById('password').value.trim();
  const reg      = document.getElementById('reg').value.trim();
  const name     = document.getElementById('name').value.trim();
  const msgBox   = document.getElementById('messageBox');
  const btn      = document.getElementById('submitBtn');

  if (!testId || !password || !reg || !name) {
    msgBox.innerHTML = `<p style="color:var(--danger); font-size:13.5px; text-align:center;">All fields are required</p>`;
    return;
  }

  if (!/^\d{13}$/.test(reg)) {
    msgBox.innerHTML = `<p style="color:var(--danger); font-size:13.5px; text-align:center;">Register Number must be exactly 13 digits (numbers only)</p>`;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Verifying…';
  msgBox.innerHTML = '';

  try {
    const res  = await fetch('/api/student/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId, password, reg })
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 403 && data.scheduledStart) {
        showNotStartedCountdown(data.scheduledStart);
        return;
      }
      if (res.status === 403 && data.scheduledEnd) {
        // Issue 5 fix: if window just closed within 90s, student validated in time but server was slow (50+ concurrent users)
        const endedSecondsAgo = (new Date() - new Date(data.scheduledEnd)) / 1000;
        if (endedSecondsAgo <= 90) {
          sessionStorage.setItem('testId', testId);
          sessionStorage.setItem('studentName', name);
          sessionStorage.setItem('studentReg', reg);
          localStorage.setItem('testId', testId);
          localStorage.setItem('studentName', name);
          localStorage.setItem('studentReg', reg);
          localStorage.removeItem('examScheduledStart');
          try {
            const tokenRes = await fetch('/api/student/issue-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ testId, studentReg: reg, studentName: name })
            });
            if (tokenRes.ok) {
              const tokenData = await tokenRes.json();
              sessionStorage.setItem('examToken', tokenData.token);
              localStorage.setItem('examToken', tokenData.token);
            }
          } catch (_) {}
          location.href = '/exam.html';
          return;
        }
        const endTime = new Date(data.scheduledEnd).toLocaleString();
        msgBox.innerHTML = `<div class="card" style="text-align:center; padding:20px; border-color:var(--danger);"><div style="font-size:36px; margin-bottom:8px;">🔒</div><div style="font-weight:700; margin-bottom:6px; color:var(--danger);">Exam Window Closed</div><div style="color:var(--muted); font-size:13.5px;">This exam ended on<br><strong>${endTime}</strong><br><span style="font-size:12px; margin-top:6px; display:block;">If you already attempted this exam, contact your staff to view your result.</span></div></div>`;
        return;
      }
      msgBox.innerHTML = `<div style="background:var(--danger-light); color:#991b1b; padding:12px 16px; border-radius:10px; font-size:13.5px; text-align:center;">${data.message || 'Validation failed'}</div>`;
      return;
    }

    // ── UNLOCKED RESUME: staff unlocked after malpractice ──────────
    // canResume=true means exam was in progress and staff allowed student back in
    if (data.canResume) {
      sessionStorage.setItem('testId', testId);
      sessionStorage.setItem('studentName', name);
      sessionStorage.setItem('studentReg', reg);
      localStorage.setItem('testId', testId);
      localStorage.setItem('studentName', name);
      localStorage.setItem('studentReg', reg);
      localStorage.removeItem('examScheduledStart');
      // Issue a fresh token for re-entry
      try {
        const tokenRes = await fetch('/api/student/issue-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testId, studentReg: reg, studentName: name })
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          sessionStorage.setItem('examToken', tokenData.token);
          localStorage.setItem('examToken', tokenData.token);
        }
      } catch (_) {}
      msgBox.innerHTML = `
        <div class="card" style="text-align:center; padding:20px; border-color:var(--success); border-width:2px;">
          <div style="font-size:32px; margin-bottom:8px;">✅</div>
          <div style="font-weight:800; color:var(--success); margin-bottom:4px;">Exam Unlocked!</div>
          <div style="color:var(--muted); font-size:13px;">Your invigilator has unlocked your exam.<br>Resuming now…</div>
        </div>`;
      setTimeout(() => { location.href = '/exam.html'; }, 1200);
      return;
    }

    if (data.attempted) {
      // ── LOCKED: show invigilator screen ──────────────────────────
      if (data.isLocked) {
        const violationRows = (data.violationLog || []).map((v, i) => `
          <div style="font-size:12.5px; color:#7f1d1d; padding:4px 0; border-bottom:1px solid #fecaca; display:flex; justify-content:space-between;">
            <span><strong>${i+1}.</strong> ${v.reason}</span>
            <span style="color:#9ca3af; font-size:11px;">${new Date(v.timestamp).toLocaleTimeString()}</span>
          </div>
        `).join('');

        msgBox.innerHTML = `
          <div class="card" style="border:2px solid #ef4444; padding:24px; text-align:center;">
            <div style="font-size:48px; margin-bottom:12px;">🔒</div>
            <h3 style="color:#dc2626; margin-bottom:6px;">Your Exam is Locked</h3>
            <p style="color:var(--muted); font-size:13px; margin-bottom:16px;">
              Your exam was locked due to malpractice violations.<br>
              <strong>Show this screen to your invigilator</strong> to unlock or submit.
            </p>
            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:14px; margin-bottom:16px; text-align:left;">
              <div style="font-size:11px; font-weight:700; color:#dc2626; text-transform:uppercase; margin-bottom:8px;">Violation Log</div>
              ${violationRows || '<div style="color:var(--muted); font-size:13px;">No violation details available</div>'}
            </div>
            <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 14px; margin-bottom:16px; font-size:13px; color:#92400e;">
              Only the staff who created this test can unlock your exam or force-submit it.
            </div>
            <button class="btn" style="width:100%;" onclick="location.href='/'">Back to Home</button>
          </div>
        `;
        return;
      }

      // ── FORCE SUBMITTED by staff ──────────────────────────────────
      if (data.isForceSubmitted) {
        msgBox.innerHTML = `
          <div class="card" style="border:2px solid #f59e0b; padding:24px; text-align:center;">
            <div style="font-size:48px; margin-bottom:12px;">📤</div>
            <h3 style="color:#92400e; margin-bottom:6px;">Exam Submitted by Invigilator</h3>
            <p style="color:var(--muted); font-size:13px; margin-bottom:16px;">
              Your exam was force-submitted by your invigilator.<br>
              ${data.resultsPublished
                ? 'Results have been published — you can view your result below.'
                : 'Results will be available once published by your staff.'}
            </p>
            ${data.resultsPublished ? `
              <button class="btn btn-primary" style="width:100%; margin-bottom:8px;"
                      onclick="viewResult('${testId}','${reg}')">
                📊 View My Result & Download PDF
              </button>
            ` : ''}
            <button class="btn" style="width:100%;" onclick="location.href='/'">Back to Home</button>
          </div>
        `;
        return;
      }

      // ── ATTEMPTED normally (not locked, not force-submitted) ──────
      if (data.resultsPublished) {
        msgBox.innerHTML = `
          <div class="card" style="text-align:center; padding:20px; border-color:var(--success);">
            <div style="font-size:28px; margin-bottom:8px;">✅</div>
            <div style="font-weight:700; margin-bottom:4px;">You've already attempted this exam</div>
            <div style="color:var(--muted); font-size:13px; margin-bottom:16px;">Results have been published!</div>
            <button class="btn btn-primary" style="width:100%; margin-bottom:8px;"
                    onclick="viewResult('${testId}','${reg}')">
              📊 View My Result & Download PDF
            </button>
            <button class="btn" style="width:100%;" onclick="location.href='/'">Back to Home</button>
          </div>
        `;
      } else {
        msgBox.innerHTML = `
          <div class="card" style="text-align:center; padding:20px; border-color:var(--warning);">
            <div style="font-size:28px; margin-bottom:8px;">⏳</div>
            <div style="font-weight:700; margin-bottom:4px;">Exam Already Attempted</div>
            <div style="color:var(--muted); font-size:13px; margin-bottom:16px;">Results have not been published yet. Check back later.</div>
            <button class="btn" style="width:100%;" onclick="location.href='/'">Back to Home</button>
          </div>
        `;
      }
      return;
    }

    // ── Fresh attempt ────────────────────────────────────────────
    // Store in BOTH sessionStorage (tab-isolated, primary) and localStorage (fallback for refresh)
    sessionStorage.setItem('testId', testId);
    sessionStorage.setItem('studentName', name);
    sessionStorage.setItem('studentReg', reg);
    localStorage.setItem('testId', testId);
    localStorage.setItem('studentName', name);
    localStorage.setItem('studentReg', reg);

    // ── Issue 1: Issue a server session token so exam.html can't be opened by direct URL ──
    // This runs in parallel — non-blocking. Token is stored before redirect.
    try {
      const tokenRes = await fetch('/api/student/issue-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, studentReg: reg, studentName: name })
      });
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        sessionStorage.setItem('examToken', tokenData.token);
        localStorage.setItem('examToken', tokenData.token);
      }
    } catch (_) { /* non-critical — exam still loads but URL direct-access blocked */ }

    // If scheduledStart is still more than 2 mins away — show countdown on login page
    // Auto-redirect happens when 2-min mark is reached (disclaimer shows those 2 mins)
    if (data.scheduledStart) {
      const minsLeft = (new Date(data.scheduledStart) - new Date()) / 60000;
      if (minsLeft > 0) {
        // Any future time — show countdown (auto-redirects at 2-min mark)
        showNotStartedCountdown(data.scheduledStart);
        return;
      }
    }

    localStorage.removeItem('examScheduledStart');
    location.href = '/exam.html';

  } catch (err) {
    msgBox.innerHTML = `<div style="background:var(--danger-light); color:#991b1b; padding:12px 16px; border-radius:10px; font-size:13.5px; text-align:center;">Server error. Please try again.</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enter Exam →';
  }
}

function viewResult(testId, reg) {
  location.href = `/student-result.html?testId=${testId}&reg=${reg}`;
}

// Allow Enter key
document.addEventListener('keydown', e => { if (e.key === 'Enter') handleSubmit(); });
/* ── Not-started countdown (shown when > 7 mins away) ── */

/* ── Pre-exam countdown on login page (credentials verified, waiting for start time) ── */
let _preExamInterval = null;

function showPreExamCountdown(scheduledStart) {
  clearInterval(_preExamInterval);
  const btn = document.getElementById('submitBtn');
  const pad = n => String(n).padStart(2, '0');
  if (btn) { btn.disabled = true; btn.textContent = 'Waiting for exam…'; }

  const startStr = new Date(scheduledStart).toLocaleString('en-IN', {
    weekday:'short', day:'2-digit', month:'short',
    hour:'2-digit', minute:'2-digit', hour12:true
  });

  function tick() {
    const diff = new Date(scheduledStart) - new Date();

    if (diff <= 0) {
      // Time is up — redirect to exam page now
      clearInterval(_preExamInterval);
      msgBoxEl().innerHTML = `
        <div class="card" style="text-align:center; padding:20px; border-color:var(--success); border-width:2px;">
          <div style="font-size:32px; margin-bottom:8px;">🚀</div>
          <div style="font-weight:800; font-size:15px; color:var(--success); margin-bottom:4px;">Exam has started!</div>
          <div style="color:var(--muted); font-size:13px;">Taking you to the exam now…</div>
        </div>`;
      _ensureSessionCreds();
      setTimeout(() => { location.href = '/exam.html'; }, 1200);
      return;
    }

    const totalSecs = Math.floor(diff / 1000);
    const hh = Math.floor(totalSecs / 3600);
    const mm = Math.floor((totalSecs % 3600) / 60);
    const ss = totalSecs % 60;

    // Update only numbers if already rendered
    const phaseEl = document.getElementById('_prePhase');
    if (phaseEl) {
      const hhEl = document.getElementById('_preHH');
      const mmEl = document.getElementById('_preMM');
      const ssEl = document.getElementById('_preSS');
      if (hhEl) hhEl.textContent = pad(hh);
      if (mmEl) mmEl.textContent = pad(mm);
      if (ssEl) ssEl.textContent = pad(ss);
      return;
    }

    // First render
    const hoursBlock = hh > 0 ? `
      <div style="background:var(--bg); border:1.5px solid var(--border); border-radius:10px; padding:10px 16px; min-width:60px; text-align:center;">
        <div style="font-size:26px; font-weight:900; font-variant-numeric:tabular-nums; line-height:1;" id="_preHH">${pad(hh)}</div>
        <div style="font-size:9px; color:var(--muted); text-transform:uppercase; margin-top:2px;">Hrs</div>
      </div>
      <div style="font-size:22px; font-weight:900; color:var(--muted); padding-top:6px;">:</div>` : '';

    msgBoxEl().innerHTML = `
      <div class="card" style="padding:24px; text-align:center; border-color:#4f46e5; border-width:2px;">

        <div style="display:inline-flex; align-items:center; gap:8px; background:#ede9fe; border-radius:20px; padding:6px 14px; margin-bottom:14px;">
          <span style="font-size:16px;">✅</span>
          <span style="font-size:13px; font-weight:700; color:#4f46e5;">Credentials Verified</span>
        </div>

        <div style="font-weight:800; font-size:16px; margin-bottom:4px;">Exam Starts In</div>
        <div style="color:var(--muted); font-size:12.5px; margin-bottom:18px;">
          Scheduled: <strong>${startStr}</strong>
        </div>

        <div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-bottom:16px;">
          ${hoursBlock}
          <div style="background:var(--bg); border:1.5px solid var(--border); border-radius:10px; padding:10px 16px; min-width:60px; text-align:center;">
            <div style="font-size:26px; font-weight:900; font-variant-numeric:tabular-nums; line-height:1;" id="_preMM">${pad(mm)}</div>
            <div style="font-size:9px; color:var(--muted); text-transform:uppercase; margin-top:2px;">Min</div>
          </div>
          <div style="font-size:22px; font-weight:900; color:var(--muted); padding-top:6px;">:</div>
          <div style="background:var(--bg); border:1.5px solid var(--border); border-radius:10px; padding:10px 16px; min-width:60px; text-align:center;">
            <div style="font-size:26px; font-weight:900; font-variant-numeric:tabular-nums; line-height:1;" id="_preSS">${pad(ss)}</div>
            <div style="font-size:9px; color:var(--muted); text-transform:uppercase; margin-top:2px;">Sec</div>
          </div>
        </div>

        <div id="_prePhase" style="font-size:12px; color:var(--muted); line-height:1.6;">
          You will be automatically taken to the exam when the timer reaches zero.<br>
          Please keep this tab open and stay on this page.
        </div>
      </div>`;
  }

  tick();
  _preExamInterval = setInterval(tick, 1000);
}

let _notStartedInterval = null;

function showNotStartedCountdown(scheduledStart) {
  clearInterval(_notStartedInterval);
  const btn = document.getElementById('submitBtn');
  const pad = n => String(n).padStart(2, '0');

  // Unlock = 2 mins before exam start (disclaimer shows for those 2 mins)
  const UNLOCK_MINS = 2;
  const unlockTime = new Date(new Date(scheduledStart) - UNLOCK_MINS * 60000);
  const startStr   = new Date(scheduledStart).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
  const unlockStr  = unlockTime.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });

  // Disable button — student should NOT click, auto-redirect will happen
  if (btn) { btn.disabled = true; btn.textContent = 'Waiting…'; }

  function tick() {
    const now           = new Date();
    const diffToUnlock  = unlockTime - now;
    const diffToStart   = new Date(scheduledStart) - now;

    if (diffToStart <= 0) {
      // Exam already started — redirect now
      clearInterval(_notStartedInterval);
      localStorage.setItem('examScheduledStart', scheduledStart);
      _ensureSessionCreds();
      msgBoxEl().innerHTML = `
        <div class="card" style="text-align:center; padding:16px; border-color:var(--success); border-width:2px;">
          <div style="font-size:28px; margin-bottom:6px;">🚀</div>
          <div style="font-weight:700; color:var(--success);">Exam has started! Redirecting…</div>
        </div>`;
      setTimeout(() => { location.href = '/exam.html'; }, 800);
      return;
    }

    if (diffToUnlock <= 0) {
      // 2-min window reached — auto redirect to disclaimer page
      clearInterval(_notStartedInterval);
      localStorage.setItem('examScheduledStart', scheduledStart);
      _ensureSessionCreds();
      msgBoxEl().innerHTML = `
        <div class="card" style="text-align:center; padding:20px; border-color:#4f46e5; border-width:2px;">
          <div style="font-size:32px; margin-bottom:8px;">📋</div>
          <div style="font-weight:800; font-size:15px; color:#4f46e5; margin-bottom:4px;">Taking you to instructions…</div>
          <div style="color:var(--muted); font-size:13px;">Exam starts at <strong>${startStr}</strong></div>
        </div>`;
      setTimeout(() => { location.href = '/exam.html'; }, 1000);
      return;
    }

    // Still in Phase 1 — count down to unlock time
    const totalSecs = Math.floor(diffToUnlock / 1000);
    const hh = Math.floor(totalSecs / 3600);
    const mm = Math.floor((totalSecs % 3600) / 60);
    const ss = totalSecs % 60;

    // Update numbers only if already rendered
    const phaseEl = document.getElementById('_cdPhase');
    if (phaseEl && phaseEl.dataset.phase === '1') {
      if (hh > 0) { const el = document.getElementById('_preHH'); if (el) el.textContent = pad(hh); }
      const mmEl = document.getElementById('_cdMM'); if (mmEl) mmEl.textContent = pad(mm);
      const ssEl = document.getElementById('_cdSS'); if (ssEl) ssEl.textContent = pad(ss);
      return;
    }

    const hoursBlock = hh > 0 ? `
      <div style="background:var(--bg); border:1.5px solid var(--border); border-radius:10px; padding:10px 16px; min-width:60px; text-align:center;">
        <div style="font-size:26px; font-weight:900; font-variant-numeric:tabular-nums; line-height:1;" id="_preHH">${pad(hh)}</div>
        <div style="font-size:9px; color:var(--muted); text-transform:uppercase; margin-top:2px;">Hrs</div>
      </div>
      <div style="font-size:22px; font-weight:900; color:var(--muted); padding-top:6px;">:</div>` : '';

    if (btn) { btn.disabled = true; btn.textContent = 'Waiting…'; }
    msgBoxEl().innerHTML = `
      <div class="card" style="text-align:center; padding:24px; border-color:var(--warning);">
        <div style="font-size:36px; margin-bottom:10px;">⏰</div>
        <div style="font-weight:800; font-size:16px; margin-bottom:4px;">Exam Not Started Yet</div>
        <div style="color:var(--muted); font-size:12.5px; margin-bottom:18px;">
          Exam starts at <strong>${startStr}</strong>
        </div>
        <div style="font-size:11px; color:var(--muted); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">You will be redirected to instructions in</div>
        <div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-bottom:14px;">
          ${hoursBlock}
          <div style="background:var(--bg); border:1.5px solid var(--border); border-radius:10px; padding:10px 16px; min-width:60px; text-align:center;">
            <div style="font-size:26px; font-weight:900; font-variant-numeric:tabular-nums; line-height:1;" id="_cdMM">${pad(mm)}</div>
            <div style="font-size:9px; color:var(--muted); text-transform:uppercase; margin-top:2px;">Min</div>
          </div>
          <div style="font-size:22px; font-weight:900; color:var(--muted); padding-top:6px;">:</div>
          <div style="background:var(--bg); border:1.5px solid var(--border); border-radius:10px; padding:10px 16px; min-width:60px; text-align:center;">
            <div style="font-size:26px; font-weight:900; font-variant-numeric:tabular-nums; line-height:1;" id="_cdSS">${pad(ss)}</div>
            <div style="font-size:9px; color:var(--muted); text-transform:uppercase; margin-top:2px;">Sec</div>
          </div>
        </div>
        <div id="_cdPhase" data-phase="1" style="font-size:12px; color:var(--muted); line-height:1.6;">
          You will be automatically taken to the instructions page 2 minutes before the exam starts.<br>
          Please keep this tab open.
        </div>
      </div>`;
  }

  tick();
  _notStartedInterval = setInterval(tick, 1000);
}

function msgBoxEl() { return document.getElementById('messageBox'); }
/* ── Ensure session credentials are set before redirecting ── */
function _ensureSessionCreds() {
  const tid   = localStorage.getItem('testId');
  const name  = localStorage.getItem('studentName');
  const reg   = localStorage.getItem('studentReg');
  const token = localStorage.getItem('examToken');
  if (tid)   sessionStorage.setItem('testId', tid);
  if (name)  sessionStorage.setItem('studentName', name);
  if (reg)   sessionStorage.setItem('studentReg', reg);
  if (token) sessionStorage.setItem('examToken', token);
}