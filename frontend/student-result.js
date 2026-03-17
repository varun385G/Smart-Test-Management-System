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
   PDF — mirrors the on-screen result exactly
   ═══════════════════════════════════════════ */
function downloadResultPDF() {
  if (!studentData) { showToast('Result not loaded yet', 'warn'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 14, CW = W - M * 2;
  const PAGE_H = 297, BOTTOM = PAGE_H - 16;
  let y = 0;

  /* ── colours ── */
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
    dangerL : [254, 226, 226],
    warningL: [254, 243, 199],
    greenTxt: [6,   95,  70 ],
    redTxt  : [127, 29,  29 ],
    amberTxt: [120, 53,  15 ],
    purple  : [109, 40,  217],
    purpleL : [237, 233, 254],
  };

  const pct   = studentData.total ? Math.round(studentData.score / studentData.total * 100) : 0;
  const grade = pct >= 75 ? 'A' : pct >= 60 ? 'B' : pct >= 40 ? 'C' : 'F';
  const ringC = pct >= 75 ? C.success : pct >= 40 ? C.warning : C.danger;
  const ringBg= pct >= 75 ? C.successL : pct >= 40 ? C.warningL : C.dangerL;
  const perf  = pct >= 75 ? 'Excellent' : pct >= 40 ? 'Pass' : 'Needs Improvement';

  /* ── helpers ── */
  function bgFill(x, ry, w, h, color) {
    doc.setFillColor(...color);
    doc.rect(x, ry, w, h, 'F');
  }
  function stroke(x, ry, w, h, color, lw) {
    doc.setDrawColor(...color);
    doc.setLineWidth(lw || 0.3);
    doc.rect(x, ry, w, h, 'S');
  }
  function roundFill(x, ry, w, h, color, strokeColor, r) {
    doc.setFillColor(...color);
    doc.setDrawColor(...(strokeColor || color));
    doc.setLineWidth(0.5);
    doc.roundedRect(x, ry, w, h, r || 2, r || 2, 'FD');
  }
  function txt(text, x, ry, size, style, color) {
    doc.setFontSize(size); doc.setFont('helvetica', style || 'normal');
    doc.setTextColor(...color); doc.text(String(text), x, ry);
  }
  function txtR(text, x, ry, size, style, color) {
    doc.setFontSize(size); doc.setFont('helvetica', style || 'normal');
    doc.setTextColor(...color); doc.text(String(text), x, ry, { align: 'right' });
  }
  function txtC(text, x, ry, size, style, color) {
    doc.setFontSize(size); doc.setFont('helvetica', style || 'normal');
    doc.setTextColor(...color); doc.text(String(text), x, ry, { align: 'center' });
  }

  function ensureSpace(h) {
    if (y + h > BOTTOM) {
      doc.addPage();
      bgFill(0, 0, W, PAGE_H, C.bg);
      y = 16;
    }
  }

  function addFooters() {
    const n = doc.internal.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      doc.setPage(p);
      bgFill(0, PAGE_H - 10, W, 10, C.primary);
      txt('STMS — Student Test Management System', M, PAGE_H - 3.5, 7, 'normal', C.white);
      txtR('Page ' + p + ' of ' + n, W - M, PAGE_H - 3.5, 7, 'normal', C.white);
    }
  }

  /* ── PAGE 1 ── */
  bgFill(0, 0, W, PAGE_H, C.bg);

  /* Header */
  bgFill(0, 0, W, 34, C.primary);
  txtC('EXAMINATION RESULT', W/2, 13, 16, 'bold', C.white);
  txtC('Student Performance Report', W/2, 21, 8, 'normal', C.white);
  txtC('Generated: ' + new Date().toLocaleString(), W/2, 28, 7.5, 'normal', C.white);
  y = 40;

  /* Score card */
  bgFill(M, y, CW, 68, C.white);
  stroke(M, y, CW, 68, C.border, 0.4);

  // Score ring - use roundedRect FD for reliable rounded look
  const cx = W/2, cy = y + 22, cr = 15;
  doc.setFillColor(...ringBg);
  doc.setDrawColor(...ringC);
  doc.setLineWidth(2.0);
  doc.roundedRect(cx - cr, cy - cr, cr*2, cr*2, cr, cr, 'FD');
  // Score inside
  doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.setTextColor(...ringC);
  doc.text(String(studentData.score), cx, cy - 1, { align: 'center' });
  txt('of ' + studentData.total, 0, 0, 7, 'normal', C.muted); // dummy, use proper below
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted);
  doc.text('of ' + studentData.total, cx, cy + 6, { align: 'center' });

  // Pct
  doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(...ringC);
  doc.text(pct + '%', cx, y + 46, { align: 'center' });

  // Title
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.text);
  doc.text(testData?.title || 'Exam Result', cx, y + 55, { align: 'center' });

  // Performance + Rank badges
  const bRow = y + 63;
  const perfW = 38, rankW = 44, gap = 4;
  const totalW = perfW + gap + rankW;
  const bStartX = cx - totalW / 2;

  bgFill(bStartX,        bRow - 5, perfW, 7, ringBg);
  stroke(bStartX,        bRow - 5, perfW, 7, ringC, 0.5);
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...ringC);
  doc.text(perf, bStartX + perfW/2, bRow, { align: 'center' });

  if (studentData.rank && studentData.totalStudents) {
    const rX = bStartX + perfW + gap;
    const medal = studentData.rank === 1 ? '1st' : studentData.rank === 2 ? '2nd' : studentData.rank === 3 ? '3rd' : '#' + studentData.rank;
    bgFill(rX, bRow - 5, rankW, 7, C.purpleL);
    stroke(rX, bRow - 5, rankW, 7, C.purple, 0.5);
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.purple);
    doc.text(medal + ' / ' + studentData.totalStudents + ' students', rX + rankW/2, bRow, { align: 'center' });
  }

  y += 76;

  /* Student details card */
  ensureSpace(38);
  bgFill(M, y, CW, 38, C.white);
  stroke(M, y, CW, 38, C.border, 0.3);

  const det = [
    ['STUDENT NAME', studentData.studentName || 'N/A'],
    ['REGISTER NO',  studentData.studentReg  || 'N/A'],
    ['TEST ID',      testId || 'N/A'],
    ['SCORE / GRADE', studentData.score + ' / ' + studentData.total + '   ' + grade + '   ' + (pct >= 40 ? 'PASS' : 'FAIL')],
  ];
  const hW = CW / 2;
  det.forEach(([lbl, val], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const fx = M + 8 + col * hW, fy = y + 10 + row * 14;
    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.muted);
    doc.text(lbl, fx, fy);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.text);
    doc.text(String(val), fx, fy + 5.5);
  });
  y += 46;

  /* Section label */
  ensureSpace(12);
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.muted);
  doc.text('QUESTION REVIEW', M, y);
  y += 3;
  doc.setDrawColor(...C.border); doc.setLineWidth(0.3); doc.line(M, y, M + CW, y);
  y += 7;

  /* Questions */
  if (testData?.questions && studentData.answers) {
    testData.questions.forEach((q, qi) => {
      const ans       = studentData.answers[qi];
      const breakdown = studentData.scoreBreakdown?.[qi] || null;
      const marks     = q.marks || 1;

      let attempted = false, isCorrect = false, earnedMarks = 0, partialNote = '';
      if (q.type === 'MCQ') {
        attempted   = ans !== null && ans !== undefined;
        isCorrect   = attempted && ans === q.correctIndex;
        earnedMarks = isCorrect ? marks : (attempted && q.negativeMarkingEnabled ? -(q.negativeMarks||0) : 0);
        if (attempted && !isCorrect && q.negativeMarkingEnabled)
          partialNote = '-' + q.negativeMarks + ' marks deducted';
      } else if (q.type === 'MSQ') {
        attempted = Array.isArray(ans) && ans.length > 0;
        if (attempted) {
          if (breakdown) {
            earnedMarks = breakdown.earned;
            partialNote = (breakdown.note || '').replace(/→/g, '=>');
            isCorrect   = earnedMarks >= marks;
          } else {
            const ci = q.correctIndexes || [], chosen = ans;
            const rp = chosen.filter(x => ci.includes(x)).length;
            const wp = chosen.filter(x => !ci.includes(x)).length;
            earnedMarks = ci.length ? parseFloat(((Math.max(0, rp-wp)/ci.length)*marks).toFixed(2)) : 0;
            isCorrect   = earnedMarks >= marks;
            partialNote = rp + '/' + ci.length + ' correct' + (wp>0?', '+wp+' wrong':'') + '  =>  ' + earnedMarks + ' marks';
          }
        }
      } else if (q.type === 'NAT') {
        attempted = ans !== null && ans !== undefined && ans !== '';
        if (attempted) {
          const sv = parseFloat(String(ans).trim()), cv = parseFloat(String(q.correctValue).trim());
          isCorrect   = !isNaN(sv) && !isNaN(cv) && sv === cv;
          earnedMarks = isCorrect ? marks : (q.negativeMarkingEnabled ? -(q.negativeMarks||0) : 0);
          if (!isCorrect && q.negativeMarkingEnabled)
            partialNote = '-' + q.negativeMarks + ' marks deducted';
        }
      }

      let accentC, statusTxt, statusFill, statusTxtC;
      if (!attempted) {
        accentC = C.muted;   statusTxt = 'Not Attempted'; statusFill = [241,245,249]; statusTxtC = C.muted;
      } else if (isCorrect) {
        accentC = C.success; statusTxt = 'Correct';       statusFill = C.successL;   statusTxtC = C.greenTxt;
      } else if (q.type === 'MSQ' && earnedMarks > 0) {
        accentC = C.warning; statusTxt = 'Partial ' + earnedMarks + '/' + marks; statusFill = C.warningL; statusTxtC = C.amberTxt;
      } else {
        accentC = C.danger;  statusTxt = 'Wrong';         statusFill = C.dangerL;    statusTxtC = C.redTxt;
      }

      const earnedStr = attempted ? (earnedMarks >= 0 ? '+' : '') + earnedMarks + ' / ' + marks : '0 / ' + marks;

      // Measure all option rows first
      const IX = M + 7;    // inner X start (after accent bar)
      const ROW_W = CW - 12;
      const TXT_MARGIN = 3;
      const LABEL_COL = 45;  // width reserved for label text on right
      const OPT_TXT_W = ROW_W - LABEL_COL - TXT_MARGIN * 3;

      function measureOptRows() {
        let h = 0;
        if (!attempted) {
          const w = ROW_W - TXT_MARGIN * 2;
          if (q.type === 'MCQ') {
            h += Math.max(8, doc.splitTextToSize('Correct Answer: ' + (q.options?.[q.correctIndex] || ''), w - LABEL_COL).length * 5 + 3) + 2;
          } else if (q.type === 'MSQ') {
            const txt2 = 'Correct: ' + (q.correctIndexes || []).map(ci => q.options?.[ci] || '').join(', ');
            h += Math.max(8, doc.splitTextToSize(txt2, w - LABEL_COL).length * 5 + 3) + 2;
          } else {
            h += 10;
          }
        } else if (q.type === 'MCQ') {
          (q.options || []).forEach(opt => {
            h += Math.max(8, doc.splitTextToSize(opt, OPT_TXT_W).length * 5 + 3) + 2;
          });
        } else if (q.type === 'MSQ') {
          (q.options || []).forEach(opt => {
            h += Math.max(8, doc.splitTextToSize(opt, OPT_TXT_W).length * 5 + 3) + 2;
          });
        } else {
          h += 10;
          if (!isCorrect) h += 10;
        }
        return h;
      }

      const qLines = doc.splitTextToSize(q.question || '', CW - 16);
      const qH = qLines.length * 5 + 2;
      const optH = measureOptRows();
      const expH = q.explanation ? (doc.splitTextToSize(q.explanation, CW - 20).length * 5 + 8) : 0;
      const cardH = 16 + qH + (partialNote ? 6 : 0) + optH + expH + 6;

      ensureSpace(cardH + 4);
      const cTop = y;

      // Draw card
      bgFill(M, cTop, CW, cardH, C.white);
      stroke(M, cTop, CW, cardH, C.border, 0.3);
      // Left accent bar
      bgFill(M, cTop, 3, cardH, accentC);

      let hy = cTop + 8;

      // Q label
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.muted);
      doc.text('Q' + (qi + 1), IX, hy);

      // Type badge (rounded pill)
      const typeFill = q.type === 'MCQ' ? [219,234,254] : q.type === 'MSQ' ? [237,233,254] : [254,243,199];
      const typeTC   = q.type === 'MCQ' ? [37,99,235]   : q.type === 'MSQ' ? [109,40,217]  : [180,100,0];
      roundFill(IX + 13, hy - 5.5, 15, 6.5, typeFill, typeTC, 3);
      doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...typeTC);
      doc.text(q.type, IX + 20.5, hy - 0.5, { align: 'center' });

      // Marks badge (rounded)
      roundFill(IX + 30, hy - 5.5, 20, 6.5, [241,245,249], C.border, 3);
      doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.muted);
      doc.text(earnedStr, IX + 40, hy - 0.5, { align: 'center' });

      // Status badge (rounded pill)
      const sBW = 38, sBX = M + CW - sBW - 5;
      roundFill(sBX, hy - 5.5, sBW, 6.5, statusFill, accentC, 3);
      doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...statusTxtC);
      doc.text(statusTxt, sBX + sBW/2, hy - 0.5, { align: 'center' });

      hy += 6;

      // Question text
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.text);
      doc.text(qLines, IX, hy);
      hy += qH + 2;

      // Partial note
      if (partialNote) {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(...C.warning);
        doc.text(partialNote, IX, hy);
        hy += 6;
      }

      // ── Option rows ──────────────────────────────────────────
      // Each row: colored bg + option text left + label text right (with border box)
      function drawOptRow(optText, bg, borderClr, textClr, labelTxt, labelClr) {
        const wrLines = doc.splitTextToSize(optText, bg ? OPT_TXT_W : ROW_W - TXT_MARGIN * 2);
        const rh = Math.max(8, wrLines.length * 5 + 3);
        const rX = IX - 1, rW = ROW_W;

        if (bg) {
          bgFill(rX, hy - 4, rW, rh, bg);
        }
        stroke(rX, hy - 4, rW, rh, borderClr || C.border, bg ? 0.5 : 0.25);

        // Option text
        doc.setFontSize(8.5); doc.setFont('helvetica', bg ? 'bold' : 'normal');
        doc.setTextColor(...(textClr || C.text));
        doc.text(wrLines, rX + TXT_MARGIN, hy);

        // Right label (in its own bordered box)
        if (labelTxt && bg) {
          const lW = LABEL_COL - 4;
          const lX = rX + rW - lW - TXT_MARGIN;
          const lY = hy - 4 + (rh - 6) / 2;
          bgFill(lX, lY, lW, 6, labelClr || borderClr || C.muted);
          doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          doc.text(labelTxt, lX + lW/2, lY + 4.2, { align: 'center' });
        }

        hy += rh + 2;
      }

      if (!attempted) {
        if (q.type === 'MCQ') {
          const correctOpt = q.options?.[q.correctIndex] || 'Option ' + (q.correctIndex + 1);
          drawOptRow('Correct Answer: ' + correctOpt, C.warningL, C.warning, C.amberTxt, 'CORRECT', C.warning);
        } else if (q.type === 'MSQ') {
          const corr = (q.correctIndexes || []).map(ci => q.options?.[ci] || 'Opt'+(ci+1)).join(', ');
          drawOptRow('Correct Answers: ' + corr, C.warningL, C.warning, C.amberTxt, 'CORRECT', C.warning);
        } else {
          drawOptRow('Correct Answer: ' + q.correctValue, C.warningL, C.warning, C.amberTxt, 'CORRECT', C.warning);
        }
      } else if (q.type === 'MCQ') {
        (q.options || []).forEach((opt, oi) => {
          const isCrr = oi === q.correctIndex, isYrs = oi === ans;
          if (isCrr && isYrs)   drawOptRow(opt, C.successL, C.success, C.greenTxt, 'YOUR ANSWER (CORRECT)', C.success);
          else if (isCrr)       drawOptRow(opt, C.warningL, C.warning, C.amberTxt, 'CORRECT ANSWER',        C.warning);
          else if (isYrs)       drawOptRow(opt, C.dangerL,  C.danger,  C.redTxt,   'YOUR ANSWER (WRONG)',   C.danger);
          else                  drawOptRow(opt, null, null, C.text, null, null);
        });
      } else if (q.type === 'MSQ') {
        const ci = q.correctIndexes || [];
        (q.options || []).forEach((opt, oi) => {
          const isCrr = ci.includes(oi), isYrs = Array.isArray(ans) && ans.includes(oi);
          if (isCrr && isYrs)   drawOptRow(opt, C.successL, C.success, C.greenTxt, 'CORRECT',       C.success);
          else if (isCrr)       drawOptRow(opt, C.warningL, C.warning, C.amberTxt, 'MISSED',         C.warning);
          else if (isYrs)       drawOptRow(opt, C.dangerL,  C.danger,  C.redTxt,   'WRONG CHOICE',   C.danger);
          else                  drawOptRow(opt, null, null, C.text, null, null);
        });
      } else {
        drawOptRow('Your Answer: ' + String(ans ?? 'Not answered'),
          isCorrect ? C.successL : C.dangerL,
          isCorrect ? C.success  : C.danger,
          isCorrect ? C.greenTxt : C.redTxt,
          isCorrect ? 'CORRECT' : 'WRONG',
          isCorrect ? C.success  : C.danger);
        if (!isCorrect)
          drawOptRow('Correct Answer: ' + q.correctValue, C.warningL, C.warning, C.amberTxt, 'EXPECTED', C.warning);
      }

      // Explanation
      if (q.explanation) {
        const expLines2 = doc.splitTextToSize(q.explanation, CW - 20);
        const eh = expLines2.length * 5 + 5;
        bgFill(IX - 1, hy - 3, ROW_W, eh, [255, 251, 235]);
        stroke(IX - 1, hy - 3, ROW_W, eh, [253, 230, 138], 0.3);
        doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(146, 64, 14);
        doc.text(expLines2, IX + 1, hy + 1);
        hy += eh + 1;
      }

      y = hy + 5;
    });
  }

  addFooters();

  const sn = (studentData.studentName || 'student').replace(/\s+/g, '_');
  doc.save('Result_' + sn + '_' + testId + '.pdf');
  showToast('Result PDF downloaded!', 'success');
}

loadResult();