const role = sessionStorage.getItem("staffRole");

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

  const btn = document.querySelector("button.btn-primary") || document.querySelector(".btn-primary");
  btn.disabled = true;
  btn.style.opacity = "0.6";
  btn.textContent = "Creating...";

  try {
    const res = await fetch("/api/admin/create-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role: "staff" })
    });

    const data = await res.json();

    if (res.ok) {
      msg.innerText = "Staff created successfully!";
      msg.style.color = "var(--success)";
      setTimeout(() => window.location.href = "/dashboard.html", 1200);
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
    btn.textContent = "Create Staff";
  }
}

function goBack() {
  window.location.href = "/dashboard.html";
}