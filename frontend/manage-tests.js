const staffId = localStorage.getItem("staffId");

if (!staffId) {
  window.location.href = "/staff";
}

// ================= ACTIVITY LOGGER =================
function addActivity(text) {
  const activities = JSON.parse(localStorage.getItem("activities")) || [];

  activities.unshift({
    text,
    time: new Date().toLocaleString()
  });

  localStorage.setItem("activities", JSON.stringify(activities.slice(0, 5)));
}

// ================= NAVIGATION =================
function goBack() {
  window.location.href = "/dashboard.html";
}

// ================= LOAD TESTS =================
async function loadTests() {
  const res = await fetch(`/api/tests/by-staff/${staffId}`);
  const tests = await res.json();

  const tbody = document.getElementById("testList");
  tbody.innerHTML = "";

  tests.forEach(test => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${test.testId}</td>
      <td>${test.title}</td>
      <td>${new Date(test.createdAt).toLocaleString()}</td>
      <td>
        <button onclick="viewResults('${test.testId}')">View Results</button>
        <button onclick="copyTest('${test.testId}','${test.password}')">Copy</button>
        <button onclick="deleteTest('${test._id}')">Delete</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

// ================= COPY TEST =================
function copyTest(id, pass) {
  navigator.clipboard.writeText(`Test ID: ${id} | Password: ${pass}`);
  alert("Copied to clipboard");
}

// ================= DELETE TEST =================
async function deleteTest(id) {
  if (!confirm("Delete this test?")) return;

  try {
    const res = await fetch(`/api/tests/${id}`, {
      method: "DELETE"
    });

    const data = await res.json();

    if (res.ok) {
      alert(data.message);
      addActivity("Deleted a test");
      loadTests(); // refresh list
    } else {
      alert(data.message);
    }

  } catch (err) {
    console.error("Delete failed", err);
    alert("Delete failed");
  }
}

// ================= VIEW RESULTS =================
function viewResults(testId) {
  window.location.href = `/results.html?testId=${testId}`;
}

// ================= INIT =================
loadTests();
