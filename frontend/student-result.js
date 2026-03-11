/* ═══════════════════════════════════════════
   STUDENT RESULT — with PDF download
   ═══════════════════════════════════════════ */
const params  = new URLSearchParams(location.search);
const testId  = params.get('testId');
const reg     = params.get('reg');

let studentData = null;
let testData    = null;

async function loadResult() {
  const container = document.getElementById('resultContainer');

  try {
    const [resRes, testRes] = await Promise.all([
      fetch(`/api/student/result/${testId}/${reg}`),
      fetch(`/api/tests/${testId}`)
    ]);

    if (!resRes.ok) {
      container.innerHTML = `
        <div class="card" style="text-align:center; padding:48px;">
          <div style="font-size:48px; margin-bottom:16px;">⏳</div>
          <h3 style="margin-bottom:8px;">Results Not Available Yet</h3>
          <p style="color:var(--muted); font-size:14px; margin-bottom:20px;">
            Your staff hasn't published the results yet.<br>Please check back later.
          </p>
          <button class="btn btn-primary" onclick="location.href='/'">Back to Home</button>
        </div>
      `;
      return;
    }

    studentData = await resRes.json();
    testData    = testRes.ok ? await testRes.json() : null;

    // Show PDF download button since results are published
    document.getElementById('downloadPdfBtn').style.display = 'inline-flex';

    renderResult(studentData, testData);

  } catch (err) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:40px; color:var(--danger);">
        Error loading result. Please try again.
      </div>
    `;
  }
}

function renderResult(student, test) {
  const container = document.getElementById('resultContainer');
  const pct       = student.total ? Math.round(student.score / student.total * 100) : 0;
  const passed    = pct >= 40;

  const ringColor = pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const ringBg    = pct >= 75 ? '#d1fae5' : pct >= 40 ? '#fef3c7' : '#fee2e2';

  let html = `
    <div class="card" style="text-align:center; padding:32px; margin-bottom:20px;">
      <div class="score-ring" style="background:${ringBg}; border:4px solid ${ringColor};">
        <div style="font-size:28px; font-weight:800; color:${ringColor}; line-height:1;">${student.score}</div>
        <div style="font-size:12px; color:var(--muted);">of ${student.total}</div>
      </div>
      <div style="font-size:32px; font-weight:800; color:${ringColor}; margin-bottom:4px;">${pct}%</div>
      <div style="font-size:16px; font-weight:600; margin-bottom:4px;">${test?.title || 'Exam Result'}</div>
      <div class="badge ${pct >= 75 ? 'badge-green' : pct >= 40 ? 'badge-orange' : 'badge-red'}" style="font-size:13px; padding:5px 14px; margin-top:8px;">
        ${pct >= 75 ? '🏆 Excellent' : pct >= 40 ? '✅ Pass' : '❌ Needs Improvement'}
      </div>
    </div>
  `;

  if (test && test.questions) {
    html += `<div style="font-size:14px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">Question Review</div>`;
    test.questions.forEach((q, i) => {
      const ans = student.answers[i];

      let isCorrect = false;
      if (q.type === 'MCQ') isCorrect = ans === q.correctIndex;
      if (q.type === 'MSQ') isCorrect = Array.isArray(ans) && ans.sort().join(',') === (q.correctIndexes || []).sort().join(',');
      if (q.type === 'NAT') isCorrect = Number(ans) === Number(q.correctValue);

      const typeBadge = q.type === 'MCQ' ? 'badge-blue' : q.type === 'MSQ' ? 'badge-purple' : 'badge-orange';

      html += `
        <div class="card card-flat" style="margin-bottom:12px; padding:18px; border-left:4px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
            <div>
              <span style="font-size:12px; font-weight:700; color:var(--muted); display:block; margin-bottom:4px;">Q${i + 1}</span>
              <span style="font-size:15px; font-weight:600;">${q.question}</span>
            </div>
            <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
              <span class="badge ${typeBadge}">${q.type}</span>
              <span class="badge ${isCorrect ? 'badge-green' : 'badge-red'}">${isCorrect ? '✓ Correct' : '✕ Wrong'}</span>
            </div>
          </div>
          ${q.image ? `<img src="${q.image}" style="max-width:100%; max-height:200px; border-radius:8px; margin-bottom:12px; display:block;">` : ''}
      `;

      if (q.type === 'MCQ') {
        html += (q.options || []).map((opt, oi) => {
          const isCorrectOpt = oi === q.correctIndex;
          const isYourChoice = oi === ans;
          let cls = '';
          if (isCorrectOpt && isYourChoice) cls = 'correct';
          else if (isCorrectOpt) cls = 'missed';
          else if (isYourChoice) cls = 'wrong';
          if (!cls) return `<div class="result-opt">${opt}</div>`;
          const label = isCorrectOpt && isYourChoice ? '✓ Your answer (Correct)'
                      : isCorrectOpt ? '✓ Correct answer'
                      : '✕ Your answer (Wrong)';
          return `<div class="result-opt ${cls}"><span style="font-weight:600;">${opt}</span><span style="margin-left:auto; font-size:12.5px; font-weight:700;">${label}</span></div>`;
        }).join('');
      }

      if (q.type === 'MSQ') {
        html += (q.options || []).map((opt, oi) => {
          const isCorrectOpt = (q.correctIndexes || []).includes(oi);
          const isYourChoice = Array.isArray(ans) && ans.includes(oi);
          let cls = '';
          if (isCorrectOpt && isYourChoice) cls = 'correct';
          else if (isCorrectOpt) cls = 'missed';
          else if (isYourChoice) cls = 'wrong';
          if (!cls) return `<div class="result-opt">${opt}</div>`;
          const label = isCorrectOpt && isYourChoice ? '✓ Correct'
                      : isCorrectOpt ? '✓ Missed'
                      : '✕ Wrong choice';
          return `<div class="result-opt ${cls}"><span>${opt}</span><span style="margin-left:auto; font-size:12.5px; font-weight:700;">${label}</span></div>`;
        }).join('');
      }

      if (q.type === 'NAT') {
        html += `
          <div class="result-opt ${isCorrect ? 'correct' : 'wrong'}">
            Your Answer: <strong>${ans ?? 'Not answered'}</strong>
            <span style="margin-left:auto; font-size:12.5px; font-weight:700;">${isCorrect ? '✓ Correct' : '✕ Wrong'}</span>
          </div>
          ${!isCorrect ? `<div class="result-opt missed">Correct Answer: <strong>${q.correctValue}</strong><span style="margin-left:auto; font-size:12.5px; font-weight:700;">✓ Expected</span></div>` : ''}
        `;
      }

      if (q.explanation) {
        html += `<div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 14px; margin-top:10px; font-size:13px; color:#92400e;">💡 <strong>Explanation:</strong> ${q.explanation}</div>`;
      }

      html += '</div>';
    });
  }

  html += `
    <div style="text-align:center; margin-top:24px; display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="downloadResultPDF()">⬇ Download Result PDF</button>
      <button class="btn" onclick="location.href='/'">Back to Home</button>
    </div>
  `;

  container.innerHTML = html;
}

