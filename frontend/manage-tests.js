const staffId = localStorage.getItem("staffId");

if (!staffId) {
  document.body.innerHTML = "<h2 class='center'>Access denied</h2>";
  throw new Error("No staff login");
}

function goBack() {
  location.href = "/dashboard.html";
}

async function loadTests() {
  const res = await fetch(`/api/tests/by-staff/${staffId}`);
  const tests = await res.json();

  const table = document.getElementById("testTable");
  table.innerHTML = "";

  tests.forEach(t => {
    const tr = document.createElement("tr");

    let postBtn = "";

    if (t.resultsPublished) {
      postBtn = `
        <button class="danger" disabled style="opacity:0.6">
          Results Published
        </button>
      `;
    } else {
      postBtn = `
        <button onclick="publishResults('${t.testId}', this)">
          Post Results
        </button>
      `;
    }

    tr.innerHTML = `
      <td>${t.testId}</td>
      <td>${t.title}</td>
      <td>${t.attempts}</td>
      <td>
        <button onclick="viewResults('${t.testId}')">View</button>
        ${postBtn}
        <button class="danger" onclick="deleteTest('${t._id}')">Delete</button>
      </td>
    `;

    table.appendChild(tr);
  });
}

function viewResults(testId) {
  location.href = `/results.html?testId=${testId}`;
}

async function publishResults(testId, btn) {
  if (!confirm("Once published, students can view results.\nContinue?")) return;

  const res = await fetch(`/api/tests/${testId}/publish-results`, {
    method: "POST"
  });

  if (!res.ok) {
    alert("Failed to publish results");
    return;
  }

  // UI feedback
  btn.innerText = "Results Published";
  btn.className = "danger";
  btn.disabled = true;
  btn.style.opacity = "0.6";
}

async function deleteTest(id) {
  if (!confirm("Delete this test permanently?")) return;

  await fetch(`/api/tests/${id}`, { method: "DELETE" });
  loadTests();
}

loadTests();
