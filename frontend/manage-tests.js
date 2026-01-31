const staffId = localStorage.getItem("staffId");

if (!staffId) {
  document.body.innerHTML = `
    <div class="container center" style="padding:40px;">
      <div class="card">
        <h2>Access denied</h2>
      </div>
    </div>
  `;
  throw new Error("No staff login");
}

function goBack() {
  location.href = "/dashboard.html";
}

async function loadTests() {
  try {
    const res = await fetch(`/api/tests/by-staff/${staffId}`);
    if (!res.ok) throw new Error();

    const tests = await res.json();
    const table = document.getElementById("testTable");
    table.innerHTML = "";

    tests.forEach(t => {
      const tr = document.createElement("tr");

      let postBtnHtml = "";

      if (t.resultsPublished) {
        postBtnHtml = `
          <button class="btn" disabled style="opacity:0.6;">
            Results Published
          </button>
        `;
      } else {
        postBtnHtml = `
          <button class="btn btn-primary"
                  onclick="publishResults('${t.testId}', this)">
            Post Results
          </button>
        `;
      }

      tr.innerHTML = `
        <td>${t.testId}</td>
        <td>${t.title}</td>
        <td>${t.attempts}</td>
        <td>
          <button class="btn"
                  onclick="viewResults('${t.testId}')">
            View
          </button>
          ${postBtnHtml}
          <button class="btn"
                  onclick="deleteTest('${t._id}')">
            Delete
          </button>
        </td>
      `;

      table.appendChild(tr);
    });

  } catch {
    alert("Failed to load tests");
  }
}

function viewResults(testId) {
  location.href = `/results.html?testId=${testId}`;
}

async function publishResults(testId, btn) {
  if (!confirm("Once published, students can view results. Continue?")) return;

  btn.disabled = true;
  btn.style.opacity = "0.6";
  btn.innerText = "Publishing...";

  try {
    const res = await fetch(`/api/tests/${testId}/publish-results`, {
      method: "POST"
    });

    if (!res.ok) throw new Error();

    btn.innerText = "Results Published";

  } catch {
    alert("Failed to publish results");
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.innerText = "Post Results";
  }
}

async function deleteTest(id) {
  if (!confirm("Delete this test permanently?")) return;

  try {
    await fetch(`/api/tests/${id}`, { method: "DELETE" });
    loadTests();
  } catch {
    alert("Failed to delete test");
  }
}

loadTests();