/* ═══════════════════════════════════════════
   PDF CERTIFICATE — student result download
   ═══════════════════════════════════════════ */
function downloadResultPDF() {
  if (!studentData) { showToast('Result not loaded yet', 'warn'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 15;

  const pct   = studentData.total ? Math.round(studentData.score / studentData.total * 100) : 0;
  const grade = pct >= 75 ? 'A' : pct >= 60 ? 'B' : pct >= 40 ? 'C' : 'F';
  const status = pct >= 40 ? 'PASS' : 'FAIL';
  const statusColor = pct >= 40 ? [16, 185, 129] : [239, 68, 68];

  /* ── Background ── */
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, W, 297, 'F');

  /* ── Top colour strip ── */
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, W, 36, 'F');

  /* ── Header text ── */
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('EXAMINATION RESULT', W / 2, 15, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Student Performance Report', W / 2, 23, { align: 'center' });
  doc.text(`Generated: ${new Date().toLocaleString()}`, W / 2, 30, { align: 'center' });

  /* ── Score circle area ── */
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(M, 44, W - M * 2, 52, 8, 8, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(M, 44, W - M * 2, 52, 8, 8, 'S');

  /* Score */
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...statusColor);
  doc.text(`${pct}%`, W / 2, 70, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Score: ${studentData.score} / ${studentData.total}   |   Grade: ${grade}`, W / 2, 80, { align: 'center' });

  /* Status badge */
  const badgeX = W / 2 - 18;
  doc.setFillColor(...statusColor);
  doc.roundedRect(badgeX, 85, 36, 8, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(status, W / 2, 90.5, { align: 'center' });

  /* ── Student info box ── */
  let y = 106;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(M, y, W - M * 2, 42, 8, 8, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(M, y, W - M * 2, 42, 8, 8, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('STUDENT DETAILS', M + 10, y + 10);

  doc.setDrawColor(226, 232, 240);
  doc.line(M + 10, y + 13, W - M - 10, y + 13);

  const infoRows = [
    ['Student Name', studentData.studentName || 'N/A'],
    ['Register Number', studentData.studentReg || 'N/A'],
    ['Test ID', testId || 'N/A'],
    ['Test Title', testData?.title || 'N/A'],
  ];

  doc.setFontSize(10);
  infoRows.forEach(([label, value], i) => {
    const row_y = y + 20 + i * 7;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(label + ':', M + 10, row_y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(value), M + 60, row_y);
  });

  /* ── Question review table ── */
  if (testData?.questions) {
    y = 156;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('QUESTION REVIEW', M, y);
    y += 5;

    const tableRows = testData.questions.map((q, i) => {
      const ans = studentData.answers[i];
      let isCorrect = false;
      let yourAns = 'Not answered';
      let correctAns = '';

      if (q.type === 'MCQ') {
        isCorrect = ans === q.correctIndex;
        yourAns   = ans !== null && ans !== undefined ? (q.options[ans] || `Option ${ans+1}`) : 'Not answered';
        correctAns = q.options[q.correctIndex] || '';
      } else if (q.type === 'MSQ') {
        isCorrect = Array.isArray(ans) && ans.sort().join(',') === (q.correctIndexes || []).sort().join(',');
        yourAns   = Array.isArray(ans) && ans.length ? ans.map(i => q.options[i]).join(', ') : 'Not answered';
        correctAns = (q.correctIndexes || []).map(i => q.options[i]).join(', ');
      } else if (q.type === 'NAT') {
        isCorrect = Number(ans) === Number(q.correctValue);
        yourAns   = ans !== null && ans !== undefined ? String(ans) : 'Not answered';
        correctAns = String(q.correctValue);
      }

      const qText = (q.question || '').substring(0, 45) + (q.question?.length > 45 ? '…' : '');
      return [
        i + 1,
        qText,
        q.type,
        yourAns.substring(0, 20),
        isCorrect ? '✓' : '✗'
      ];
    });

    doc.autoTable({
      startY: y,
      head: [['#', 'Question', 'Type', 'Your Answer', 'Result']],
      body: tableRows,
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center' },
        1: { cellWidth: 80 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 55 },
        4: { cellWidth: 14, halign: 'center' }
      },
      didDrawCell(data) {
        if (data.column.index === 4 && data.section === 'body') {
          const cell = data.cell;
          const v = data.cell.raw;
          doc.setTextColor(v === '✓' ? 16 : 239, v === '✓' ? 185 : 68, v === '✓' ? 129 : 68);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(v, cell.x + cell.width / 2, cell.y + cell.height / 2 + 1, { align: 'center' });
        }
      }
    });
  }

  /* ── Footer ── */
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('STMS — Student Test Management System', M, 290);
    doc.text(`Page ${i} of ${pageCount}`, W - M, 290, { align: 'right' });
  }

  const safeName = (studentData.studentName || 'student').replace(/\s+/g, '_');
  doc.save(`Result_${safeName}_${testId}.pdf`);
  showToast('Result PDF downloaded!', 'success');
}

loadResult();