const role = localStorage.getItem("role");

if (role !== "admin") {
  alert("Access denied");
  window.location.href = "/staff";
}

async function createStaff() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!name || !email || !password) {
    document.getElementById("msg").innerText = "All fields required";
    return;
  }

  const res = await fetch("/api/admin/create-staff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });

  const data = await res.json();

  if (res.ok) {
    alert("Staff created successfully");
    window.location.href = "/dashboard.html";
  } else {
    document.getElementById("msg").innerText = data.message;
  }
}

function goBack() {
  window.location.href = "/dashboard.html";
}
