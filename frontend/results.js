async function loadResults() {
  const testId = new URLSearchParams(window.location.search).get("testId");
  const tbody = document.getElementById("results");

  // 🛑 Safety check
  if (!tbody) {
    console.error("❌ <tbody id='results'> not found in HTML");
    return;
  }

  tbody.innerHTML = `
    <tr>
      <td colspan="4" style="text-align:center;">Loading...</td>
    </tr>
  `;

  try {
    const res = await fetch(`/api/results/${testId}`);

    // 🔒 Results not published
    if (res.status === 403) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;">
            Results not published yet
          </td>
        </tr>
      `;
      return;
    }

    // ❌ Any other error
    if (!res.ok) {
      throw new Error("Failed to load results");
    }

    const data = await res.json();

    // 🟡 No attempts
    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;">
            No attempts yet
          </td>
        </tr>
      `;
      return;
    }

    // ✅ Render results
    tbody.innerHTML = "";

    data.forEach(r => {
      tbody.innerHTML += `
        <tr>
          <td>${r.studentName}</td>
          <td>${r.studentReg}</td>
          <td>${r.score} / ${r.total}</td>
          <td>${new Date(r.submittedAt).toLocaleString()}</td>
        </tr>
      `;
    });

  } catch (err) {
    console.error("RESULT LOAD ERROR:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;">
          Error loading results
        </td>
      </tr>
    `;
  }
}

// ⬅ Dashboard button
function goDashboard() {
  window.location.href = "/dashboard.html";
}

loadResults();
