const testId = localStorage.getItem("testId");
const reg = localStorage.getItem("studentReg");

fetch(`/api/result/${testId}/${reg}`)
  .then(res => res.json())
  .then(r => {
    document.getElementById("result").innerHTML = `
      <h3>Score: ${r.score} / ${r.total}</h3>
      <p>Submitted at: ${new Date(r.submittedAt).toLocaleString()}</p>
    `;
  });
