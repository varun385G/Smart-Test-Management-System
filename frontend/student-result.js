// ================= FETCH RESULT =================
const rawResult = localStorage.getItem("lastResult");
const container = document.getElementById("resultInfo");

// ================= SAFETY CHECK =================
if (!rawResult || !container) {
  if (container) {
    container.innerHTML = "Result not available.";
  }
} else {
  const resultData = JSON.parse(rawResult);

  const score = Number(resultData.score);
  const total = Number(resultData.total);

  if (isNaN(score) || isNaN(total) || total === 0) {
    container.innerHTML = "Invalid result data.";
  } else {
    const percent = Math.round((score / total) * 100);
    const status = percent >= 40 ? "PASS" : "FAIL";

    container.innerHTML = `
      <div class="score">${score} / ${total}</div>
      <p>Percentage: <b>${percent}%</b></p>
      <p class="${status === "PASS" ? "pass" : "fail"}">${status}</p>
    `;
  }
}

// ================= NAVIGATION =================
function goHome() {
  localStorage.removeItem("lastResult");
  window.location.href = "/student.html";
}
