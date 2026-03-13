/* ═══════════════════════════════════════════
   STUDENT RESULT — rank, unattempted, PDF
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

  const ringColor = pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const ringBg    = pct >= 75 ? '#d1fae5' : pct >= 40 ? '#fef3c7' : '#fee2e2';

  // Rank badge
  let rankHtml = '';
  if (student.rank && student.totalStudents) {
    const medal = student.rank === 1 ? '🥇' : student.rank === 2 ? '🥈' : student.rank === 3 ? '🥉' : '🎖';
    rankHtml = `
      <div style="margin-top:12px; display:inline-flex; align-items:center; gap:8px; background:#ede9fe; border:1px solid #c4b5fd; border-radius:20px; padding:6px 16px;">
        <span style="font-size:18px;">${medal}</span>
        <span style="font-weight:700; color:#5b21b6; font-size:15px;">Rank ${student.rank} of ${student.totalStudents}</span>
      </div>
    `;
  }

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
      ${rankHtml}
    </div>
  `;

  if (test && test.questions) {
    html += `<div style="font-size:14px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">Question Review</div>`;

    test.questions.forEach((q, i) => {
      const ans = student.answers ? student.answers[i] : undefined;
      const breakdown = student.scoreBreakdown ? student.scoreBreakdown[i] : null;
      const marks = q.marks || 1;

      // Determine attempt status
      let attempted = false;
      if (q.type === 'MSQ') attempted = Array.isArray(ans) && ans.length > 0;
      else attempted = (ans !== null && ans !== undefined && ans !== '');

      let isCorrect = false;
      let earnedMarks = 0;
      let partialNote = '';

      if (!attempted) {
        // Unattempted: 0 marks, show correct answer
        earnedMarks = 0;
        isCorrect = false;
      } else if (q.type === 'MCQ') {
        isCorrect = ans === q.correctIndex;
        earnedMarks = isCorrect ? marks
          : (q.negativeMarkingEnabled ? -(q.negativeMarks || 0) : 0);
        if (!isCorrect && q.negativeMarkingEnabled && ans !== null && ans !== undefined) {
          partialNote = `<span style="color:#dc2626; font-size:12px; font-weight:700;">−${q.negativeMarks} marks deducted</span>`;
        }
      } else if (q.type === 'MSQ') {
        if (breakdown) {
          earnedMarks = breakdown.earned;
          partialNote = `<span style="color:var(--primary); font-size:12px; font-weight:700;">${breakdown.note}</span>`;
          isCorrect = earnedMarks >= marks;
        } else {
          const correct = q.correctIndexes || [];
          const chosen  = Array.isArray(ans) ? ans : [];
          const rightPicks = chosen.filter(x => correct.includes(x)).length;
          const wrongPicks = chosen.filter(x => !correct.includes(x)).length;
          const netCorrect = Math.max(0, rightPicks - wrongPicks);
          earnedMarks = correct.length ? parseFloat(((netCorrect / correct.length) * marks).toFixed(2)) : 0;
          isCorrect = earnedMarks >= marks;
          partialNote = `<span style="color:var(--primary); font-size:12px; font-weight:700;">${rightPicks}/${correct.length} correct${wrongPicks > 0 ? `, ${wrongPicks} wrong` : ''} → ${earnedMarks} marks</span>`;
        }
      } else if (q.type === 'NAT') {
        const sv = parseFloat(String(ans).trim());
        const cv = parseFloat(String(q.correctValue).trim());
        isCorrect = !isNaN(sv) && !isNaN(cv) && sv === cv;
        earnedMarks = isCorrect ? marks
          : (q.negativeMarkingEnabled ? -(q.negativeMarks || 0) : 0);
        if (!isCorrect && q.negativeMarkingEnabled) {
          partialNote = `<span style="color:#dc2626; font-size:12px; font-weight:700;">−${q.negativeMarks} marks deducted</span>`;
        }
      }

      const typeBadge = q.type === 'MCQ' ? 'badge-blue' : q.type === 'MSQ' ? 'badge-purple' : 'badge-orange';

      let borderColor, resultLabel, resultBadgeClass;
      if (!attempted) {
        borderColor = '#94a3b8';
        resultLabel = '— Not Attempted';
        resultBadgeClass = 'badge-gray';
      } else if (isCorrect) {
        borderColor = 'var(--success)';
        resultLabel = '✓ Correct';
        resultBadgeClass = 'badge-green';
      } else if (q.type === 'MSQ' && earnedMarks > 0) {
        borderColor = '#f59e0b';
        resultLabel = `◑ Partial (${earnedMarks}/${marks})`;
        resultBadgeClass = 'badge-orange';
      } else {
        borderColor = 'var(--danger)';
        resultLabel = '✕ Wrong';
        resultBadgeClass = 'badge-red';
      }

      const earnedDisplay = attempted
        ? `${earnedMarks >= 0 ? '+' : ''}${earnedMarks}/${marks}`
        : `0/${marks}`;

      html += `
        <div class="card card-flat" style="margin-bottom:12px; padding:18px; border-left:4px solid ${borderColor};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
            <div>
              <span style="font-size:12px; font-weight:700; color:var(--muted); display:block; margin-bottom:4px;">Q${i + 1}</span>
              <span style="font-size:15px; font-weight:600;">${q.question}</span>
            </div>
            <div style="display:flex; gap:6px; align-items:center; flex-shrink:0; flex-wrap:wrap;">
              <span class="badge ${typeBadge}">${q.type}</span>
              <span class="badge badge-gray">${earnedDisplay}</span>
              <span class="badge ${resultBadgeClass}">${resultLabel}</span>
            </div>
          </div>
          ${partialNote ? `<div style="margin-bottom:10px;">${partialNote}</div>` : ''}
          ${q.image ? `<img src="${q.image}" style="max-width:100%; max-height:200px; border-radius:8px; margin-bottom:12px; display:block;">` : ''}
      `;

      if (!attempted) {
        // Show "not attempted" notice and correct answer
        html += `<div style="background:#f8fafc; border:1.5px dashed #cbd5e1; border-radius:8px; padding:12px 14px; margin-bottom:6px; color:#64748b; font-size:13.5px;">
          ⏭ You did not attempt this question.
        </div>`;

        if (q.type === 'MCQ') {
          html += `<div class="result-opt missed">
            <span>Correct Answer: <strong>${q.options[q.correctIndex] || `Option ${q.correctIndex+1}`}</strong></span>
            <span style="margin-left:auto; font-size:12px; font-weight:700;">✓ Expected</span>
          </div>`;
        } else if (q.type === 'MSQ') {
          const correctOpts = (q.correctIndexes || []).map(ci => q.options[ci]).join(', ');
          html += `<div class="result-opt missed">
            <span>Correct Answers: <strong>${correctOpts}</strong></span>
            <span style="margin-left:auto; font-size:12px; font-weight:700;">✓ Expected</span>
          </div>`;
        } else if (q.type === 'NAT') {
          html += `<div class="result-opt missed">
            Correct Answer: <strong>${q.correctValue}</strong>
            <span style="margin-left:auto; font-size:12px; font-weight:700;">✓ Expected</span>
          </div>`;
        }

      } else if (q.type === 'MCQ') {
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

      } else if (q.type === 'MSQ') {
        const correctIdxs = q.correctIndexes || [];
        html += (q.options || []).map((opt, oi) => {
          const isCorrectOpt = correctIdxs.includes(oi);
          const isYourChoice = Array.isArray(ans) && ans.includes(oi);
          let cls = '';
          if (isCorrectOpt && isYourChoice) cls = 'correct';
          else if (isCorrectOpt) cls = 'missed';
          else if (isYourChoice) cls = 'wrong';
          if (!cls) return `<div class="result-opt">${opt}</div>`;
          const label = isCorrectOpt && isYourChoice ? '✓ Correct'
            : isCorrectOpt ? '✓ Missed'
            : '✕ Wrong choice (reduced marks)';
          return `<div class="result-opt ${cls}"><span>${opt}</span><span style="margin-left:auto; font-size:12.5px; font-weight:700;">${label}</span></div>`;
        }).join('');

      } else if (q.type === 'NAT') {
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
   PDF CERTIFICATE
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

  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, W, 297, 'F');
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, W, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('EXAMINATION RESULT', W / 2, 15, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Student Performance Report', W / 2, 23, { align: 'center' });
  doc.text(`Generated: ${new Date().toLocaleString()}`, W / 2, 30, { align: 'center' });

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(M, 44, W - M * 2, 58, 8, 8, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(M, 44, W - M * 2, 58, 8, 8, 'S');

  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...statusColor);
  doc.text(`${pct}%`, W / 2, 70, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Score: ${studentData.score} / ${studentData.total}   |   Grade: ${grade}`, W / 2, 80, { align: 'center' });

  if (studentData.rank && studentData.totalStudents) {
    doc.text(`Rank: ${studentData.rank} of ${studentData.totalStudents} students`, W / 2, 87, { align: 'center' });
  }

  const badgeX = W / 2 - 18;
  doc.setFillColor(...statusColor);
  doc.roundedRect(badgeX, 93, 36, 8, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(status, W / 2, 98.5, { align: 'center' });

  let y = 112;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(M, y, W - M * 2, 42, 8, 8, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(M, y, W - M * 2, 42, 8, 8, 'S');
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
  doc.text('STUDENT DETAILS', M + 10, y + 10);
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
    doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
    doc.text(label + ':', M + 10, row_y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42);
    doc.text(String(value), M + 60, row_y);
  });

  if (testData?.questions) {
    y = 162;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
    doc.text('QUESTION REVIEW', M, y);
    y += 5;

    const tableRows = testData.questions.map((q, i) => {
      const ans = studentData.answers ? studentData.answers[i] : undefined;
      let attempted = false;
      let isCorrect = false;
      let yourAns = 'Not attempted';

      if (q.type === 'MCQ') {
        attempted = ans !== null && ans !== undefined;
        isCorrect = attempted && ans === q.correctIndex;
        yourAns = attempted ? (q.options[ans] || `Opt ${ans+1}`) : 'Not attempted';
      } else if (q.type === 'MSQ') {
        attempted = Array.isArray(ans) && ans.length > 0;
        isCorrect = attempted && ans.slice().sort().join(',') === (q.correctIndexes || []).slice().sort().join(',');
        yourAns = attempted ? ans.map(i => q.options[i]).join(', ') : 'Not attempted';
      } else if (q.type === 'NAT') {
        attempted = ans !== null && ans !== undefined && ans !== '';
        isCorrect = attempted && parseFloat(String(ans).trim()) === parseFloat(String(q.correctValue).trim());
        yourAns = attempted ? String(ans) : 'Not attempted';
      }

      const qText = (q.question || '').substring(0, 45) + (q.question?.length > 45 ? '…' : '');
      const resultSymbol = !attempted ? '—' : isCorrect ? '✓' : '✗';
      return [i + 1, qText, q.type, yourAns.substring(0, 20), resultSymbol];
    });

    doc.autoTable({
      startY: y,
      head: [['#', 'Question', 'Type', 'Your Answer', 'Result']],
      body: tableRows,
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 80 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 55 },
        4: { cellWidth: 14, halign: 'center' }
      },
      didDrawCell(data) {
        if (data.column.index === 4 && data.section === 'body') {
          const v = data.cell.raw;
          if (v === '—') return;
          const cell = data.cell;
          doc.setTextColor(v === '✓' ? 16 : 239, v === '✓' ? 185 : 68, v === '✓' ? 129 : 68);
          doc.setFontSize(10); doc.setFont('helvetica', 'bold');
          doc.text(v, cell.x + cell.width / 2, cell.y + cell.height / 2 + 1, { align: 'center' });
        }
      }
    });
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
    doc.text('STMS — Student Test Management System', M, 290);
    doc.text(`Page ${i} of ${pageCount}`, W - M, 290, { align: 'right' });
  }

  const safeName = (studentData.studentName || 'student').replace(/\s+/g, '_');
  doc.save(`Result_${safeName}_${testId}.pdf`);
  showToast('Result PDF downloaded!', 'success');
}

loadResult();