async function enterTest() {
  const testId = document.getElementById("testId").value.trim();
  const password = document.getElementById("password").value.trim();
  const name = document.getElementById("name").value.trim();
  const reg = document.getElementById("reg").value.trim();

  if (!testId || !password || !name || !reg) {
    alert("Fill all fields");
    return;
  }

  // Validate test with backend
  const res = await fetch("/api/student/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ testId, password, reg })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.message);
    return;
  }

  // Save student info
  localStorage.setItem("testId", testId);
  localStorage.setItem("studentName", name);
  localStorage.setItem("studentReg", reg);
  localStorage.setItem("attempted", "no");

  window.location.href = "/student-dashboard.html";
}
