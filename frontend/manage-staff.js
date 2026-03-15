const role = sessionStorage.getItem("staffRole");

if (role !== "admin") {
  alert("Access denied");
  window.location.href = "/staff.html";
}

let resetTargetId = null;

async function loadStaff() {
  try {
    const res = await fetch("/api/admin/staff");
    if (!res.ok) throw new Error("Failed to load staff");

    const staff = await res.json();
    const tbody = document.getElementById("staffList");
    tbody.innerHTML = "";

    if (staff.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--muted); padding:24px;">No staff members found.</td></tr>`;
      return;
    }

    staff.forEach(s => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="font-weight:600;">${s.name}</td>
        <td style="color:var(--muted);">${s.email}</td>
        <td><span class="badge ${s.role === 'admin' ? 'badge-blue' : 'badge-cyan'}">${s.role}</span></td>
        <td style="display:flex; gap:8px;">
          <button class="btn btn-sm" style="color:var(--primary); border-color:var(--primary-light);" data-id="${s._id}" data-name="${s.name}">🔑 Reset PW</button>
          <button class="btn btn-sm btn-danger" data-del="${s._id}">Delete</button>
        </td>
      `;
      row.querySelector("[data-id]").onclick = () => openResetModal(s._id, s.name);
      row.querySelector("[data-del]").onclick = (e) => deleteStaff(s._id, e.target);
      tbody.appendChild(row);
    });

  } catch (err) {
    alert("Unable to load staff list");
  }
}

function openResetModal(id, name) {
  resetTargetId = id;
  document.getElementById("resetStaffName").innerText = name;
  document.getElementById("resetNewPw").value = "";
  document.getElementById("resetMsg").innerText = "";
  document.getElementById("resetPwModal").classList.add("open");
}

function closeResetModal() {
  document.getElementById("resetPwModal").classList.remove("open");
  resetTargetId = null;
}

async function submitResetPassword() {
  const newPassword = document.getElementById("resetNewPw").value.trim();
  const msg = document.getElementById("resetMsg");
  msg.innerText = "";

  if (!newPassword || newPassword.length < 4) {
    msg.style.color = "var(--danger)";
    msg.innerText = "Password must be at least 4 characters.";
    return;
  }

  const btn = document.querySelector("#resetPwModal .btn-primary");
  btn.disabled = true;
  btn.textContent = "Updating...";

  try {
    const res = await fetch(`/api/admin/staff/${resetTargetId}/reset-password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword })
    });
    const data = await res.json();
    if (res.ok) {
      msg.style.color = "var(--success)";
      msg.innerText = "Password updated successfully!";
      setTimeout(() => closeResetModal(), 1200);
    } else {
      msg.style.color = "var(--danger)";
      msg.innerText = data.message || "Failed to reset password.";
    }
  } catch {
    msg.style.color = "var(--danger)";
    msg.innerText = "Network error. Try again.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Set New Password";
  }
}

async function deleteStaff(id, btn) {
  if (!confirm("Delete this staff account?")) return;
  btn.disabled = true;
  btn.style.opacity = "0.6";
  btn.innerText = "Deleting...";
  try {
    const res = await fetch(`/api/admin/staff/${id}`, { method: "DELETE" });
    const data = await res.json();
    alert(data.message || "Staff deleted");
    loadStaff();
  } catch {
    alert("Failed to delete staff");
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.innerText = "Delete";
  }
}

function goBack() { window.location.href = "/dashboard.html"; }

document.getElementById("resetPwModal").addEventListener("click", function(e) {
  if (e.target === this) closeResetModal();
});

loadStaff();