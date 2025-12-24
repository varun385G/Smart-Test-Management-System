async function loadResults() {
  const testId = document.getElementById("testId").value;

  const res = await fetch(`/api/results/${testId}`);
  const data = await res.json();

  const tbody = document.getElementById("results");
  tbody.innerHTML = "";

  data.forEach(r => {
    tbody.innerHTML += `
      <tr>
        <td>${r.studentName}</td>
        <td>${r.studentReg}</td>
        <td>${r.score}/${r.total}</td>
        <td>${new Date(r.submittedAt).toLocaleString()}</td>
      </tr>
    `;
  });
}
