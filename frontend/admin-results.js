const _arRole = localStorage.getItem('staffRole');
if (_arRole !== 'admin') { window.location.href = '/dashboard.html'; throw new Error('Access denied'); }

/* ── state ─────────────────────────────── */
let allGroupedData = {};   // full API response, keyed by staffId

/* ── load ───────────────────────────────── */
async function loadAdminResults() {
  const container = document.getElementById("adminResults");

  if (!container) { console.error("adminResults container missing"); return; }

  container.innerHTML = `
    <div class="card" style="text-align:center; color:var(--muted);">Loading results...</div>
  `;

  try {
    const res = await fetch("/api/admin/results/grouped");
    if (!res.ok) throw new Error("Failed to load admin results");

    const data = await res.json();
    allGroupedData = data;
    container.innerHTML = "";

    if (Object.keys(data).length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align:center; color:var(--muted);">No staff or results found</div>
      `;
      return;
    }

    /* enable global download buttons if any published results exist */
    const anyPublished = Object.values(data).some(s =>
      Object.values(s.tests || {}).some(t => t.resultsPublished && t.results.length)
    );
    if (anyPublished) {
      document.getElementById("btnDownloadAll").disabled = false;
    }

    Object.values(data).forEach(staff => {
      const staffCard = document.createElement("div");
      staffCard.className = "card";
      staffCard.style.marginBottom = "24px";

      /* staff header */
      const staffHeader = document.createElement("div");
      staffHeader.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;";
      staffHeader.innerHTML = `
        <h3 style="margin:0;">${staff.staffName}</h3>
      `;

      /* per-staff download buttons (only if staff has published results) */
      const staffHasResults = Object.values(staff.tests || {}).some(
        t => t.resultsPublished && t.results.length
      );
      if (staffHasResults) {
        const staffBtns = document.createElement("div");
        staffBtns.style.cssText = "position:relative;";
        staffBtns.innerHTML = `
          <button class="btn btn-primary" onclick="toggleDropdown(this)" style="gap:6px;">
            ⬇ Download ▾
          </button>
          <div class="dl-dropdown" style="display:none; position:absolute; right:0; top:calc(100% + 4px); background:var(--card); border:1px solid var(--border); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.12); z-index:50; min-width:140px; overflow:hidden;">
            <button onclick="downloadStaffExcel('${staff.staffName}'); closeAllDropdowns();" style="width:100%; text-align:left; padding:10px 16px; font-size:13.5px; background:none; border:none; cursor:pointer; color:var(--text); font-family:var(--font-main);" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='none'">📊 Excel</button>
            <button onclick="downloadStaffPdf('${staff.staffName}'); closeAllDropdowns();" style="width:100%; text-align:left; padding:10px 16px; font-size:13.5px; background:none; border:none; cursor:pointer; color:var(--text); font-family:var(--font-main);" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='none'">📄 PDF</button>
          </div>
        `;
        staffHeader.appendChild(staffBtns);
      }

      staffCard.appendChild(staffHeader);

      const tests = staff.tests || {};

      if (Object.keys(tests).length === 0) {
        const noTest = document.createElement("p");
        noTest.innerText = "No tests";
        noTest.style.color = "var(--muted)";
        staffCard.appendChild(noTest);
      }

      Object.entries(tests).forEach(([testId, test]) => {
        const testDiv = document.createElement("div");
        testDiv.style.marginTop = "16px";

        /* test header row */
        const testHeader = document.createElement("div");
        testHeader.style.cssText = "display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;";

        const testTitle = document.createElement("div");
        testTitle.innerHTML = `
          <h4 style="margin:0;">
            ${test.testTitle}
            <span style="color:var(--muted); font-size:13px;">(${testId})</span>
            ${test.resultsPublished
              ? '<span style="color:#16a34a; font-size:12px; margin-left:8px; font-weight:600;">● Published</span>'
              : '<span style="color:#dc2626; font-size:12px; margin-left:8px;">● Unpublished</span>'}
          </h4>
        `;
        testHeader.appendChild(testTitle);

        /* per-test download buttons (only if published and has results) */
        if (test.resultsPublished && test.results.length) {

        }

        testDiv.appendChild(testHeader);

        if (!test.results.length) {
          const noAttempt = document.createElement("p");
          noAttempt.innerText = "No attempts";
          noAttempt.style.color = "var(--muted)";
          testDiv.appendChild(noAttempt);
        } else {
          const table = document.createElement("table");
          table.className = "table";
          table.style.marginTop = "8px";
          table.innerHTML = `
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                <th>Register No</th>
                <th>Score</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody></tbody>
          `;

          const tbody = table.querySelector("tbody");
          test.results.forEach((r, i) => {
            const pct = r.total ? ((r.score / r.total) * 100).toFixed(1) + "%" : "N/A";
            const row = document.createElement("tr");
            row.innerHTML = `
              <td>${i + 1}</td>
              <td>${r.studentName}</td>
              <td>${r.studentReg}</td>
              <td>${r.score}/${r.total}</td>
              <td>${pct}</td>
            `;
            tbody.appendChild(row);
          });

          testDiv.appendChild(table);
        }

        staffCard.appendChild(testDiv);
      });

      container.appendChild(staffCard);
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="card" style="text-align:center; color:#dc2626;">Error loading admin results</div>
    `;
  }
}

/* ── helpers ────────────────────────────── */
function escapeAttr(str) {
  return (str || "").replace(/'/g, "\\'");
}

function getStaffResults(staffName) {
  return Object.values(allGroupedData).filter(s => s.staffName === staffName);
}

function flatRows(results) {
  return results.map((r, i) => ({
    "#"            : i + 1,
    "Student Name" : r.studentName,
    "Register No"  : r.studentReg,
    "Score"        : r.score,
    "Total"        : r.total,
    "Percentage"   : r.total ? ((r.score / r.total) * 100).toFixed(1) + "%" : "N/A"
  }));
}

/* ══ PER-TEST downloads ═══════════════════ */
function getTestData(testId) {
  for (const staff of Object.values(allGroupedData)) {
    if (staff.tests && staff.tests[testId]) {
      return { staff: staff.staffName, test: staff.tests[testId] };
    }
  }
  return null;
}

function downloadTestExcel(testId, testTitle, staffName) {
  const info = getTestData(testId);
  if (!info || !info.test.results.length) return;

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(flatRows(info.test.results));
  ws["!cols"] = [{ wch:5 },{ wch:25 },{ wch:16 },{ wch:8 },{ wch:8 },{ wch:12 }];
  XLSX.utils.book_append_sheet(wb, ws, "Results");
  XLSX.writeFile(wb, `${testTitle}_Results.xlsx`);
}

function downloadTestPdf(testId, testTitle, staffName) {
  const info = getTestData(testId);
  if (!info || !info.test.results.length) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${testTitle} – Results Report`, 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Test ID: ${testId}   |   Staff: ${info.staff}   |   ${new Date().toLocaleString()}`, 14, 26);
  doc.setTextColor(0);

  _addSummaryLine(doc, info.test.results, 34);

  doc.autoTable({
    startY: 40,
    head: [["#", "Student Name", "Register No", "Score", "Total", "%"]],
    body: info.test.results.map((r, i) => [
      i + 1, r.studentName, r.studentReg, r.score, r.total,
      r.total ? ((r.score / r.total) * 100).toFixed(1) + "%" : "N/A"
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 246, 255] }
  });

  doc.save(`${testTitle}_Results.pdf`);
}

/* ══ PER-STAFF downloads ══════════════════ */
function downloadStaffExcel(staffName) {
  const staff = Object.values(allGroupedData).find(s => s.staffName === staffName);
  if (!staff) return;

  const wb = XLSX.utils.book_new();
  let added = false;

  Object.entries(staff.tests || {}).forEach(([testId, test]) => {
    if (!test.resultsPublished || !test.results.length) return;
    const ws = XLSX.utils.json_to_sheet(flatRows(test.results));
    ws["!cols"] = [{ wch:5 },{ wch:25 },{ wch:16 },{ wch:8 },{ wch:8 },{ wch:12 }];
    const sheetName = (test.testTitle || testId).substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    added = true;
  });

  if (!added) return;
  XLSX.writeFile(wb, `${staffName}_All_Results.xlsx`);
}

function downloadStaffPdf(staffName) {
  const staff = Object.values(allGroupedData).find(s => s.staffName === staffName);
  if (!staff) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 14;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${staffName} – All Test Results`, 14, y); y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y); y += 10;
  doc.setTextColor(0);

  Object.entries(staff.tests || {}).forEach(([testId, test]) => {
    if (!test.resultsPublished || !test.results.length) return;

    if (y > 250) { doc.addPage(); y = 14; }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`${test.testTitle} (${testId})`, 14, y); y += 6;

    _addSummaryLine(doc, test.results, y); y += 6;

    doc.autoTable({
      startY: y,
      head: [["#", "Student Name", "Register No", "Score", "Total", "%"]],
      body: test.results.map((r, i) => [
        i + 1, r.studentName, r.studentReg, r.score, r.total,
        r.total ? ((r.score / r.total) * 100).toFixed(1) + "%" : "N/A"
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 246, 255] },
      margin: { left: 14 }
    });

    y = doc.lastAutoTable.finalY + 12;
  });

  doc.save(`${staffName}_All_Results.pdf`);
}

/* ══ ALL-RESULTS downloads ════════════════ */
function downloadAllExcel() {
  const wb = XLSX.utils.book_new();
  let added = false;

  Object.values(allGroupedData).forEach(staff => {
    Object.entries(staff.tests || {}).forEach(([testId, test]) => {
      if (!test.resultsPublished || !test.results.length) return;
      const rows = flatRows(test.results).map(r => ({ "Staff": staff.staffName, "Test": test.testTitle, ...r }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch:20 },{ wch:20 },{ wch:5 },{ wch:25 },{ wch:16 },{ wch:8 },{ wch:8 },{ wch:12 }];
      const sheetName = (`${staff.staffName}_${test.testTitle}`).substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      added = true;
    });
  });

  if (!added) return;
  XLSX.writeFile(wb, `All_Results_${new Date().toLocaleDateString("en-GB").replace(/\//g,"-")}.xlsx`);
}

function downloadAllPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 14;
  let first = true;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("All Results Report", 14, y); y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y); y += 10;
  doc.setTextColor(0);

  Object.values(allGroupedData).forEach(staff => {
    const publishedTests = Object.entries(staff.tests || {}).filter(
      ([, t]) => t.resultsPublished && t.results.length
    );
    if (!publishedTests.length) return;

    if (y > 260) { doc.addPage(); y = 14; }

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`Staff: ${staff.staffName}`, 14, y); y += 8;

    publishedTests.forEach(([testId, test]) => {
      if (y > 250) { doc.addPage(); y = 14; }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`  ${test.testTitle} (${testId})`, 14, y); y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      _addSummaryLine(doc, test.results, y); y += 6;

      doc.autoTable({
        startY: y,
        head: [["#", "Student Name", "Register No", "Score", "Total", "%"]],
        body: test.results.map((r, i) => [
          i + 1, r.studentName, r.studentReg, r.score, r.total,
          r.total ? ((r.score / r.total) * 100).toFixed(1) + "%" : "N/A"
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [240, 246, 255] }
      });

      y = doc.lastAutoTable.finalY + 10;
    });

    y += 4;
  });

  doc.save(`All_Results_${new Date().toLocaleDateString("en-GB").replace(/\//g,"-")}.pdf`);
}

/* ── shared summary line ────────────────── */
function _addSummaryLine(doc, results, y) {
  const scores = results.map(r => r.score);
  const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text(
    `Students: ${results.length}   Avg: ${avg}   High: ${Math.max(...scores)}   Low: ${Math.min(...scores)}`,
    14, y
  );
  doc.setTextColor(0);
}

/* ── nav ────────────────────────────────── */
function goBack() {
  location.href = "/dashboard.html";
}

loadAdminResults();
/* ── Dropdown helpers ─────────────────────── */
function toggleDropdown(btn) {
  const dropdown = btn.nextElementSibling;
  const isOpen = dropdown.style.display === 'block';
  closeAllDropdowns();
  if (!isOpen) dropdown.style.display = 'block';
}

function closeAllDropdowns() {
  document.querySelectorAll('.dl-dropdown').forEach(d => d.style.display = 'none');
}

document.addEventListener('click', e => {
  if (!e.target.closest('[onclick*="toggleDropdown"]')) closeAllDropdowns();
});