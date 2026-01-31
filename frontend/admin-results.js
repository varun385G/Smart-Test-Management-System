async function loadAdminResults() {
  const container = document.getElementById("adminResults");

  if (!container) {
    console.error("adminResults container missing");
    return;
  }

  /* Loading state */
  container.innerHTML = `
    <div class="card" style="text-align:center; color:var(--muted);">
      Loading results...
    </div>
  `;

  try {
    const res = await fetch("/api/admin/results/grouped");

    if (!res.ok) throw new Error("Failed to load admin results");

    const data = await res.json();
    container.innerHTML = "";

    if (Object.keys(data).length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align:center; color:var(--muted);">
          No staff or results found
        </div>
      `;
      return;
    }

    Object.values(data).forEach(staff => {
      const staffCard = document.createElement("div");
      staffCard.className = "card";
      staffCard.style.marginBottom = "24px";

      const staffTitle = document.createElement("h3");
      staffTitle.innerText = staff.staffName;
      staffTitle.style.marginTop = "0";

      staffCard.appendChild(staffTitle);

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

        const testTitle = document.createElement("h4");
        testTitle.innerHTML = `
          ${test.testTitle}
          <span style="color:var(--muted); font-size:13px;">
            (${testId})
          </span>
        `;
        testTitle.style.marginBottom = "8px";

        testDiv.appendChild(testTitle);

        if (!test.results.length) {
          const noAttempt = document.createElement("p");
          noAttempt.innerText = "No attempts";
          noAttempt.style.color = "var(--muted)";
          testDiv.appendChild(noAttempt);
        } else {
          const table = document.createElement("table");
          table.className = "table";

          table.innerHTML = `
            <thead>
              <tr>
                <th>Student</th>
                <th>Register No</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody></tbody>
          `;

          const tbody = table.querySelector("tbody");

          test.results.forEach(r => {
            const row = document.createElement("tr");
            row.innerHTML = `
              <td>${r.studentName}</td>
              <td>${r.studentReg}</td>
              <td>${r.score}/${r.total}</td>
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
      <div class="card" style="text-align:center; color:#dc2626;">
        Error loading admin results
      </div>
    `;
  }
}

loadAdminResults();

function goBack() {
  location.href = "/dashboard.html";
}
