/* ═══════════════════════════════════════════
   CREATE / EDIT TEST — Full featured
   ═══════════════════════════════════════════ */

let questionList = [];   // [{id, type, ...}]
let nextId = 1;
let isDirty = false;
let editingTestId = null;   // set when editing existing test

const DRAFT_KEY = 'stms_draft_test';

/* ── Init ─────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  editingTestId = params.get('edit');

  if (editingTestId) {
    document.getElementById('pageTitle').textContent = 'Edit Test';
    document.getElementById('saveBtn').textContent   = '💾 Update Test';
    loadTestForEdit(editingTestId);
  } else {
    restoreDraft();
  }

  // Auto-save draft every 30s
  setInterval(saveDraft, 30000);

  // Unsaved warning
  window.addEventListener('beforeunload', e => {
    if (isDirty) { e.preventDefault(); e.returnValue = ''; }
  });
});

function markDirty() {
  isDirty = true;
  updateCounter();
}

/* ── Draft persistence ────────────────────── */
function saveDraft() {
  if (editingTestId) return;
  const data = collectFormData(false);
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}
function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || !data.title) return;
    if (!confirm('You have an unsaved draft. Restore it?')) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    populateForm(data);
  } catch (_) {}
}
function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

/* ── Load for editing ─────────────────────── */
async function loadTestForEdit(testId) {
  try {
    const res = await fetch(`/api/tests/${testId}`);
    if (!res.ok) throw new Error();
    const test = await res.json();
    populateForm(test);
    showToast('Test loaded for editing', 'info');
  } catch {
    showToast('Failed to load test', 'error');
  }
}

function populateForm(test) {
  if (test.title)    document.getElementById('title').value    = test.title;
  if (test.password) document.getElementById('password').value = test.password;
  if (test.duration) document.getElementById('duration').value  = test.duration;

  const sec = test.security || {};
  document.getElementById('shuffleQ').checked     = test.shuffleQuestions !== false;
  document.getElementById('shuffleA').checked     = test.shuffleOptions   !== false;
  document.getElementById('fullscreen').checked   = sec.fullscreen   !== false;
  document.getElementById('disableCopy').checked  = sec.disableCopyPaste !== false;
  document.getElementById('autoSubmitTab').checked = !!sec.autoSubmitOnTabChange;

  questionList = [];
  document.getElementById('questions').innerHTML = '';
  (test.questions || []).forEach(q => addQuestion(q.type || 'MCQ', q));
  updateCounter();
}

/* ── Counter display ──────────────────────── */
function updateCounter() {
  const total = questionList.length;
  const marks = questionList.reduce((s, q) => s + (Number(q.marks) || 1), 0);
  document.getElementById('questionCounter').textContent =
    `${total} question${total !== 1 ? 's' : ''} · ${marks} mark${marks !== 1 ? 's' : ''}`;
  document.getElementById('previewBtn').disabled = total === 0;
  document.getElementById('emptyQuestionsMsg').style.display = total === 0 ? '' : 'none';
}

/* ══════════════════════════════════════════
   ADD QUESTION
══════════════════════════════════════════ */
function addQuestion(type = 'MCQ', prefill = null) {
  const id = nextId++;
  const qData = { id, type: prefill?.type || type, marks: prefill?.marks || 1 };
  questionList.push(qData);

  const container = document.getElementById('questions');
  const card = document.createElement('div');
  card.className = 'question-card';
  card.id = `qcard-${id}`;
  card.dataset.qid = id;

  card.innerHTML = buildQuestionHTML(id, qData.type);
  container.appendChild(card);

  const qNum = questionList.length;
  refreshQHeader(id, qNum, qData.type);

  // Wire type change
  card.querySelector('.q-type-select').onchange = e => {
    qData.type = e.target.value;
    refreshQBody(id, qData.type);
    refreshQHeader(id, getQNum(id), qData.type);
    markDirty();
  };

  // Marks
  card.querySelector('.q-marks-input').oninput = e => {
    qData.marks = Number(e.target.value) || 1;
    markDirty(); updateCounter();
  };

  // Wire collapse
  card.querySelector('.q-header').addEventListener('click', e => {
    if (e.target.closest('.q-actions')) return;
    card.classList.toggle('collapsed');
  });

  // Build body
  buildQBody(card, qData.type, prefill);
  wireQInputs(card);

  // Set prefill values
  if (prefill) {
    const textEl = card.querySelector('.q-text');
    if (textEl && prefill.question) textEl.value = prefill.question;
    const marksEl = card.querySelector('.q-marks-input');
    if (marksEl) marksEl.value = prefill.marks || 1;
    const explEl = card.querySelector('.q-explanation');
    if (explEl && prefill.explanation) explEl.value = prefill.explanation;
    // Image
    if (prefill.image) setImagePreview(card, prefill.image);
  }

  markDirty(); updateCounter();
  return card;
}

