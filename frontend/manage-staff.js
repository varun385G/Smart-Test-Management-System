const role = localStorage.getItem("staffRole");

if (role !== "admin") {
  alert("Access denied");
  window.location.href = "/staff.html";
}

async function loadStaff() {
  const res = await fetch("/api/admin/staff");
  const staff = await res.json();

  const tbody = document.getElementById("staffList");
  tbody.innerHTML = "";

  staff.forEach(s => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${s.name}</td>
      <td>${s.email}</td>
      <td>
        <button onclick="deleteStaff('${s._id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function deleteStaff(id) {
  if (!confirm("Delete this staff account?")) return;

  const res = await fetch(`/api/admin/staff/${id}`, {
    method: "DELETE"
  });

  const data = await res.json();
  alert(data.message);
  loadStaff();
}

function goBack() {
  window.location.href = "/dashboard.html";
}

loadStaff();
