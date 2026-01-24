async function loadResults() {
  const testId = new URLSearchParams(window.location.search).get("testId");

  if (!testId) {
    alert("Invalid Test ID");
    return;
  }

  try {
    const res = await fetch(`/api/results/${testId}`);
    const data = await res.json();

    const tbody = document.getElementById("resultTable");
    tbody.innerHTML = "";

    if (!data || data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="center muted">No results found</td>
        </tr>
      `;
      return;
    }

    data.forEach(r => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${r.studentName}</td>
        <td>${r.studentReg}</td>
        <td>${r.score}/${r.total}</td>
      `;

      tbody.appendChild(row);
    });

  } catch (err) {
    console.error("RESULT LOAD ERROR:", err);
    alert("Failed to load results");
  }
}

function goBack() {
  window.location.href = "/dashboard.html";
}

loadResults();