function buildQuestionHTML(id, type) {
  const typeBadgeClass = type === 'MCQ' ? 'type-mcq' : type === 'MSQ' ? 'type-msq' : 'type-nat';
  return `
    <div class="q-header">
      <div class="q-num" id="qnum-${id}">?</div>
      <span class="badge badge-sm ${typeBadgeClass}" id="qtype-badge-${id}">${type}</span>
      <div class="q-title-preview" id="qpreview-${id}">New question</div>
      <div class="q-actions">
        <button class="q-icon-btn duplicate" title="Duplicate" onclick="duplicateQuestion(${id})">⧉</button>
        <button class="q-icon-btn" title="Move up"   onclick="moveQuestion(${id},-1)">↑</button>
        <button class="q-icon-btn" title="Move down" onclick="moveQuestion(${id},1)">↓</button>
        <button class="q-icon-btn delete" title="Delete" onclick="deleteQuestion(${id})">✕</button>
      </div>
    </div>
    <div class="q-body">
      <div class="q-type-row">
        <select class="q-type-select">
          <option value="MCQ"${type==='MCQ'?' selected':''}>MCQ — Single Correct</option>
          <option value="MSQ"${type==='MSQ'?' selected':''}>MSQ — Multiple Correct</option>
          <option value="NAT"${type==='NAT'?' selected':''}>NAT — Numeric Answer</option>
        </select>
        <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
          <label style="font-size:12.5px; font-weight:600; color:var(--muted); white-space:nowrap;">Marks</label>
          <input type="number" class="q-marks-input" value="1" min="1" max="99">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Question Text *</label>
        <textarea class="q-text" rows="2" placeholder="Enter your question here..." style="resize:vertical;"></textarea>
      </div>

      <!-- Image upload -->
      <div class="form-group">
        <label class="form-label">Question Image (optional)</label>
        <div class="img-upload-area" id="imgArea-${id}" onclick="triggerImgUpload(${id})">
          <div class="img-placeholder">
            <div style="font-size:24px;">🖼</div>
            <div style="font-size:13px; color:var(--muted); margin-top:4px;">Click to upload image</div>
            <div class="img-hint">PNG, JPG, GIF — max 2MB</div>
          </div>
        </div>
        <input type="file" id="imgInput-${id}" accept="image/*" style="display:none;"
               onchange="handleImageUpload(${id}, event)">
      </div>

      <!-- Options area -->
      <div class="options-area" id="opts-${id}"></div>

      <!-- Explanation -->
      <div class="explanation-area">
        <label>💡 Explanation (shown to students after results)</label>
        <textarea class="q-explanation" rows="2" placeholder="Optional: explain why the correct answer is right..."></textarea>
      </div>
    </div>
  `;
}

function buildQBody(card, type, prefill = null) {
  const optsDiv = card.querySelector('.options-area');
  optsDiv.innerHTML = '';

  if (type === 'MCQ' || type === 'MSQ') {
    const inputType = type === 'MCQ' ? 'radio' : 'checkbox';
    const defaults = prefill?.options?.length ? prefill.options : ['', '', '', ''];
    const correctIdxs = type === 'MCQ'
      ? [prefill?.correctIndex ?? -1]
      : (prefill?.correctIndexes || []);

    const id = card.dataset.qid;

    optsDiv.innerHTML = `
      <label class="form-label">Answer Options *</label>
      <div class="options-list" id="optlist-${id}"></div>
      <button class="add-option-btn" onclick="addOptionRow(${id}, '${inputType}')">＋ Add Option</button>
    `;

    const list = optsDiv.querySelector(`#optlist-${id}`);
    defaults.forEach((optText, i) => {
      addOptionRow(id, inputType, optText, correctIdxs.includes(i));
    });

  } else if (type === 'NAT') {
    optsDiv.innerHTML = `
      <div class="nat-wrap">
        <label>Correct Numeric Answer *</label>
        <input type="number" class="nat-answer" step="any" placeholder="e.g. 42" style="max-width:180px;">
      </div>
    `;
    if (prefill?.correctValue !== undefined) {
      optsDiv.querySelector('.nat-answer').value = prefill.correctValue;
    }
  }
}

