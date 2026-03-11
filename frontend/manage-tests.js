const staffId = localStorage.getItem('staffId');
if (!staffId) { document.body.innerHTML = '<div class="card center" style="padding:40px; margin:40px auto; max-width:400px;"><h2>Access denied</h2></div>'; throw new Error(); }

let allTests = [];

function goBack() { location.href = '/dashboard.html'; }

async function loadTests() {
  try {
    const res = await fetch(`/api/tests/by-staff/${staffId}`);
    if (!res.ok) throw new Error();
    allTests = await res.json();
    renderTests(allTests);
  } catch {
    showToast('Failed to load tests', 'error');
    document.getElementById('testTable').innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--danger);">Error loading tests</td></tr>`;
  }
}

function filterTests() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('filterStatus').value;
  const filtered = allTests.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search) || t.testId.toLowerCase().includes(search);
    const matchStatus = status === 'all'
      || (status === 'published'   &&  t.resultsPublished)
      || (status === 'unpublished' && !t.resultsPublished);
    return matchSearch && matchStatus;
  });
  renderTests(filtered);
}

function renderTests(tests) {
  const tbody = document.getElementById('testTable');
  const emptyMsg = document.getElementById('emptyMsg');

  if (!tests.length) {
    tbody.innerHTML = '';
    emptyMsg.style.display = '';
    return;
  }
  emptyMsg.style.display = 'none';

  tbody.innerHTML = tests.map(t => {
    const statusBadge = t.resultsPublished
      ? '<span class="badge badge-green">✓ Published</span>'
      : '<span class="badge badge-gray">● Unpublished</span>';

    const publishBtn = t.resultsPublished
      ? `<button class="btn btn-sm" disabled style="opacity:0.45; cursor:default;">Published</button>`
      : `<button class="btn btn-primary btn-sm" onclick="publishResults('${t.testId}', this)">Publish</button>`;

    return `
      <tr>
        <td><code style="font-size:12px; background:var(--bg); padding:3px 8px; border-radius:5px;">${t.testId}</code></td>
        <td style="font-weight:500;">${t.title}</td>
        <td>${statusBadge}</td>
        <td>
          <span style="font-weight:700; color:var(--primary);">${t.attempts}</span>
          <span style="color:var(--muted); font-size:12px;"> student${t.attempts !== 1 ? 's' : ''}</span>
        </td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-sm" onclick="viewResults('${t.testId}')">📊 Results</button>
            <button class="btn btn-sm" onclick="editTest('${t.testId}')">✏️ Edit</button>
            ${publishBtn}
            <button class="btn btn-sm" style="border-color:#fecaca; color:var(--danger);" onclick="deleteTest('${t._id}')">🗑</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function editTest(testId) {
  location.href = `/create-test.html?edit=${testId}`;
}

function viewResults(testId) {
  location.href = `/results.html?testId=${testId}`;
}

async function publishResults(testId, btn) {
  showConfirm('Once published, students can view their results. This cannot be undone.', async () => {
    btn.disabled = true;
    btn.textContent = 'Publishing…';
    try {
      const res = await fetch(`/api/tests/${testId}/publish-results`, { method: 'POST' });
      if (!res.ok) throw new Error();
      showToast('Results published successfully!', 'success');
      loadTests();
    } catch {
      showToast('Failed to publish results', 'error');
      btn.disabled = false; btn.textContent = 'Publish';
    }
  }, { okLabel: 'Publish Results' });
}

async function deleteTest(id) {
  showConfirm('Delete this test permanently? All results will also be deleted.', async () => {
    try {
      await fetch(`/api/tests/${id}`, { method: 'DELETE' });
      showToast('Test deleted', 'info');
      loadTests();
    } catch {
      showToast('Failed to delete test', 'error');
    }
  }, { danger: true, okLabel: 'Delete Test' });
}

loadTests();