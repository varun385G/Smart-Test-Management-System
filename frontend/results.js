async function loadResults() {
  const testId = new URLSearchParams(location.search).get("testId");

  fetch(`/api/results/${testId}`)
    .then(res => res.json())
    .then(data => {
      const table = document.getElementById("resultTable");
      table.innerHTML = "";

      data.forEach(r => {
        table.innerHTML += `
          <tr>
            <td>${r.studentName}</td>
            <td>${r.studentReg}</td>
            <td>${r.score}/${r.total}</td>
            <td>${new Date(r.submittedAt).toLocaleString()}</td>
          </tr>
        `;
      });
    });
}

loadResults();

function exportCSV() {
  const testId = new URLSearchParams(location.search).get("testId");
  if (!testId) {
    alert("Invalid test ID");
    return;
  }

  window.location.href = `/api/results/${testId}/csv`;
}
