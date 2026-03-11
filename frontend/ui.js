/* ═══════════════════════════════════════════
   GLOBAL UI UTILITIES — loaded on every page
   ═══════════════════════════════════════════ */

/* ── Toast system ─────────────────────────── */
(function initToasts() {
  const wrap = document.createElement('div');
  wrap.id = 'toastContainer';
  document.body.appendChild(wrap);
})();

function showToast(message, type = 'info', duration = 3200) {
  const wrap = document.getElementById('toastContainer');
  if (!wrap) return;

  const icons = { success: '✓', error: '✕', info: 'ℹ', warn: '⚠' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  wrap.appendChild(t);

  setTimeout(() => {
    t.classList.add('hiding');
    setTimeout(() => t.remove(), 260);
  }, duration);
}

/* ── Confirm modal ────────────────────────── */
function showConfirm(message, onConfirm, opts = {}) {
  const existing = document.getElementById('_confirmModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = '_confirmModal';
  overlay.className = 'modal-overlay open';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:400px;">
      <div class="modal-header">
        <span class="modal-title">${opts.title || 'Confirm'}</span>
      </div>
      <p style="color:var(--muted); font-size:14px; margin-bottom:20px;">${message}</p>
      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button class="btn" id="_confirmCancel">Cancel</button>
        <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" id="_confirmOk">
          ${opts.okLabel || 'Confirm'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#_confirmOk').onclick = () => {
    overlay.remove();
    onConfirm();
  };
  overlay.querySelector('#_confirmCancel').onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}

/* ── Skeleton helpers ─────────────────────── */
function skeletonRows(cols, count = 4) {
  return Array.from({ length: count }, () =>
    `<tr>${Array.from({ length: cols }, () =>
      `<td><div class="skeleton" style="height:16px; width:${60 + Math.random()*30}%;"></div></td>`
    ).join('')}</tr>`
  ).join('');
}