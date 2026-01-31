async function loadResults() {
  const testId = new URLSearchParams(window.location.search).get("testId");
  const tbody = document.getElementById("results");

  if (!tbody) {
    console.error("results tbody not found");
    return;
  }

  tbody.innerHTML = `
    <tr>
      <td colspan="3" style="text-align:center; color:var(--muted);">
        Loading results...
      </td>
    </tr>
  `;

  try {
    const res = await fetch(`/api/results/${testId}`);

    if (res.status === 403) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; color:var(--muted);">
            Results not published yet
          </td>
        </tr>
      `;
      return;
    }

    if (!res.ok) throw new Error();

    const data = await res.json();

    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; color:var(--muted);">
            No attempts yet
          </td>
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

  } catch (err) {
    console.error("RESULT LOAD ERROR:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align:center; color:#dc2626;">
          Error loading results
        </td>
      </tr>
    `;
  }
}

function goDashboard() {
  window.location.href = "/dashboard.html";
}

loadResults();
