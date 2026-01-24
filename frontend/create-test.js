let questionCount = 0;

function goBack() {
  window.location.href = "/dashboard.html";
}

function addQuestion() {
  questionCount++;

  const qDiv = document.createElement("div");
  qDiv.className = "question";

  qDiv.innerHTML = `
    <h4>Question ${questionCount}</h4>

    <input class="q-text" placeholder="Question text">

    <div class="option">
      <input type="radio" name="q${questionCount}">
      <input class="opt" placeholder="Option A">
    </div>

    <div class="option">
      <input type="radio" name="q${questionCount}">
      <input class="opt" placeholder="Option B">
    </div>

    <div class="option">
      <input type="radio" name="q${questionCount}">
      <input class="opt" placeholder="Option C">
    </div>

    <div class="option">
      <input type="radio" name="q${questionCount}">
      <input class="opt" placeholder="Option D">
    </div>
  `;

  document.getElementById("questions").appendChild(qDiv);
}

// ================= SAVE TEST =================
async function saveTest() {
  try {
    const title = document.getElementById("title").value.trim();
    const password = document.getElementById("password").value.trim();
    const duration = Number(document.getElementById("duration").value);

    const shuffleQuestions = document.getElementById("shuffleQ").checked;
    const shuffleOptions = document.getElementById("shuffleA").checked;

    const security = {
      fullscreen: document.getElementById("fullscreen").checked,
      disableCopyPaste: document.getElementById("disableCopy").checked,
      autoSubmitOnTabChange: document.getElementById("autoSubmitTab").checked
    };

    if (!title || !password || !duration) {
      alert("Title, password and duration are required");
      return;
    }

    const questionDivs = document.querySelectorAll(".question");
    if (questionDivs.length === 0) {
      alert("Add at least one question");
      return;
    }

    const questions = [];

    for (const qDiv of questionDivs) {
      const questionText = qDiv.querySelector(".q-text").value.trim();
      const optionInputs = qDiv.querySelectorAll(".opt");
      const options = Array.from(optionInputs).map(o => o.value.trim());

      let correctIndex = -1;
      qDiv.querySelectorAll("input[type=radio]").forEach((r, i) => {
        if (r.checked) correctIndex = i;
      });

      if (!questionText || options.some(o => !o) || correctIndex === -1) {
        alert("Fill all question fields and select correct answer");
        return;
      }

      questions.push({ question: questionText, options, correctIndex });
    }

    const staffId = localStorage.getItem("staffId");

    const res = await fetch("/api/tests/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        password,
        duration,
        shuffleQuestions,
        shuffleOptions,
        security,
        questions,
        staffId
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Failed to save test");
      return;
    }

    // ✅ SHOW TEST DETAILS CLEARLY (NO ALERT)
    const box = document.getElementById("resultBox");
    box.innerHTML = `
      <div class="card">
        <h3>✅ Test Created Successfully</h3>
        <p><b>Test ID:</b> <span id="tid">${data.testId}</span></p>
        <p><b>Password:</b> <span id="tpass">${password}</span></p>

        <button onclick="copyText('tid')">Copy Test ID</button>
        <button onclick="copyText('tpass')">Copy Password</button>
        <br><br>
        <button onclick="goBack()">Back to Dashboard</button>
      </div>
    `;

  } catch (err) {
    console.error("SAVE TEST ERROR:", err);
    alert("Failed to save test. Check inputs or server.");
  }
}

// ================= COPY =================
function copyText(id) {
  const text = document.getElementById(id).innerText;
  navigator.clipboard.writeText(text);
  alert("Copied to clipboard");
}
