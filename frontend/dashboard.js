const role      = localStorage.getItem('staffRole');
const staffName = localStorage.getItem('staffName');
const staffId   = localStorage.getItem('staffId');

if (!role || !staffName) window.location.href = '/staff.html';

document.getElementById('staffName').innerText = 'Welcome, ' + staffName;
document.getElementById('staffRole').innerText  = role === 'admin' ? '🛡 Admin' : '👤 Staff';
document.getElementById('profileInitial').innerText = staffName ? staffName[0].toUpperCase() : '?';

if (role === 'admin') {
  document.querySelectorAll('.admin-only').forEach(e => e.style.display = '');
}

/* ── Profile dropdown ─────────────────────── */
function toggleProfileMenu() {
  const menu = document.getElementById('profileMenu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}
document.addEventListener('click', (e) => {
  if (!document.getElementById('profileBtn').contains(e.target)) {
    document.getElementById('profileMenu').style.display = 'none';
  }
});

/* ── Modal helpers ────────────────────────── */
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
['changeEmailModal','changePasswordModal','securityQuestionModal'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', function(e) {
    if (e.target === this) closeModal(id);
  });
});

/* ── Change Email ─────────────────────────── */
function openChangeEmail() {
  document.getElementById('profileMenu').style.display = 'none';
  document.getElementById('ceCurrentPw').value = '';
  document.getElementById('ceNewEmail').value = '';
  document.getElementById('ceMsg').innerText = '';
  document.getElementById('changeEmailModal').classList.add('open');
}
async function submitChangeEmail() {
  const currentPassword = document.getElementById('ceCurrentPw').value.trim();
  const newEmail        = document.getElementById('ceNewEmail').value.trim();
  const msg             = document.getElementById('ceMsg');
  msg.innerText = '';

  if (!currentPassword || !newEmail) {
    msg.style.color = 'var(--danger)'; msg.innerText = 'All fields required.'; return;
  }
  const btn = document.querySelector('#changeEmailModal .btn-primary');
  btn.disabled = true; btn.textContent = 'Updating...';
  try {
    const res = await fetch('/api/staff/update-credentials', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, currentPassword, newEmail })
    });
    const data = await res.json();
    if (res.ok) {
      msg.style.color = 'var(--success)';
      msg.innerText = 'Email updated! Please log in again.';
      setTimeout(() => { localStorage.clear(); window.location.href = '/staff.html'; }, 1500);
    } else {
      msg.style.color = 'var(--danger)'; msg.innerText = data.message || 'Failed.';
    }
  } catch { msg.style.color = 'var(--danger)'; msg.innerText = 'Network error.'; }
  finally { btn.disabled = false; btn.textContent = 'Update Email'; }
}

/* ── Change Password ──────────────────────── */
function openChangePassword() {
  document.getElementById('profileMenu').style.display = 'none';
  document.getElementById('cpCurrentPw').value = '';
  document.getElementById('cpNewPw').value = '';
  document.getElementById('cpConfirmPw').value = '';
  document.getElementById('cpMsg').innerText = '';
  document.getElementById('changePasswordModal').classList.add('open');
}
async function submitChangePassword() {
  const currentPassword = document.getElementById('cpCurrentPw').value.trim();
  const newPassword     = document.getElementById('cpNewPw').value.trim();
  const confirmPassword = document.getElementById('cpConfirmPw').value.trim();
  const msg             = document.getElementById('cpMsg');
  msg.innerText = '';

  if (!currentPassword || !newPassword || !confirmPassword) {
    msg.style.color = 'var(--danger)'; msg.innerText = 'All fields required.'; return;
  }
  if (newPassword !== confirmPassword) {
    msg.style.color = 'var(--danger)'; msg.innerText = 'New passwords do not match.'; return;
  }
  if (newPassword.length < 4) {
    msg.style.color = 'var(--danger)'; msg.innerText = 'Password must be at least 4 characters.'; return;
  }
  const btn = document.querySelector('#changePasswordModal .btn-primary');
  btn.disabled = true; btn.textContent = 'Updating...';
  try {
    const res = await fetch('/api/staff/update-credentials', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, currentPassword, newPassword })
    });
    const data = await res.json();
    if (res.ok) {
      msg.style.color = 'var(--success)';
      msg.innerText = 'Password updated! Please log in again.';
      setTimeout(() => { localStorage.clear(); window.location.href = '/staff.html'; }, 1500);
    } else {
      msg.style.color = 'var(--danger)'; msg.innerText = data.message || 'Failed.';
    }
  } catch { msg.style.color = 'var(--danger)'; msg.innerText = 'Network error.'; }
  finally { btn.disabled = false; btn.textContent = 'Update Password'; }
}

