/* ── state ─────────────────────────────── */
let currentTestId    = null;
let currentTestTitle = 'Results';
let currentResults   = [];
const staffId        = sessionStorage.getItem('staffId') || '';

/* ── load ───────────────────────────────── */
async function loadResults() {
  currentTestId = new URLSearchParams(window.location.search).get('testId');
  const tbody = document.getElementById('results');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--muted);">Loading results...</td></tr>`;

  try {
    // Use staff endpoint — no publish gate, staff always see results
    const res = await fetch(`/api/results/staff/${currentTestId}`);
    if (!res.ok) throw new Error();

    const data = await res.json();
    currentResults = data;

    // Get test title
    try {
      const tr = await fetch(`/api/tests/${currentTestId}`);
      if (tr.ok) {
        const t = await tr.json();
        currentTestTitle = t.title || currentTestId;
        const meta = document.getElementById('testMeta');
        if (meta) meta.textContent = `Test: ${currentTestTitle} (${currentTestId})`;
      }
    } catch (_) {}

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--muted);">No attempts yet</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    // Sort by score descending for rank
    const sorted = [...data].filter(r => !r.isLocked).sort((a, b) => b.score - a.score);

    data.forEach(r => {
      const rank = sorted.findIndex(x => x.studentReg === r.studentReg) + 1;
      const rankDisplay = r.isLocked ? '—' : (rank > 0 ? `#${rank}` : '—');

      const lockedBadge = r.isLocked
        ? `<span class="badge" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; font-size:11px;">🔒 Locked</span>`
        : r.isForceSubmitted
        ? `<span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fcd34d; font-size:11px;">📤 Force Submitted</span>`
        : '';
      const violationsBadge = r.violationLog && r.violationLog.length
        ? `<span class="badge badge-orange" style="font-size:11px;" title="${r.violationLog.map(v=>v.reason).join(', ')}">⚠ ${r.violationLog.length} violation${r.violationLog.length>1?'s':''}</span>`
        : '';

      const pct = r.total ? ((r.score / r.total) * 100).toFixed(1) : '0.0';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${r.studentName}<br><span style="font-size:11px; color:var(--muted);">${r.studentReg}</span></td>
        <td style="text-align:center; font-weight:700; color:var(--primary);">${rankDisplay}</td>
        <td>${r.score} / ${r.total} <span style="color:var(--muted); font-size:12px;">(${pct}%)</span> ${lockedBadge} ${violationsBadge}</td>
        <td style="text-align:center;">
          <button class="btn" style="font-size:11px; padding:4px 10px; color:#dc2626; border-color:#fecaca; background:#fff5f5;"
            onclick="deleteAttempt('${currentTestId}','${r.studentReg}','${r.studentName}', this)">
            🗑 Delete
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

    document.getElementById('btnDownload').disabled = false;

    // Load analytics
    loadAnalytics();

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#dc2626;">Error loading results</td></tr>`;
  }
}

