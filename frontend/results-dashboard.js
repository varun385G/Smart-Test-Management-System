const staffId = localStorage.getItem("staffId");

if (!staffId) {
  window.location.href = "/staff";
}

function goBack() {
  window.location.href = "/dashboard.html";
}

async function loadResults() {
  const tbody = document.getElementById("testResults");
  tbody.innerHTML = `
    <tr>
      <td colspan="4" style="text-align:center; color:var(--muted);">
        Loading results...
      </td>
    </tr>
  `;

  try {
    const res = await fetch(`/api/tests/by-staff/${staffId}`);
    if (!res.ok) throw new Error();

    const tests = await res.json();
    tbody.innerHTML = "";

    if (tests.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; color:var(--muted);">
            No tests found
          </td>
        </tr>
      `;
      return;
    }

    tests.forEach(test => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${test.testId}</td>
        <td>${test.title}</td>
        <td>${test.attempts || 0}</td>
        <td>
          <button class="btn"
                  onclick="view('${test.testId}')">
            View
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });

  } catch {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; color:#dc2626;">
          Failed to load results
        </td>
      </tr>
    `;
  }
}

function view(testId) {
  window.location.href = `/results.html?testId=${testId}`;
}

loadResults();
