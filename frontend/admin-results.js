// ✅ FIXED: correct key
const role = localStorage.getItem("staffRole");

if (role !== "admin") {
  alert("Access denied");
  window.location.href = "/staff.html";
}

// Store fetched data
let dataStore = {};

// ================= LOAD STAFF =================
async function loadStaff() {
  const res = await fetch("/api/admin/results/grouped");
  dataStore = await res.json();

  document.getElementById("testView").innerHTML = "";
  document.getElementById("studentView").innerHTML = "";

  const staffDiv = document.getElementById("staffView");
  staffDiv.innerHTML = "<h3>Select Staff</h3>";

  if (Object.keys(dataStore).length === 0) {
    staffDiv.innerHTML += "<p>No results available</p>";
    return;
  }

  Object.keys(dataStore).forEach(staffId => {
    const btn = document.createElement("button");
    btn.innerText = dataStore[staffId].staffName;
    btn.onclick = () => loadTests(staffId);
    staffDiv.appendChild(btn);
    staffDiv.appendChild(document.createElement("br"));
  });
}

// ================= LOAD TESTS =================
function loadTests(staffId) {
  document.getElementById("studentView").innerHTML = "";

  const testDiv = document.getElementById("testView");
  testDiv.innerHTML = "<h3>Tests</h3>";

  const tests = dataStore[staffId].tests;

  if (!tests || Object.keys(tests).length === 0) {
    testDiv.innerHTML += "<p>No tests found</p>";
    return;
  }

  Object.keys(tests).forEach(testId => {
    const btn = document.createElement("button");
    btn.innerText = `${tests[testId].testTitle} (${tests[testId].results.length} attempts)`;
    btn.onclick = () => loadStudents(tests[testId].results);
    testDiv.appendChild(btn);
    testDiv.appendChild(document.createElement("br"));
  });
}

// ================= LOAD STUDENTS =================
function loadStudents(results) {
  const div = document.getElementById("studentView");

  if (!results || results.length === 0) {
    div.innerHTML = "<p>No student attempts</p>";
    return;
  }

  div.innerHTML = `
    <h3>Student Results</h3>
    <table border="1" cellpadding="6">
      <tr>
        <th>Name</th>
        <th>Register</th>
        <th>Score</th>
        <th>Date</th>
      </tr>
      ${results.map(r => `
        <tr>
          <td>${r.studentName}</td>
          <td>${r.studentReg}</td>
          <td>${r.score}/${r.total}</td>
          <td>${new Date(r.date).toLocaleString()}</td>
        </tr>
      `).join("")}
    </table>
  `;
}

// ================= NAVIGATION =================
function goBack() {
  window.location.href = "/dashboard.html";
}

// ================= INIT =================
loadStaff();
