const params = new URLSearchParams(location.search);
const testId = params.get("testId");
const reg = params.get("reg");

const container = document.getElementById("resultContainer");

async function loadResult() {
  try {
    const res = await fetch(`/api/student/result/${testId}/${reg}`);

    if (!res.ok) {
      container.innerHTML = `
        <div class="card center">
          <h3>Results not available</h3>
          <p class="muted">Results are not published yet</p>
          <br>
          <button onclick="goHome()">Back to Home</button>
        </div>
      `;
      return;
    }

    const student = await res.json();
    const testRes = await fetch(`/api/tests/${testId}`);
    const test = await testRes.json();

    let html = `
      <div class="card center">
        <h2>Score: ${student.score} / ${student.total}</h2>
      </div><br>
    `;

    test.questions.forEach((q, i) => {
      const ans = student.answers[i];

      html += `<div class="card"><h4>Q${i + 1}. ${q.question}</h4>`;

      if (q.image) {
        html += `<img src="${q.image}" style="max-width:100%;margin:10px 0">`;
      }

      /* ---------- MCQ ---------- */
      if (q.type === "MCQ") {
        html += "<ul>";
        q.options.forEach((opt, idx) => {
          let mark = "";
          if (idx === q.correctIndex) mark = "✔ Correct";
          if (idx === ans && idx !== q.correctIndex) mark = "❌ Your Answer";
          html += `<li>${opt} ${mark}</li>`;
        });
        html += "</ul>";
      }

      /* ---------- MSQ ---------- */
      if (q.type === "MSQ") {
        html += "<ul>";
        q.options.forEach((opt, idx) => {
          let mark = "";
          if (q.correctIndexes.includes(idx)) mark = "✔ Correct";
          if (Array.isArray(ans) && ans.includes(idx) && !q.correctIndexes.includes(idx))
            mark = "❌ Your Choice";
          html += `<li>${opt} ${mark}</li>`;
        });
        html += "</ul>";
      }

      /* ---------- NAT ---------- */
      if (q.type === "NAT") {
        const isCorrect = Number(ans) === Number(q.correctValue);
        html += `
          <p><b>Your Answer:</b> ${ans ?? "Not Answered"} 
            ${ans !== null ? (isCorrect ? "✔ Correct" : "❌ Wrong") : ""}
          </p>
          <p><b>Correct Answer:</b> ${q.correctValue}</p>
        `;
      }

      html += "</div><br>";
    });

    html += `<button onclick="goHome()">Back to Home</button>`;
    container.innerHTML = html;

  } catch (err) {
    console.error(err);
    container.innerHTML = "<div class='card center'>Error loading result</div>";
  }
}

function goHome() {
  location.href = "/";
}

loadResult();
