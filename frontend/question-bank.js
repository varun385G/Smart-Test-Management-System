let bankQuestions = [];
let editingBankId = null;

window.addEventListener('DOMContentLoaded', loadQuestions);

async function loadQuestions() {
  const subject = document.getElementById('filterSubject').value.trim();
  const topic   = document.getElementById('filterTopic').value.trim();

  let url = '/api/question-bank?';
  if (subject) url += `subject=${encodeURIComponent(subject)}&`;
  if (topic)   url += `topic=${encodeURIComponent(topic)}`;

  try {
    const res = await fetch(url);
    bankQuestions = await res.json();
    renderList();
  } catch {
    showToast('Failed to load question bank', 'error');
  }
}

function renderList() {
  const container = document.getElementById('bankList');
  document.getElementById('bankCounter').textContent = `${bankQuestions.length} question${bankQuestions.length !== 1 ? 's' : ''} in bank`;

  if (bankQuestions.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:48px; color:var(--muted); border:2px dashed var(--border); border-radius:12px;">
        <div style="font-size:36px; margin-bottom:8px;">📚</div>
        <div style="font-weight:600; margin-bottom:4px;">No questions yet</div>
        <div style="font-size:13px;">Click "Add Question" to start building your bank</div>
      </div>`;
    return;
  }

  container.innerHTML = bankQuestions.map(q => `
    <div class="card" style="padding:18px 20px; margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
        <div style="flex:1;">
          <div style="display:flex; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
            <span class="badge ${q.type==='MCQ'?'badge-blue':q.type==='MSQ'?'badge-purple':'badge-orange'}">${q.type}</span>
            <span class="badge badge-gray">${q.marks} mark${q.marks!==1?'s':''}</span>
            ${q.subject ? `<span class="badge badge-gray">${q.subject}</span>` : ''}
            ${q.topic   ? `<span class="badge badge-gray">${q.topic}</span>`   : ''}
          </div>
          <div style="font-size:14px; font-weight:500; margin-bottom:6px;">${q.question}</div>
          ${q.type !== 'NAT' ? `
            <div style="font-size:12.5px; color:var(--muted);">
              ${(q.options||[]).map((o,i) => {
                const isCorrect = q.type==='MCQ' ? q.correctIndex===i : (q.correctIndexes||[]).includes(i);
                return `<span style="margin-right:12px; ${isCorrect?'color:var(--success);font-weight:600;':''}">
                  ${isCorrect?'✓ ':''}${o}
                </span>`;
              }).join('')}
            </div>` : `<div style="font-size:12.5px; color:var(--muted);">Answer: <strong>${q.correctValue}</strong></div>`}
          ${q.explanation ? `<div style="font-size:12px; color:#92400e; margin-top:6px;">💡 ${q.explanation}</div>` : ''}
        </div>
        <div style="display:flex; gap:8px; flex-shrink:0;">
          <button class="btn btn-sm" onclick="deleteFromBank('${q._id}')">🗑 Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function clearFilters() {
  document.getElementById('filterSubject').value = '';
  document.getElementById('filterTopic').value = '';
  loadQuestions();
}

/* ── Add Modal ── */
function openAddModal() {
  editingBankId = null;
  document.getElementById('modalTitle').textContent = 'Add Question to Bank';
  document.getElementById('bSubject').value = '';
  document.getElementById('bTopic').value = '';
  document.getElementById('bType').value = 'MCQ';
  document.getElementById('bQuestion').value = '';
  document.getElementById('bMarks').value = 1;
  document.getElementById('bNegMarks').value = 0;
  document.getElementById('bExplanation').value = '';
  renderBankAnswerFields();
  document.getElementById('addModal').classList.add('open');
}

function closeAddModal() {
  document.getElementById('addModal').classList.remove('open');
}

function renderBankAnswerFields() {
  const type = document.getElementById('bType').value;
  const container = document.getElementById('bAnswerFields');

  if (type === 'MCQ') {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label">Options (mark correct one)</label>
        <div id="bOptList">
          ${[0,1,2,3].map(i => `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <input type="radio" name="bCorrect" value="${i}">
              <input type="text" id="bOpt${i}" placeholder="Option ${i+1}" style="flex:1; padding:8px 12px; border:1.5px solid var(--border); border-radius:8px; font-size:14px; background:var(--bg); color:var(--text);">
            </div>`).join('')}
        </div>
      </div>`;
  } else if (type === 'MSQ') {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label">Options (check all correct ones)</label>
        <div id="bOptList">
          ${[0,1,2,3].map(i => `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <input type="checkbox" id="bCheck${i}" value="${i}">
              <input type="text" id="bOpt${i}" placeholder="Option ${i+1}" style="flex:1; padding:8px 12px; border:1.5px solid var(--border); border-radius:8px; font-size:14px; background:var(--bg); color:var(--text);">
            </div>`).join('')}
        </div>
      </div>`;
  } else {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label">Correct Numeric Answer *</label>
        <input id="bNatAnswer" type="number" step="any" placeholder="e.g. 42">
      </div>`;
  }
}

async function saveToBank() {
  const type       = document.getElementById('bType').value;
  const question   = document.getElementById('bQuestion').value.trim();
  const subject    = document.getElementById('bSubject').value.trim();
  const topic      = document.getElementById('bTopic').value.trim();
  const marks      = Number(document.getElementById('bMarks').value) || 1;
  const negMarks   = Number(document.getElementById('bNegMarks').value) || 0;
  const explanation = document.getElementById('bExplanation').value.trim();
  const staffId    = localStorage.getItem('staffId');

  if (!question) { showToast('Question text is required', 'warn'); return; }

  const payload = { type, question, subject, topic, marks, explanation, staffId,
    negativeMarkingEnabled: negMarks > 0, negativeMarks: negMarks };

  if (type === 'MCQ') {
    const opts = [0,1,2,3].map(i => document.getElementById(`bOpt${i}`)?.value.trim());
    const correctIndex = [...document.querySelectorAll('input[name="bCorrect"]')].findIndex(r => r.checked);
    if (opts.some(o => !o)) { showToast('Fill all option texts', 'warn'); return; }
    if (correctIndex === -1) { showToast('Select the correct answer', 'warn'); return; }
    payload.options = opts;
    payload.correctIndex = correctIndex;
  } else if (type === 'MSQ') {
    const opts = [0,1,2,3].map(i => document.getElementById(`bOpt${i}`)?.value.trim());
    const correctIndexes = [0,1,2,3].filter(i => document.getElementById(`bCheck${i}`)?.checked);
    if (opts.some(o => !o)) { showToast('Fill all option texts', 'warn'); return; }
    if (correctIndexes.length === 0) { showToast('Select at least one correct answer', 'warn'); return; }
    payload.options = opts;
    payload.correctIndexes = correctIndexes;
  } else {
    const val = document.getElementById('bNatAnswer')?.value;
    if (val === '' || val === null || val === undefined) { showToast('Enter numeric answer', 'warn'); return; }
    payload.correctValue = Number(val);
  }

  try {
    const res = await fetch('/api/question-bank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error();
    showToast('Question saved to bank!', 'success');
    closeAddModal();
    loadQuestions();
  } catch {
    showToast('Failed to save question', 'error');
  }
}

async function deleteFromBank(id) {
  showConfirm('Delete this question from the bank?', async () => {
    try {
      await fetch(`/api/question-bank/${id}`, { method: 'DELETE' });
      showToast('Question deleted', 'success');
      loadQuestions();
    } catch {
      showToast('Failed to delete', 'error');
    }
  }, { danger: true, okLabel: 'Delete' });
}