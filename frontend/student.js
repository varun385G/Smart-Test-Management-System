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
      msgBox.innerHTML = `<div style="background:var(--danger-light); color:#991b1b; padding:12px 16px; border-radius:10px; font-size:13.5px; text-align:center;">${data.message || 'Validation failed'}</div>`;
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

    // ── Fresh attempt — go to exam ────────────────────────────────
    localStorage.setItem('testId', testId);
    localStorage.setItem('studentName', name);
    localStorage.setItem('studentReg', reg);
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