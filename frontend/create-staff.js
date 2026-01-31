const role = localStorage.getItem("staffRole");

if (role !== "admin") {
  alert("Access denied");
  window.location.href = "/staff.html";
}

async function createStaff() {
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const msg = document.getElementById("msg");

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  msg.innerText = "";
  msg.style.color = "";

  if (!name || !email || !password) {
    msg.innerText = "All fields required";
    msg.style.color = "#dc2626";
    return;
  }

  const btn = document.querySelector(".admin-only button");
  btn.disabled = true;
  btn.style.opacity = "0.6";
  btn.innerText = "Creating...";

  try {
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
      msg.innerText = data.message || "Failed to create staff";
      msg.style.color = "#dc2626";
    }
  } catch (err) {
    msg.innerText = "Network error. Try again.";
    msg.style.color = "#dc2626";
  } finally {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.innerText = "Create Staff";
  }
}

function goBack() {
  window.location.href = "/dashboard.html";
}