function addOptionRow(qid, inputType, value = '', checked = false) {
  const list = document.getElementById(`optlist-${qid}`);
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'option-row';
  const idx = list.children.length;
  row.innerHTML = `
    <div class="option-check-wrap">
      <input type="${inputType}" name="correct-${qid}" ${checked ? 'checked' : ''}>
    </div>
    <input type="text" placeholder="Option ${String.fromCharCode(65 + idx)}" value="${value}">
    <button class="option-del" onclick="removeOption(this)" title="Remove">✕</button>
  `;
  list.appendChild(row);
  return row;
}

function removeOption(btn) {
  const row = btn.closest('.option-row');
  const list = row.closest('.options-list');
  if (list.children.length <= 2) { showToast('Minimum 2 options required', 'warn'); return; }
  row.remove();
  markDirty();
}

function refreshQBody(id, type) {
  const card = document.getElementById(`qcard-${id}`);
  if (!card) return;
  buildQBody(card, type);
  wireQInputs(card);
}

function wireQInputs(card) {
  const textEl = card.querySelector('.q-text');
  const qid = card.dataset.qid;
  if (textEl) {
    textEl.oninput = () => {
      const preview = card.querySelector('.q-title-preview');
      if (preview) preview.textContent = textEl.value || 'New question';
      markDirty();
    };
  }
}

function refreshQHeader(id, num, type) {
  const numEl   = document.getElementById(`qnum-${id}`);
  const badgeEl = document.getElementById(`qtype-badge-${id}`);
  if (numEl)   numEl.textContent = num;
  if (badgeEl) {
    badgeEl.textContent = type;
    badgeEl.className = `badge ${type === 'MCQ' ? 'badge-blue' : type === 'MSQ' ? 'badge-purple' : 'badge-orange'}`;
  }
}

function getQNum(id) {
  return questionList.findIndex(q => q.id === Number(id)) + 1;
}

/* ── Image upload ─────────────────────────── */
function triggerImgUpload(id) {
  const area = document.getElementById(`imgArea-${id}`);
  if (area.classList.contains('has-image')) return;
  document.getElementById(`imgInput-${id}`).click();
}

function handleImageUpload(id, event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Image too large (max 2MB)', 'error'); return; }

  const reader = new FileReader();
  reader.onload = e => setImagePreview(document.getElementById(`qcard-${id}`), e.target.result);
  reader.readAsDataURL(file);
  markDirty();
}

function setImagePreview(card, src) {
  const id = card.dataset.qid;
  const area = document.getElementById(`imgArea-${id}`);
  if (!area) return;
  area.classList.add('has-image');
  area.innerHTML = `
    <img src="${src}" alt="Question image">
    <button class="img-remove" onclick="removeImage(${id}); event.stopPropagation();">✕</button>
  `;
}

function removeImage(id) {
  const area = document.getElementById(`imgArea-${id}`);
  if (!area) return;
  area.classList.remove('has-image');
  area.innerHTML = `
    <div class="img-placeholder">
      <div style="font-size:24px;">🖼</div>
      <div style="font-size:13px; color:var(--muted); margin-top:4px;">Click to upload image</div>
      <div class="img-hint">PNG, JPG, GIF — max 2MB</div>
    </div>
  `;
  const inp = document.getElementById(`imgInput-${id}`);
  if (inp) inp.value = '';
  markDirty();
}

/* ── Question actions ─────────────────────── */
function deleteQuestion(id) {
  showConfirm('Delete this question?', () => {
    const idx = questionList.findIndex(q => q.id === id);
    if (idx !== -1) questionList.splice(idx, 1);
    const card = document.getElementById(`qcard-${id}`);
    if (card) card.remove();
    renumberAll();
    markDirty(); updateCounter();
  }, { danger: true, okLabel: 'Delete' });
}

