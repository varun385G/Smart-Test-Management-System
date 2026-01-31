function showMessage(msg) {
  // Try UI message first
  const box = document.getElementById("messageBox");

  if (box) {
    box.innerHTML = `
      <div class="card center" style="margin-top:12px;">
        ${msg}
      </div>
    `;
  } else {
    // Fallback
    alert(msg);
  }
}

function goDashboard() {
  window.location.href = "/dashboard.html";
}
