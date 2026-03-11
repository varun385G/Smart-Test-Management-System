/* ── state ─────────────────────────────── */
let currentTestId   = null;
let currentTestTitle = "Results";
let currentResults  = [];

/* ── load ───────────────────────────────── */
async function loadResults() {
  currentTestId = new URLSearchParams(window.location.search).get("testId");
  const tbody = document.getElementById("results");

  if (!tbody) { console.error("results tbody not found"); return; }

  tbody.innerHTML = `
    <tr>
      <td colspan="3" style="text-align:center; color:var(--muted);">Loading results...</td>
    </tr>
  `;

  try {
    const res = await fetch(`/api/results/${currentTestId}`);

    if (res.status === 403) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; color:var(--muted);">Results not published yet</td>
        </tr>
      `;
      return;
    }

    if (!res.ok) throw new Error();

    const data = await res.json();
    currentResults = data;

    /* try to get test title */
    try {
      const tr = await fetch(`/api/tests/${currentTestId}`);
      if (tr.ok) {
        const t = await tr.json();
        currentTestTitle = t.title || currentTestId;
        const meta = document.getElementById("testMeta");
        if (meta) meta.textContent = `Test: ${currentTestTitle} (${currentTestId})`;
      }
    } catch (_) {}

    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; color:var(--muted);">No attempts yet</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = "";
    data.forEach(r => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${r.studentName}</td>
        <td>${r.studentReg}</td>
        <td>${r.score} / ${r.total}</td>
      `;
      tbody.appendChild(row);
    });

    /* enable download buttons */
    document.getElementById("btnDownloadExcel").disabled = false;
    document.getElementById("btnDownloadPdf").disabled   = false;

  } catch (err) {
    console.error("RESULT LOAD ERROR:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align:center; color:#dc2626;">Error loading results</td>
      </tr>
    `;
  }
}

/* ── excel download ─────────────────────── */
function downloadExcel() {
  if (!currentResults.length) return;

  const rows = currentResults.map((r, i) => ({
    "#"            : i + 1,
    "Student Name" : r.studentName,
    "Register No"  : r.studentReg,
    "Score"        : r.score,
    "Total"        : r.total,
    "Percentage"   : r.total ? ((r.score / r.total) * 100).toFixed(1) + "%" : "N/A"
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  /* column widths */
  ws["!cols"] = [
    { wch: 5 }, { wch: 25 }, { wch: 16 }, { wch: 8 }, { wch: 8 }, { wch: 12 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Results");
  XLSX.writeFile(wb, `${currentTestTitle}_Results.xlsx`);
}

/* ── pdf download ───────────────────────── */
function downloadPdf() {
  if (!currentResults.length) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  /* title */
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${currentTestTitle} – Results Report`, 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Test ID: ${currentTestId}   |   Generated: ${new Date().toLocaleString()}`, 14, 26);
  doc.setTextColor(0);

  /* summary */
  const scores = currentResults.map(r => r.score);
  const totals  = currentResults.map(r => r.total);
  const avg     = (scores.reduce((a,b)=>a+b,0) / scores.length).toFixed(1);
  const maxS    = Math.max(...scores);
  const minS    = Math.min(...scores);

  doc.setFontSize(10);
  doc.text(
    `Total Students: ${currentResults.length}   Avg Score: ${avg}   Highest: ${maxS}   Lowest: ${minS}`,
    14, 34
  );

  /* table */
  doc.autoTable({
    startY: 40,
    head: [["#", "Student Name", "Register No", "Score", "Total", "Percentage"]],
    body: currentResults.map((r, i) => [
      i + 1,
      r.studentName,
      r.studentReg,
      r.score,
      r.total,
      r.total ? ((r.score / r.total) * 100).toFixed(1) + "%" : "N/A"
    ]),
    styles      : { fontSize: 10 },
    headStyles  : { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 246, 255] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 60 },
      2: { cellWidth: 35 },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 18, halign: "center" },
      5: { cellWidth: 25, halign: "center" }
    }
  });

  doc.save(`${currentTestTitle}_Results.pdf`);
}

/* ── nav ────────────────────────────────── */
function goDashboard() {
  window.location.href = "/dashboard.html";
}

loadResults();