const role      = localStorage.getItem('staffRole');
const staffName = localStorage.getItem('staffName');
const staffId   = localStorage.getItem('staffId');

if (!role || !staffName) window.location.href = '/staff.html';

document.getElementById('staffName').innerText = 'Welcome, ' + staffName;
document.getElementById('staffRole').innerText  = role === 'admin' ? '🛡 Admin' : '👤 Staff';

if (role === 'admin') {
  document.querySelectorAll('.admin-only').forEach(e => e.style.display = '');
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

    /* Activity feed */
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