/* ── Load stats ───────────────────────────── */
async function loadStats() {
  const grid = document.getElementById('statsGrid');
  try {
    const [testsRes, resultsRes] = await Promise.all([
      fetch(`/api/tests/by-staff/${staffId}`),
      fetch(`/api/results/by-staff/${staffId}`)
    ]);

    const tests   = testsRes.ok   ? await testsRes.json()   : [];
    const results = resultsRes.ok ? await resultsRes.json() : [];

    const totalTests    = tests.length;
    const totalAttempts = tests.reduce((s, t) => s + (t.attempts || 0), 0);
    const published     = tests.filter(t => t.resultsPublished).length;
    const avgScore      = results.length
      ? (results.reduce((s, r) => s + (r.score / r.total * 100), 0) / results.length).toFixed(0)
      : 0;

    const stats = [
      { icon: '📋', label: 'Tests Created',    value: totalTests,    color: '#e0e7ff', accent: '#4f46e5' },
      { icon: '👥', label: 'Total Attempts',   value: totalAttempts, color: '#cffafe', accent: '#0891b2' },
      { icon: '✅', label: 'Results Published', value: published,     color: '#d1fae5', accent: '#059669' },
      { icon: '📊', label: 'Avg Score',         value: avgScore + '%',color: '#fef3c7', accent: '#d97706' },
    ];

    grid.innerHTML = stats.map(s => `
      <div class="stat-card">
        <div class="stat-icon" style="background:${s.color}; color:${s.accent};">${s.icon}</div>
        <div class="stat-value" style="color:${s.accent};">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>
    `).join('');

    const feed = document.getElementById('activityFeed');
    if (tests.length === 0) {
      feed.innerHTML = '<span>No activity yet. Create your first test!</span>';
      return;
    }
    const recent = [...tests].slice(0, 5);
    feed.innerHTML = recent.map(t => `
      <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border);">
        <div style="width:8px;height:8px;border-radius:50%;background:${t.resultsPublished ? 'var(--success)' : 'var(--primary)'};flex-shrink:0;"></div>
        <span style="font-size:13.5px; color:var(--text-2);">
          <strong>${t.title}</strong>
          <span style="color:var(--muted);"> — ${t.attempts} attempt${t.attempts !== 1 ? 's' : ''}</span>
          ${t.resultsPublished ? '<span class="badge badge-green" style="margin-left:8px; font-size:11px;">Published</span>' : ''}
        </span>
      </div>
    `).join('');

  } catch (err) {
    grid.innerHTML = '<div class="card" style="grid-column:1/-1; color:var(--muted); text-align:center;">Could not load stats</div>';
  }
}

loadStats();

/* ── Nav ──────────────────────────────────── */
function goToCreateTest()  { window.location.href = '/create-test.html'; }
function goToManageTests() { window.location.href = '/manage-tests.html'; }
function goToResults() {
  window.location.href = role === 'admin' ? '/admin-results.html' : '/results-dashboard.html';
}
function goCreateStaff() { window.location.href = '/create-staff.html'; }
function goManageStaff() { window.location.href = '/manage-staff.html'; }
function logout() {
  localStorage.clear();
  window.location.href = '/';
}
/* ── Security Question Setup ──────────────── */
function openSecurityQuestion() {
  document.getElementById('profileMenu').style.display = 'none';
  document.getElementById('sqCurrentPw').value = '';
  document.getElementById('sqQuestion').value = '';
  document.getElementById('sqAnswer').value = '';
  document.getElementById('sqMsg').textContent = '';
  document.getElementById('securityQuestionModal').classList.add('open');
}

async function submitSecurityQuestion() {
  const currentPassword    = document.getElementById('sqCurrentPw').value.trim();
  const securityQuestion   = document.getElementById('sqQuestion').value;
  const securityAnswer     = document.getElementById('sqAnswer').value.trim();
  const msg                = document.getElementById('sqMsg');
  msg.textContent = '';

  if (!currentPassword)  { msg.style.color = 'var(--danger)'; msg.textContent = 'Enter your current password.'; return; }
  if (!securityQuestion) { msg.style.color = 'var(--danger)'; msg.textContent = 'Please select a security question.'; return; }
  if (!securityAnswer)   { msg.style.color = 'var(--danger)'; msg.textContent = 'Please enter your answer.'; return; }

  const btn = document.querySelector('#securityQuestionModal .btn-primary');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    const res = await fetch('/api/staff/security-question/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, currentPassword, securityQuestion, securityAnswer })
    });
    const data = await res.json();
    if (res.ok) {
      msg.style.color = 'var(--success)';
      msg.textContent = '✅ Security question saved!';
      setTimeout(() => closeModal('securityQuestionModal'), 1500);
    } else {
      msg.style.color = 'var(--danger)';
      msg.textContent = data.message || 'Failed to save.';
    }
  } catch {
    msg.style.color = 'var(--danger)';
    msg.textContent = 'Network error. Try again.';
  } finally {
    btn.disabled = false; btn.textContent = 'Save Security Question';
  }
}