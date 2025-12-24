const staffId = localStorage.getItem("staffId");

if (!staffId) {
  window.location.href = "/staff";
}

function goBack() {
  window.location.href = "/dashboard.html";
}

async function loadResults() {
  const res = await fetch(`/api/tests/by-staff/${staffId}`);
  const tests = await res.json();

  const tbody = document.getElementById("testResults");
  tbody.innerHTML = "";

  tests.forEach(test => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${test.testId}</td>
      <td>${test.title}</td>
      <td>${test.attempts || 0}</td>
      <td>
        <button onclick="view('${test.testId}')">View</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function view(testId) {
  window.location.href = `/results.html?testId=${testId}`;
}

loadResults();
