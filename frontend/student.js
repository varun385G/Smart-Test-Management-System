const form = document.getElementById("studentForm");
const msgBox = document.getElementById("messageBox");

form.addEventListener("submit", async e => {
  e.preventDefault();

  const testId = document.getElementById("testId").value.trim();
  const password = document.getElementById("password").value.trim();
  const reg = document.getElementById("reg").value.trim();
  const name = document.getElementById("name").value.trim();

  msgBox.innerHTML = "Validating…";

  const res = await fetch("/api/student/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ testId, password, reg })
  });

  const data = await res.json();

  if (!res.ok) {
    msgBox.innerHTML = `<p class="danger">${data.message}</p>`;
    return;
  }

  // 🚫 Already attempted
  if (data.attempted) {
    msgBox.innerHTML = `
      <div class="card center">
        <h3>Exam already attempted</h3>
        ${
          data.resultsPublished
            ? `<button onclick="viewResult('${testId}','${reg}')">View Result</button>`
            : `<p class="muted">Results not published yet</p>`
        }
        <br><br>
        <button class="secondary" onclick="goHome()">Back to Home</button>
      </div>
    `;
    return;
  }

  // ✅ Fresh attempt
  localStorage.setItem("testId", testId);
  localStorage.setItem("studentName", name);
  localStorage.setItem("studentReg", reg);

  location.href = "/exam.html";
});

function viewResult(testId, reg) {
  location.href = `/student-result.html?testId=${testId}&reg=${reg}`;
}

function goHome() {
  location.href = "/";
}