function duplicateQuestion(id) {
  const data = extractQuestion(id);
  if (!data) return;
  addQuestion(data.type, data);
  showToast('Question duplicated', 'success');
}

function moveQuestion(id, dir) {
  const idx = questionList.findIndex(q => q.id === id);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= questionList.length) return;
  [questionList[idx], questionList[newIdx]] = [questionList[newIdx], questionList[idx]];
  const container = document.getElementById('questions');
  const cards = [...container.querySelectorAll('.question-card')];
  const card = document.getElementById(`qcard-${id}`);
  const target = cards[newIdx];
  if (dir === -1) container.insertBefore(card, target);
  else container.insertBefore(target, card);
  renumberAll();
  markDirty();
}

function renumberAll() {
  const cards = document.querySelectorAll('.question-card');
  cards.forEach((card, i) => {
    const qid = card.dataset.qid;
    const numEl = document.getElementById(`qnum-${qid}`);
    if (numEl) numEl.textContent = i + 1;
  });
}

/* ── Collect data ─────────────────────────── */
function extractQuestion(id) {
  const card = document.getElementById(`qcard-${id}`);
  if (!card) return null;

  const typeSelect = card.querySelector('.q-type-select');
  const type = typeSelect ? typeSelect.value : 'MCQ';
  const questionText = (card.querySelector('.q-text')?.value || '').trim();
  const marks = Number(card.querySelector('.q-marks-input')?.value) || 1;
  const explanation = (card.querySelector('.q-explanation')?.value || '').trim();

  // Image
  const imgEl = card.querySelector('.img-upload-area img');
  const image = imgEl ? imgEl.src : '';

  const qObj = { type, question: questionText, image, marks, explanation };

  if (type === 'MCQ') {
    const optInputs = card.querySelectorAll(`#optlist-${id} .option-row input[type="text"]`);
    const radios    = card.querySelectorAll(`#optlist-${id} input[type="radio"]`);
    const opts      = [...optInputs].map(o => o.value.trim());
    const correctIndex = [...radios].findIndex(r => r.checked);
    if (opts.some(o => !o)) throw `Q${getQNum(id)}: Fill all MCQ option texts`;
    if (correctIndex === -1) throw `Q${getQNum(id)}: Select the correct MCQ answer`;
    qObj.options = opts;
    qObj.correctIndex = correctIndex;

  } else if (type === 'MSQ') {
    const optInputs = card.querySelectorAll(`#optlist-${id} .option-row input[type="text"]`);
    const checks    = card.querySelectorAll(`#optlist-${id} input[type="checkbox"]`);
    const opts      = [...optInputs].map(o => o.value.trim());
    const correctIdxs = [...checks].map((c,i) => c.checked ? i : -1).filter(i => i !== -1);
    if (opts.some(o => !o)) throw `Q${getQNum(id)}: Fill all MSQ option texts`;
    if (correctIdxs.length === 0) throw `Q${getQNum(id)}: Select at least one correct MSQ answer`;
    qObj.options = opts;
    qObj.correctIndexes = correctIdxs;

  } else if (type === 'NAT') {
    const val = card.querySelector('.nat-answer')?.value;
    if (val === '' || val === null || val === undefined) throw `Q${getQNum(id)}: Enter numeric answer`;
    qObj.correctValue = Number(val);
  }

  if (!questionText) throw `Q${getQNum(id)}: Question text is required`;
  return qObj;
}

function collectFormData(validate = true) {
  const title    = document.getElementById('title').value.trim();
  const password = document.getElementById('password').value.trim();
  const duration = Number(document.getElementById('duration').value);

  if (validate) {
    if (!title)    throw 'Test title is required';
    if (!password) throw 'Test password is required';
    if (!duration) throw 'Duration is required';
  }

  const cards = [...document.querySelectorAll('.question-card')];
  const questions = cards.map(card => extractQuestion(Number(card.dataset.qid)));

  return {
    title, password, duration, questions,
    shuffleQuestions: document.getElementById('shuffleQ').checked,
    shuffleOptions:   document.getElementById('shuffleA').checked,
    security: {
      fullscreen:             document.getElementById('fullscreen').checked,
      disableCopyPaste:       document.getElementById('disableCopy').checked,
      autoSubmitOnTabChange:  document.getElementById('autoSubmitTab').checked,
    }
  };
}

