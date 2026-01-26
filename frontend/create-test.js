let questionCount = 0;

function goBack() {
  location.href = "/dashboard.html";
}

/* ================= COPY TEST ID (GLOBAL) ================= */
function copyTestId() {
  const text = document.getElementById("createdTestId").innerText;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(() => alert("Test ID copied"))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const tempInput = document.createElement("input");
  tempInput.value = text;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand("copy");
  document.body.removeChild(tempInput);
  alert("Test ID copied");
}

/* ================= ADD QUESTION ================= */
function addQuestion() {
  questionCount++;

  const qDiv = document.createElement("div");
  qDiv.className = "card";
  qDiv.style.marginBottom = "16px";

  qDiv.innerHTML = `
    <h4>Question ${questionCount}</h4>

    <select class="q-type">
      <option value="MCQ">MCQ (Single Correct)</option>
      <option value="MSQ">MSQ (Multiple Correct)</option>
      <option value="NAT">NAT (Numeric Answer)</option>
    </select>

    <input class="q-text" placeholder="Question text">
    <input class="q-image" placeholder="Image URL (optional)">

    <div class="options"></div>
    <input class="nat-answer" type="number"
      placeholder="Correct numeric answer"
      style="display:none">
  `;

  const typeSelect = qDiv.querySelector(".q-type");
  const optionsDiv = qDiv.querySelector(".options");
  const natInput = qDiv.querySelector(".nat-answer");

  function renderOptions(type) {
    optionsDiv.innerHTML = "";
    natInput.style.display = "none";

    if (type === "MCQ" || type === "MSQ") {
      for (let i = 0; i < 4; i++) {
        optionsDiv.innerHTML += `
          <label style="display:flex;gap:10px;margin-top:8px">
            <input type="${type === "MCQ" ? "radio" : "checkbox"}"
                   name="q${questionCount}">
            <input class="opt" placeholder="Option ${String.fromCharCode(65 + i)}">
          </label>
        `;
      }
    }

    if (type === "NAT") {
      natInput.style.display = "block";
    }
  }

  typeSelect.onchange = () => renderOptions(typeSelect.value);
  renderOptions("MCQ");

  document.getElementById("questions").appendChild(qDiv);
}

/* ================= SAVE TEST ================= */
async function saveTest() {
  try {
    const title = document.getElementById("title").value.trim();
    const password = document.getElementById("password").value.trim();
    const duration = Number(document.getElementById("duration").value);

    if (!title || !password || !duration) {
      alert("Title, password and duration are required");
      return;
    }

    const questions = [];

    document.querySelectorAll("#questions .card").forEach(qDiv => {
      const type = qDiv.querySelector(".q-type").value;
      const question = qDiv.querySelector(".q-text").value.trim();
      const image = qDiv.querySelector(".q-image").value.trim();

      if (!question) throw "Question text required";

      const qObj = { type, question, image };

      if (type === "MCQ") {
        const opts = [...qDiv.querySelectorAll(".opt")].map(o => o.value.trim());
        const radios = qDiv.querySelectorAll("input[type=radio]");
        const correctIndex = [...radios].findIndex(r => r.checked);

        if (opts.some(o => !o) || correctIndex === -1)
          throw "Fill MCQ options and select correct answer";

        qObj.options = opts;
        qObj.correctIndex = correctIndex;
      }

      if (type === "MSQ") {
        const opts = [...qDiv.querySelectorAll(".opt")].map(o => o.value.trim());
        const checks = qDiv.querySelectorAll("input[type=checkbox]");
        const correctIndexes = [...checks]
          .map((c, i) => (c.checked ? i : -1))
          .filter(i => i !== -1);

        if (opts.some(o => !o) || correctIndexes.length === 0)
          throw "Fill MSQ options and select at least one correct answer";

        qObj.options = opts;
        qObj.correctIndexes = correctIndexes;
      }

      if (type === "NAT") {
        const val = qDiv.querySelector(".nat-answer").value;
        if (val === "") throw "Numeric answer required";
        qObj.correctValue = Number(val);
      }

      questions.push(qObj);
    });

    const staffId = localStorage.getItem("staffId");

    const res = await fetch("/api/tests/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        password,
        duration,
        questions,
        staffId
      })
    });

    const data = await res.json();
    if (!res.ok) throw data.message;

    // ✅ SHOW SUCCESS UI
    document.getElementById("successBox").style.display = "block";
    document.getElementById("createdTestId").innerText = data.testId;
    document.querySelector("main").style.display = "none";

  } catch (err) {
    alert(err);
  }
}
