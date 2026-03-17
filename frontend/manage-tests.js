const staffId = sessionStorage.getItem('staffId');
if (!staffId) { document.body.innerHTML = '<div class="card center" style="padding:40px; margin:40px auto; max-width:400px;"><h2>Access denied</h2></div>'; throw new Error(); }

let allTests = [];

function goBack() { location.href = '/dashboard.html'; }

async function loadTests() {
  try {
    const res = await fetch(`/api/tests/by-staff/${staffId}`);
    if (!res.ok) throw new Error();
    allTests = await res.json();
    renderTests(allTests);
  } catch {
    showToast('Failed to load tests', 'error');
    document.getElementById('testTable').innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--danger);">Error loading tests</td></tr>`;
  }
}

function filterTests() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('filterStatus').value;
  const filtered = allTests.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search) || t.testId.toLowerCase().includes(search);
    const matchStatus = status === 'all'
      || (status === 'published'   &&  t.resultsPublished)
      || (status === 'unpublished' && !t.resultsPublished);
    return matchSearch && matchStatus;
  });
  renderTests(filtered);
}

function renderTests(tests) {
  const tbody = document.getElementById('testTable');
  const emptyMsg = document.getElementById('emptyMsg');

  if (!tests.length) {
    tbody.innerHTML = '';
    emptyMsg.style.display = '';
    return;
  }
  emptyMsg.style.display = 'none';

  tbody.innerHTML = tests.map(t => {
    const statusBadge = t.resultsPublished
      ? '<span class="badge badge-green">✓ Published</span>'
      : '<span class="badge badge-gray">● Unpublished</span>';

    const publishBtn = t.resultsPublished
      ? `<button class="btn btn-sm" disabled style="opacity:0.45; cursor:default;">Published</button>`
      : `<button class="btn btn-primary btn-sm" onclick="publishResults('${t.testId}', this)">Publish</button>`;

    const lockedBadge = t.lockedCount > 0
      ? `<span class="badge" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; cursor:pointer;" onclick="openLockedPanel('${t.testId}', decodeURIComponent('${encodeURIComponent(t.title)}'))">🔴 ${t.lockedCount} Locked</span>`
      : '';

    return `
      <tr>
        <td><code style="font-size:12px; background:var(--bg); padding:3px 8px; border-radius:5px;">${t.testId}</code></td>
        <td style="font-weight:500;">${t.title} ${lockedBadge}</td>
        <td>${statusBadge}</td>
        <td>
          <span style="font-weight:700; color:var(--primary);">${t.attempts}</span>
          <span style="color:var(--muted); font-size:12px;"> student${t.attempts !== 1 ? 's' : ''}</span>
        </td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-sm" onclick="viewResults('${t.testId}')">📊 Results</button>
            <button class="btn btn-sm" onclick="viewFeedback('${t.testId}',decodeURIComponent('${encodeURIComponent(t.title)}'))" style="border-color:#a78bfa;color:#7c3aed;">💬 Feedback</button>
            <button class="btn btn-sm" onclick="downloadAnswerKey('${t.testId}',decodeURIComponent('${encodeURIComponent(t.title)}'))" style="border-color:#6ee7b7;color:#065f46;">🗝 Answer Key</button>
            <button class="btn btn-sm" onclick="editTest('${t.testId}')">✏️ Edit</button>
            ${publishBtn}
            <button class="btn btn-sm" style="border-color:#fecaca; color:var(--danger);" onclick="deleteTest('${t._id}')">🗑</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function editTest(testId) { location.href = `/create-test.html?edit=${testId}`; }
function viewResults(testId) { location.href = `/results.html?testId=${testId}`; }

async function publishResults(testId, btn) {
  showConfirm('Once published, students can view their results. This cannot be undone.', async () => {
    btn.disabled = true;
    btn.textContent = 'Publishing…';
    try {
      const res = await fetch(`/api/tests/${testId}/publish-results`, { method: 'POST' });
      if (!res.ok) throw new Error();
      showToast('Results published successfully!', 'success');
      loadTests();
    } catch {
      showToast('Failed to publish results', 'error');
      btn.disabled = false; btn.textContent = 'Publish';
    }
  }, { okLabel: 'Publish Results' });
}

async function deleteTest(id) {
  showConfirm('Delete this test permanently? All results will also be deleted.', async () => {
    try {
      await fetch(`/api/tests/${id}`, { method: 'DELETE' });
      showToast('Test deleted', 'info');
      loadTests();
    } catch {
      showToast('Failed to delete test', 'error');
    }
  }, { danger: true, okLabel: 'Delete Test' });
}

/* ─────────────── LOCKED STUDENTS PANEL ─────────────── */
let _lockedPanelTestId = null;

async function openLockedPanel(testId, testTitle) {
  _lockedPanelTestId = testId;

  // Create/show modal
  const existing = document.getElementById('_lockedModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = '_lockedModal';
  modal.className = 'modal-overlay open';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:640px; width:95%;">
      <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
        <span class="modal-title">🔒 Locked Students — ${testTitle}</span>
        <button class="btn btn-sm" onclick="closeLockedPanel()">✕ Close</button>
      </div>
      <p style="color:var(--muted); font-size:13px; margin-bottom:16px;">
        These students have been locked due to malpractice. Only you (the test creator) can unlock or force-submit their exam.
      </p>
      <div id="_lockedList" style="min-height:80px; display:flex; align-items:center; justify-content:center; color:var(--muted);">
        Loading…
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.onclick = e => { if (e.target === modal) closeLockedPanel(); };

  await loadLockedStudents(testId);
}

function closeLockedPanel() {
  const modal = document.getElementById('_lockedModal');
  if (modal) modal.remove();
  _lockedPanelTestId = null;
}

async function loadLockedStudents(testId) {
  const list = document.getElementById('_lockedList');
  if (!list) return;

  try {
    const res = await fetch(`/api/exam/locked/${testId}`);
    if (!res.ok) throw new Error();
    const locked = await res.json();

    if (!locked.length) {
      list.innerHTML = '<div style="text-align:center; padding:24px; color:var(--muted);">No locked students found.</div>';
      return;
    }

    list.style.display = 'block';
    list.innerHTML = locked.map(r => `
      <div style="background:var(--bg); border:1.5px solid #fecaca; border-radius:12px; padding:16px 18px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
          <div>
            <div style="font-weight:700; font-size:15px;">${r.studentName}</div>
            <div style="font-size:13px; color:var(--muted);">Reg: ${r.studentReg}</div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-sm" style="background:#dcfce7; border-color:#86efac; color:#16a34a; font-weight:700;"
              onclick="unlockStudent('${testId}', '${r.studentReg}', 'unlock')">
              🔓 Unlock & Resume
            </button>
            <button class="btn btn-sm" style="background:#fef3c7; border-color:#fcd34d; color:#92400e; font-weight:700;"
              onclick="unlockStudent('${testId}', '${r.studentReg}', 'force-submit')">
              📤 Force Submit
            </button>
          </div>
        </div>
        ${r.violationLog && r.violationLog.length ? `
          <div style="background:#fef2f2; border-radius:8px; padding:10px 12px;">
            <div style="font-size:11px; font-weight:700; color:#dc2626; text-transform:uppercase; margin-bottom:6px;">Violation Log</div>
            ${r.violationLog.map((v, i) => `
              <div style="font-size:12.5px; color:var(--text); padding:3px 0; border-bottom:1px solid #fee2e2; display:flex; justify-content:space-between;">
                <span><strong>${i+1}.</strong> ${v.reason}</span>
                <span style="color:var(--muted); font-size:11px;">${new Date(v.timestamp).toLocaleTimeString()}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');

  } catch {
    list.innerHTML = '<div style="color:var(--danger); text-align:center; padding:16px;">Failed to load locked students.</div>';
  }
}

async function unlockStudent(testId, studentReg, action) {
  const label = action === 'unlock' ? 'Unlock & Resume' : 'Force Submit';
  const msg   = action === 'unlock'
    ? 'This will unlock the exam and allow the student to resume.'
    : 'This will submit the exam with current answers. This cannot be undone.';

  showConfirm(msg, async () => {
    try {
      const res = await fetch('/api/exam/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, studentReg, staffId, action })
      });
      if (!res.ok) throw new Error();
      showToast(action === 'unlock' ? 'Student unlocked. They can resume.' : 'Exam force-submitted.', 'success');
      // Refresh panel and tests
      await loadLockedStudents(testId);
      loadTests();
    } catch {
      showToast('Action failed. Please try again.', 'error');
    }
  }, { okLabel: label, danger: action === 'force-submit' });
}

loadTests();
/* ─────────────── FEEDBACK PANEL ─────────────── */
async function viewFeedback(testId, testTitle) {
  const existing = document.getElementById('_feedbackModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = '_feedbackModal';
  modal.className = 'modal-overlay open';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:680px; width:95%; max-height:85vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
        <span class="modal-title">💬 Feedback — ${testTitle}</span>
        <button class="btn btn-sm" onclick="document.getElementById('_feedbackModal').remove()">✕ Close</button>
      </div>
      <div id="_feedbackBody" style="overflow-y:auto; padding:16px; flex:1;">
        <div style="text-align:center; color:var(--muted); padding:24px;">Loading…</div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.onclick = e => { if (e.target === modal) modal.remove(); };

  try {
    const res = await fetch('/api/feedback/' + testId);
    const data = await res.json();
    const body = document.getElementById('_feedbackBody');
    if (!data.length) {
      body.innerHTML = '<div style="text-align:center; color:var(--muted); padding:32px;">No feedback submitted yet.</div>';
      return;
    }

    const qLabels = [
      'Overall functionality',
      'Clarity of questions',
      'Staff support & guidance',
      'Overall experience'
    ];

    const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
    const starColor = n => n >= 4 ? '#16a34a' : n === 3 ? '#d97706' : '#dc2626';

    // Summary averages
    const avgs = [1,2,3,4].map(i => {
      const vals = data.map(f => f['q'+i]).filter(v => v);
      return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : 'N/A';
    });

    body.innerHTML = `
      <!-- Summary -->
      <div style="background:var(--bg); border-radius:12px; padding:16px 20px; margin-bottom:20px; display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px;">
        ${qLabels.map((l,i) => `
          <div style="text-align:center;">
            <div style="font-size:22px; font-weight:900; color:var(--primary);">${avgs[i]}</div>
            <div style="font-size:11px; color:var(--muted); margin-top:2px;">${l}</div>
          </div>`).join('')}
      </div>
      <div style="font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">${data.length} Response${data.length!==1?'s':''}</div>

      <!-- Individual responses -->
      ${data.map(f => `
        <div style="background:var(--bg); border:1.5px solid var(--border); border-radius:12px; padding:16px 18px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; flex-wrap:wrap; gap:6px;">
            <div>
              <div style="font-weight:700; font-size:14px;">${f.studentName}</div>
              <div style="font-size:12px; color:var(--muted);">Reg: ${f.studentReg}</div>
            </div>
            <div style="font-size:11px; color:var(--muted);">${new Date(f.createdAt).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
            ${qLabels.map((l,i) => `
              <div style="font-size:12.5px;">
                <span style="color:var(--muted);">${l}:</span>
                <span style="font-weight:700; color:${starColor(f['q'+(i+1)])}; margin-left:4px;">${stars(f['q'+(i+1)] || 0)} (${f['q'+(i+1)] || '—'})</span>
              </div>`).join('')}
          </div>
          ${f.suggestion ? `<div style="background:#f8fafc; border-radius:8px; padding:10px 12px; font-size:13px; color:var(--text); border-left:3px solid var(--primary);"><strong>Suggestion:</strong> ${f.suggestion}</div>` : ''}
        </div>`).join('')}
    `;
  } catch {
    document.getElementById('_feedbackBody').innerHTML = '<div style="color:var(--danger); text-align:center; padding:16px;">Failed to load feedback.</div>';
  }
}

/* ─────────────── ANSWER KEY PDF ─────────────── */
async function downloadAnswerKey(testId, testTitle) {
  let test;
  try {
    const res = await fetch('/api/tests/' + testId);
    if (!res.ok) throw new Error();
    test = await res.json();
  } catch {
    showToast('Failed to load test data', 'error');
    return;
  }
  if (!test.questions || !test.questions.length) {
    showToast('This test has no questions', 'warn');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 14, CW = W - M * 2;
  const PAGE_H = 297, BOTTOM = PAGE_H - 16;
  let y = 0;

  const C = {
    primary : [79,  70,  229],
    success : [16,  185, 129],
    danger  : [239, 68,  68 ],
    warning : [245, 158, 11 ],
    muted   : [100, 116, 139],
    border  : [226, 232, 240],
    bg      : [248, 250, 252],
    white   : [255, 255, 255],
    text    : [15,  23,  42 ],
    successL: [209, 250, 229],
    warningL: [254, 243, 199],
    greenTxt: [6,   95,  70 ],
    amberTxt: [120, 53,  15 ],
    purple  : [109, 40,  217],
    purpleL : [237, 233, 254],
  };

  function bgFill(x, ry, w, h, color) {
    doc.setFillColor(...color); doc.rect(x, ry, w, h, 'F');
  }
  function stroke(x, ry, w, h, color, lw) {
    doc.setDrawColor(...color); doc.setLineWidth(lw || 0.3); doc.rect(x, ry, w, h, 'S');
  }
  function roundFill(x, ry, w, h, color, strokeColor, r) {
    doc.setFillColor(...color);
    doc.setDrawColor(...(strokeColor || color));
    doc.setLineWidth(0.5);
    doc.roundedRect(x, ry, w, h, r || 2, r || 2, 'FD');
  }

  function ensureSpace(h) {
    if (y + h > BOTTOM) {
      doc.addPage(); bgFill(0, 0, W, PAGE_H, C.bg); y = 16;
    }
  }

  function addFooters() {
    const n = doc.internal.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      doc.setPage(p);
      bgFill(0, PAGE_H - 10, W, 10, C.primary);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.white);
      doc.text('STMS — Answer Key  |  ' + (test.title || testId), M, PAGE_H - 3.5);
      doc.text('Page ' + p + ' of ' + n, W - M, PAGE_H - 3.5, { align: 'right' });
    }
  }

  // Page 1
  bgFill(0, 0, W, PAGE_H, C.bg);
  bgFill(0, 0, W, 36, C.primary);
  doc.setFontSize(17); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
  doc.text('ANSWER KEY', W/2, 14, { align: 'center' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(test.title || testId, W/2, 22, { align: 'center' });
  doc.setFontSize(7.5);
  doc.text('Test ID: ' + testId + '   |   Questions: ' + test.questions.length + '   |   Generated: ' + new Date().toLocaleDateString(), W/2, 29, { align: 'center' });
  y = 42;

  // Summary bar
  const totalMarks = test.questions.reduce((s, q) => s + (Number(q.marks) || 1), 0);
  const mcqC = test.questions.filter(q => q.type === 'MCQ').length;
  const msqC = test.questions.filter(q => q.type === 'MSQ').length;
  const natC = test.questions.filter(q => q.type === 'NAT').length;

  bgFill(M, y, CW, 20, C.white);
  stroke(M, y, CW, 20, C.border, 0.3);

  [['Total Marks', totalMarks], ['MCQ', mcqC], ['MSQ', msqC], ['NAT', natC]].forEach(([lbl, val], i) => {
    const iW = CW / 4, ix = M + i * iW + iW/2;
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.muted);
    doc.text(lbl, ix, y + 8, { align: 'center' });
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.primary);
    doc.text(String(val), ix, y + 16, { align: 'center' });
    if (i < 3) { doc.setDrawColor(...C.border); doc.setLineWidth(0.3); doc.line(M + (i+1)*iW, y+3, M + (i+1)*iW, y+17); }
  });
  y += 28;

  // Section label
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.muted);
  doc.text('QUESTIONS & CORRECT ANSWERS', M, y);
  y += 3;
  doc.setDrawColor(...C.border); doc.setLineWidth(0.3); doc.line(M, y, M + CW, y);
  y += 7;

  // Questions
  test.questions.forEach((q, qi) => {
    const marks   = q.marks || 1;
    const IX      = M + 7;
    const ROW_W   = CW - 12;
    const TXT_MRG = 3;
    const LABEL_W = 42;
    const OPT_W   = ROW_W - LABEL_W - TXT_MRG * 3;

    // Measure
    const qLines = doc.splitTextToSize(q.question || '', CW - 16);
    let optH = 0;
    if (q.type === 'MCQ' || q.type === 'MSQ') {
      const ci = q.type === 'MCQ' ? [q.correctIndex] : (q.correctIndexes || []);
      (q.options || []).forEach((opt, oi) => {
        const isAns = ci.includes(oi);
        const lines = doc.splitTextToSize(opt, isAns ? OPT_W : ROW_W - TXT_MRG * 2);
        optH += Math.max(8, lines.length * 5 + 3) + 2;
      });
    } else {
      optH += 10;
    }
    const expH = q.explanation ? (doc.splitTextToSize(q.explanation, CW - 20).length * 5 + 8) : 0;
    const cardH = 16 + qLines.length * 5 + 2 + optH + expH + 5;

    ensureSpace(cardH + 4);
    const cTop = y;

    bgFill(M, cTop, CW, cardH, C.white);
    stroke(M, cTop, CW, cardH, C.border, 0.3);
    bgFill(M, cTop, 3, cardH, C.success); // green accent bar

    let hy = cTop + 8;

    // Q header
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.muted);
    doc.text('Q' + (qi+1), IX, hy);

    const typeFill = q.type === 'MCQ' ? [219,234,254] : q.type === 'MSQ' ? [237,233,254] : [254,243,199];
    const typeTC   = q.type === 'MCQ' ? [37,99,235]   : q.type === 'MSQ' ? [109,40,217]  : [180,100,0];
    roundFill(IX+13, hy-5.5, 15, 6.5, typeFill, typeTC, 3);
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...typeTC);
    doc.text(q.type, IX+20.5, hy-0.5, { align: 'center' });

    roundFill(IX+30, hy-5.5, 22, 6.5, [241,245,249], C.border, 3);
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.muted);
    doc.text(marks + ' mark' + (marks !== 1 ? 's' : ''), IX+41, hy-0.5, { align: 'center' });

    if (q.negativeMarkingEnabled && q.negativeMarks > 0) {
      roundFill(IX+54, hy-5.5, 24, 6.5, [254,226,226], [239,68,68], 3);
      doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(200, 30, 30);
      doc.text('-' + q.negativeMarks + ' wrong', IX+66, hy-0.5, { align: 'center' });
    }

    hy += 6;

    // Question text
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.text);
    doc.text(qLines, IX, hy);
    hy += qLines.length * 5 + 3;

    // Option rows
    function drawAKRow(optText, isCorrect, labelTxt) {
      const tw  = isCorrect ? OPT_W : ROW_W - TXT_MRG * 2;
      const lns = doc.splitTextToSize(optText, tw);
      const rh  = Math.max(8, lns.length * 5 + 3);
      const rX  = IX - 1, rW = ROW_W;

      if (isCorrect) {
        bgFill(rX, hy-4, rW, rh, C.successL);
      }
      stroke(rX, hy-4, rW, rh, isCorrect ? C.success : C.border, isCorrect ? 0.6 : 0.25);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', isCorrect ? 'bold' : 'normal');
      doc.setTextColor(...(isCorrect ? C.greenTxt : C.text));
      doc.text(lns, rX + TXT_MRG, hy);

      if (isCorrect && labelTxt) {
        const lW = LABEL_W - 2;
        const lX = rX + rW - lW - TXT_MRG;
        const lY = hy - 4 + (rh - 6) / 2;
        roundFill(lX, lY, lW, 6, C.success, C.success, 3);
        doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
        doc.text(labelTxt, lX + lW/2, lY + 4.2, { align: 'center' });
      }

      hy += rh + 2;
    }

    if (q.type === 'MCQ') {
      (q.options || []).forEach((opt, oi) => drawAKRow(opt, oi === q.correctIndex, 'CORRECT ANSWER'));
    } else if (q.type === 'MSQ') {
      const ci = q.correctIndexes || [];
      (q.options || []).forEach((opt, oi) => drawAKRow(opt, ci.includes(oi), 'CORRECT'));
    } else {
      drawAKRow('Correct Answer:  ' + q.correctValue, true, 'CORRECT ANSWER');
    }

    if (q.explanation) {
      const expLns = doc.splitTextToSize(q.explanation, CW - 20);
      const eh = expLns.length * 5 + 5;
      bgFill(IX-1, hy-3, ROW_W, eh, [255,251,235]);
      stroke(IX-1, hy-3, ROW_W, eh, [253,230,138], 0.3);
      doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(146, 64, 14);
      doc.text(expLns, IX+1, hy+1);
      hy += eh + 1;
    }

    y = hy + 5;
  });

  addFooters();

  const sT = (test.title || testId).replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save('AnswerKey_' + sT + '_' + testId + '.pdf');
  showToast('Answer Key PDF downloaded!', 'success');
}