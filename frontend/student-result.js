const params = new URLSearchParams(location.search);
const testId = params.get("testId");
const reg = params.get("reg");

const container = document.getElementById("resultContainer");

async function loadResult() {
  container.innerHTML = `
    <div class="center" style="color:var(--muted);">
      Loading result...
    </div>
  `;

  try {
    const res = await fetch(`/api/student/result/${testId}/${reg}`);

    if (!res.ok) {
      container.innerHTML = `
        <div class="card center">
          <h3>Results not available</h3>
          <p style="color:var(--muted);">
            Results are not published yet
          </p>
          <br>
          <button class="btn" onclick="goHome()">Back to Home</button>
        </div>
      `;
      return;
    }

    const student = await res.json();
    const testRes = await fetch(`/api/tests/${testId}`);
    const test = await testRes.json();

    let html = `
      <div class="card center" style="margin-bottom:20px;">
        <h2>Score</h2>
        <h1>${student.score} / ${student.total}</h1>
      </div>
    `;

    test.questions.forEach((q, i) => {
      const ans = student.answers[i];

      html += `
        <div class="card" style="margin-bottom:16px;">
          <h4>Q${i + 1}. ${q.question}</h4>
      `;

      if (q.image) {
        html += `
          <img src="${q.image}"
               style="max-width:100%; margin:10px 0;">
        `;
      }

      /* MCQ */
      if (q.type === "MCQ") {
        html += "<ul>";
        q.options.forEach((opt, idx) => {
          let label = "";
          if (idx === q.correctIndex) label = "✔ Correct";
          if (idx === ans && idx !== q.correctIndex) label = "❌ Your answer";
          html += `<li>${opt} <span>${label}</span></li>`;
        });
        html += "</ul>";
      }

      /* MSQ */
      if (q.type === "MSQ") {
        html += "<ul>";
        q.options.forEach((opt, idx) => {
          let label = "";
          if (q.correctIndexes.includes(idx)) label = "✔ Correct";
          if (
            Array.isArray(ans) &&
            ans.includes(idx) &&
            !q.correctIndexes.includes(idx)
          ) {
            label = "❌ Your choice";
          }
          html += `<li>${opt} <span>${label}</span></li>`;
        });
        html += "</ul>";
      }

      /* NAT */
      if (q.type === "NAT") {
        const isCorrect = Number(ans) === Number(q.correctValue);
        html += `
          <p>
            <b>Your Answer:</b>
            ${ans ?? "Not Answered"}
            ${
              ans !== null
                ? isCorrect
                  ? "✔ Correct"
                  : "❌ Wrong"
                : ""
            }
          </p>
          <p>
            <b>Correct Answer:</b>
            ${q.correctValue}
          </p>
        `;
      }

      html += "</div>";
    });

    html += `
      <div class="center" style="margin-top:20px;">
        <button class="btn" onclick="goHome()">Back to Home</button>
      </div>
    `;

    container.innerHTML = html;

  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="card center">
        Error loading result
      </div>
    `;
  }
}

function goHome() {
  location.href = "/";
}

loadResult();
