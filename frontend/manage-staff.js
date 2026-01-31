const role = localStorage.getItem("staffRole");

if (role !== "admin") {
  alert("Access denied");
  window.location.href = "/staff.html";
}

async function loadStaff() {
  try {
    const res = await fetch("/api/admin/staff");
    if (!res.ok) throw new Error("Failed to load staff");

    const staff = await res.json();
    const tbody = document.getElementById("staffList");
    tbody.innerHTML = "";

    staff.forEach(s => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${s.name}</td>
        <td>${s.email}</td>
        <td>
          <button class="btn" data-id="${s._id}">
            Delete
          </button>
        </td>
      `;

      const btn = row.querySelector("button");
      btn.onclick = () => deleteStaff(s._id, btn);

      tbody.appendChild(row);
    });

  } catch (err) {
    alert("Unable to load staff list");
  }
}

async function deleteStaff(id, btn) {
  if (!confirm("Delete this staff account?")) return;

  btn.disabled = true;
  btn.style.opacity = "0.6";
  btn.innerText = "Deleting...";

  try {
    const res = await fetch(`/api/admin/staff/${id}`, {
      method: "DELETE"
    });

    const data = await res.json();
    alert(data.message || "Staff deleted");
    loadStaff();

  } catch {
    alert("Failed to delete staff");
  }
}

function goBack() {
  window.location.href = "/dashboard.html";
}

loadStaff();