/* ── Analytics ───────────────────────────── */
async function loadAnalytics() {
  const container = document.getElementById('analyticsContainer');
  if (!container) return;

  try {
    const res = await fetch(`/api/results/analytics/${currentTestId}`);
    if (!res.ok) return;
    const data = await res.json();

    if (!data.analytics || !data.analytics.length) {
      container.innerHTML = '<p style="color:var(--muted); text-align:center;">No analytics yet</p>';
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom:12px; font-size:13px; color:var(--muted);">
        Based on <strong>${data.totalStudents}</strong> submitted attempt${data.totalStudents !== 1 ? 's' : ''}
      </div>
      ${data.analytics.map((q, i) => {
        const total = data.totalStudents || 1;
        const correctPct    = Math.round((q.correct    / total) * 100);
        const wrongPct      = Math.round((q.wrong      / total) * 100);
        const partialPct    = Math.round(((q.partial||0) / total) * 100);
        const unattemptPct  = Math.round((q.unattempted / total) * 100);

        const difficulty = correctPct >= 70 ? { label: 'Easy', color: '#10b981' }
          : correctPct >= 40 ? { label: 'Medium', color: '#f59e0b' }
          : { label: 'Hard', color: '#ef4444' };

        const typeBadge = q.type === 'MCQ' ? 'badge-blue' : q.type === 'MSQ' ? 'badge-purple' : 'badge-orange';

        return `
          <div style="background:var(--bg); border-radius:12px; padding:14px 16px; margin-bottom:10px; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
              <div style="flex:1; min-width:0;">
                <span style="font-size:11px; font-weight:700; color:var(--muted);">Q${i+1}</span>
                <span class="badge ${typeBadge}" style="margin-left:6px; font-size:10px;">${q.type}</span>
                <span class="badge badge-gray" style="margin-left:4px; font-size:10px;">${q.marks} mark${q.marks!==1?'s':''}</span>
                <div style="font-size:13.5px; font-weight:600; margin-top:4px; color:var(--text);">${q.question}</div>
              </div>
              <div style="text-align:right; flex-shrink:0;">
                <span style="font-size:11px; font-weight:700; color:${difficulty.color}; background:${difficulty.color}20; padding:2px 8px; border-radius:20px;">${difficulty.label}</span>
                <div style="font-size:18px; font-weight:800; color:${difficulty.color}; margin-top:2px;">${correctPct}% correct</div>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px; font-size:12px; text-align:center;">
              <div style="background:#d1fae5; border-radius:8px; padding:6px;">
                <div style="font-weight:800; font-size:16px; color:#059669;">${q.correct}</div>
                <div style="color:#065f46;">Correct</div>
              </div>
              <div style="background:#fee2e2; border-radius:8px; padding:6px;">
                <div style="font-weight:800; font-size:16px; color:#dc2626;">${q.wrong}</div>
                <div style="color:#991b1b;">Wrong</div>
              </div>
              ${q.type === 'MSQ' ? `
              <div style="background:#fef3c7; border-radius:8px; padding:6px;">
                <div style="font-weight:800; font-size:16px; color:#d97706;">${q.partial||0}</div>
                <div style="color:#92400e;">Partial</div>
              </div>` : `<div></div>`}
              <div style="background:#f1f5f9; border-radius:8px; padding:6px;">
                <div style="font-weight:800; font-size:16px; color:#64748b;">${q.unattempted}</div>
                <div style="color:#475569;">Skipped</div>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    `;
  } catch (_) {}
}

/* ── excel download ─────────────────────── */
function downloadExcel() {
  if (!currentResults.length) return;
  const rows = currentResults.map((r, i) => ({
    '#'           : i + 1,
    'Student Name': r.studentName,
    'Register No' : r.studentReg,
    'Score'       : r.score,
    'Total'       : r.total,
    'Percentage'  : r.total ? ((r.score / r.total) * 100).toFixed(1) + '%' : 'N/A',
    'Status'      : r.isLocked ? 'Locked' : r.isForceSubmitted ? 'Force Submitted' : 'Submitted'
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch:5 },{ wch:25 },{ wch:16 },{ wch:8 },{ wch:8 },{ wch:12 },{ wch:12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Results');
  XLSX.writeFile(wb, `${currentTestTitle}_Results.xlsx`);
}

/* ── pdf download ───────────────────────── */
function downloadPdf() {
  if (!currentResults.length) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${currentTestTitle} – Results Report`, 14, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Test ID: ${currentTestId}   |   Generated: ${new Date().toLocaleString()}`, 14, 26);
  doc.setTextColor(0);

  const submitted = currentResults.filter(r => !r.isLocked);
  const scores = submitted.map(r => r.score);
  const avg  = scores.length ? (scores.reduce((a,b)=>a+b,0) / scores.length).toFixed(1) : 0;
  const maxS = scores.length ? Math.max(...scores) : 0;
  const minS = scores.length ? Math.min(...scores) : 0;
  doc.setFontSize(10);
  doc.text(`Total: ${currentResults.length}  Submitted: ${submitted.length}  Avg: ${avg}  High: ${maxS}  Low: ${minS}`, 14, 34);

  doc.autoTable({
    startY: 40,
    head: [['#', 'Student Name', 'Register No', 'Score', 'Total', '%', 'Status']],
    body: currentResults.map((r, i) => [
      i + 1, r.studentName, r.studentReg, r.score, r.total,
      r.total ? ((r.score / r.total) * 100).toFixed(1) + '%' : 'N/A',
      r.isLocked ? 'Locked' : r.isForceSubmitted ? 'Force Submitted' : 'Submitted'
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 246, 255] },
    columnStyles: { 0:{cellWidth:10}, 1:{cellWidth:50}, 2:{cellWidth:30}, 3:{cellWidth:15,halign:'center'}, 4:{cellWidth:15,halign:'center'}, 5:{cellWidth:22,halign:'center'}, 6:{cellWidth:22,halign:'center'} }
  });

  doc.save(`${currentTestTitle}_Results.pdf`);
}

/* ── nav ────────────────────────────────── */
function goDashboard() { window.location.href = '/dashboard.html'; }

loadResults();
function toggleResultsDropdown(btn) {
  const dd = document.getElementById('resultsDlDropdown');
  dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
}
document.addEventListener('click', e => {
  if (!e.target.closest('[onclick*="toggleResultsDropdown"]')) {
    const dd = document.getElementById('resultsDlDropdown');
    if (dd) dd.style.display = 'none';
  }
});
/* ── Issue 3: Staff Delete Student Attempt ──────────────────────────── */
async function deleteAttempt(testId, studentReg, studentName, btn) {
  const confirmed = confirm(
    `Delete attempt for "${studentName}" (${studentReg})?\n\n` +
    `This will permanently remove their result and allow them to re-attempt using the same Registration ID.`
  );
  if (!confirmed) return;

  btn.disabled = true;
  btn.textContent = 'Deleting…';

  try {
    const res = await fetch(`/api/results/${testId}/${encodeURIComponent(studentReg)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: staffId })
    });
    const data = await res.json();
    if (res.ok) {
      // Remove the row from the table
      btn.closest('tr').remove();
      // Show a brief success notice
      const notice = document.createElement('div');
      notice.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#10b981;color:#fff;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.15);';
      notice.textContent = `✅ ${studentName}'s attempt deleted. They can now re-attempt.`;
      document.body.appendChild(notice);
      setTimeout(() => notice.remove(), 4000);
    } else {
      alert(data.message || 'Failed to delete attempt.');
      btn.disabled = false;
      btn.textContent = '🗑 Delete';
    }
  } catch (err) {
    alert('Network error. Please try again.');
    btn.disabled = false;
    btn.textContent = '🗑 Delete';
  }
}