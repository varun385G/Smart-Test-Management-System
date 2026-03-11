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
      if (data.resultsPublished) {
        // Results published — show option to view result (and download PDF)
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

    // Fresh attempt
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