/* ── Preview ──────────────────────────────── */
function previewTest() {
  let data;
  try { data = collectFormData(false); } catch (e) { showToast(e, 'warn'); return; }

  const modal = document.getElementById('previewModal');
  const content = document.getElementById('previewContent');

  content.innerHTML = `
    <div style="margin-bottom:16px;">
      <h3 style="font-size:17px; margin-bottom:4px;">${data.title || 'Untitled Test'}</h3>
      <p style="color:var(--muted); font-size:13px;">Duration: ${data.duration || '?'} min · ${data.questions.length} questions</p>
    </div>
    ${(data.questions || []).filter(q=>q).map((q, i) => `
      <div class="preview-q">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h4 style="margin:0;">Q${i+1}. ${q.question || '(empty)'}</h4>
          <div style="display:flex; gap:6px; align-items:center;">
            <span class="badge ${q.type==='MCQ'?'badge-blue':q.type==='MSQ'?'badge-purple':'badge-orange'}">${q.type}</span>
            <span class="badge badge-gray">${q.marks} mark${q.marks!==1?'s':''}</span>
          </div>
        </div>
        ${q.image ? `<img src="${q.image}" style="max-width:100%; max-height:160px; border-radius:8px; margin-bottom:10px;">` : ''}
        ${(q.options||[]).map((o,oi) => `
          <div class="preview-option">
            <input type="${q.type==='MCQ'?'radio':'checkbox'}" disabled ${
              (q.type==='MCQ' && q.correctIndex===oi) || (q.type==='MSQ' && (q.correctIndexes||[]).includes(oi)) ? 'checked' : ''
            }>
            <span>${o}</span>
            ${(q.type==='MCQ' && q.correctIndex===oi) || (q.type==='MSQ' && (q.correctIndexes||[]).includes(oi))
              ? '<span class="badge badge-green" style="margin-left:auto;">✓ Correct</span>' : ''}
          </div>
        `).join('')}
        ${q.type==='NAT' ? `<div style="font-size:13px; margin-top:8px; color:var(--muted);">Answer: <strong>${q.correctValue}</strong></div>` : ''}
        ${q.explanation ? `<div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:8px 12px; margin-top:10px; font-size:13px; color:#92400e;">💡 ${q.explanation}</div>` : ''}
      </div>
    `).join('')}
  `;
  modal.classList.add('open');
}
function closePreview() {
  document.getElementById('previewModal').classList.remove('open');
}

/* ── Save / Update ────────────────────────── */
async function saveTest() {
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = 'Saving…';

  try {
    const data = collectFormData(true);
    const staffId = localStorage.getItem('staffId');

    let url, method;
    if (editingTestId) {
      url    = `/api/tests/${editingTestId}/update`;
      method = 'PUT';
    } else {
      url    = '/api/tests/create';
      method = 'POST';
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, staffId })
    });

    const json = await res.json();
    if (!res.ok) throw json.message || 'Failed to save';

    isDirty = false;
    clearDraft();

    if (editingTestId) {
      showToast('Test updated successfully!', 'success');
      setTimeout(() => location.href = '/manage-tests.html', 1200);
    } else {
      document.getElementById('mainContent').style.display = 'none';
      document.getElementById('successBox').style.display  = 'block';
      document.getElementById('createdTestId').textContent  = json.testId;
    }

  } catch (err) {
    showToast(String(err), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

/* ── Copy test ID ─────────────────────────── */
function copyTestId() {
  const text = document.getElementById('createdTestId').textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('Test ID copied!', 'success'));
  } else {
    const inp = document.createElement('input');
    inp.value = text; document.body.appendChild(inp);
    inp.select(); document.execCommand('copy');
    document.body.removeChild(inp);
    showToast('Test ID copied!', 'success');
  }
}

function goBack() {
  if (isDirty) {
    showConfirm('You have unsaved changes. Leave anyway?', () => {
      location.href = '/manage-tests.html';
    }, { danger: true, okLabel: 'Leave' });
  } else {
    location.href = '/manage-tests.html';
  }
}