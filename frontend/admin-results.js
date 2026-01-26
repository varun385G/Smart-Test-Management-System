async function loadAdminResults() {
  const container = document.getElementById("adminResults");

  if (!container) {
    console.error("adminResults container missing");
    return;
  }

  container.innerHTML = "<p>Loading results...</p>";

  try {
    const res = await fetch("/api/admin/results/grouped");

    if (!res.ok) throw new Error("Failed to load admin results");

    const data = await res.json();
    container.innerHTML = "";

    if (Object.keys(data).length === 0) {
      container.innerHTML = "<p>No staff or results found</p>";
      return;
    }

    Object.values(data).forEach(staff => {
      const staffCard = document.createElement("div");
      staffCard.className = "card staff-card";

      staffCard.innerHTML = `<h3>👤 ${staff.staffName}</h3>`;

      const tests = staff.tests || {};
      if (Object.keys(tests).length === 0) {
        staffCard.innerHTML += "<p class='muted'>No tests</p>";
      }

      Object.entries(tests).forEach(([testId, test]) => {
        const testDiv = document.createElement("div");
        testDiv.className = "test-block";

        testDiv.innerHTML = `
          <h4>📘 ${test.testTitle} <span class="muted">(${testId})</span></h4>
        `;

        if (!test.results.length) {
          testDiv.innerHTML += `<p class="muted">No attempts</p>`;
        } else {
          const table = document.createElement("table");
          table.innerHTML = `
            <tr>
              <th>Student</th>
              <th>Register No</th>
              <th>Score</th>
            </tr>
          `;

          test.results.forEach(r => {
            table.innerHTML += `
              <tr>
                <td>${r.studentName}</td>
                <td>${r.studentReg}</td>
                <td>${r.score}/${r.total}</td>
              </tr>
            `;
          });

          testDiv.appendChild(table);
        }

        staffCard.appendChild(testDiv);
      });

      container.appendChild(staffCard);
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Error loading admin results</p>";
  }
}

loadAdminResults();

function goBack() {
  location.href = "/dashboard.html";
}
