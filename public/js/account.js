(async function () {
  const me = await JCE.renderChrome('account');

  if (me) {
    if (me.role === 'admin') { window.location.href = '/admin.html'; return; }
    if (me.role === 'agent') { window.location.href = '/agent.html'; return; }
    document.getElementById('dashboard-section').classList.remove('hidden');
    loadFavorites();
    loadInspections();
    document.querySelectorAll('#dashboard-section .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#dashboard-section .tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.u-tab-panel').forEach((p) => p.classList.add('hidden'));
        document.getElementById(`u-tab-${btn.dataset.utab}`).classList.remove('hidden');
      });
    });
    return;
  }

  document.getElementById('auth-section').classList.remove('hidden');
  document.querySelectorAll('#auth-section .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#auth-section .tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('#auth-section .tab-panel').forEach((p) => p.classList.remove('active'));
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('login-msg');
    const payload = { email: document.getElementById('li-email').value, password: document.getElementById('li-password').value };
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      JCE.setToken(data.token);
      window.location.href = data.user.role === 'admin' ? '/admin.html' : data.user.role === 'agent' ? '/agent.html' : '/account.html';
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.className = 'form-msg error';
    }
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('register-msg');
    const payload = {
      name: document.getElementById('rg-name').value,
      email: document.getElementById('rg-email').value,
      password: document.getElementById('rg-password').value,
      role: document.getElementById('rg-role').value,
    };
    try {
      const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      JCE.setToken(data.token);
      window.location.href = data.user.role === 'agent' ? '/agent.html' : '/account.html';
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.className = 'form-msg error';
    }
  });

  async function loadFavorites() {
    const grid = document.getElementById('favorites-grid');
    try {
      const res = await fetch('/api/favorites', { headers: JCE.authHeaders() });
      const data = await res.json();
      const ids = data.listings.map((l) => l.id);
      grid.innerHTML = data.listings.length ? data.listings.map((l) => JCE.cardHTML(l, ids)).join('') : '<p class="empty-state">You haven\'t saved any properties yet.</p>';
      JCE.wireCardClicks(grid);
    } catch (e) { grid.innerHTML = '<p class="empty-state">Could not load favorites.</p>'; }
  }

  async function loadInspections() {
    const list = document.getElementById('inspections-list');
    try {
      const res = await fetch('/api/inspections', { headers: JCE.authHeaders() });
      const data = await res.json();
      list.innerHTML = data.inspections.length ? data.inspections.map((i) => `
        <div class="table-row">
          <div class="table-row-top"><span class="table-row-title">Inspection request</span><span class="badge badge-${i.status === 'confirmed' ? 'approved' : 'pending'}">${i.status}</span></div>
          <span class="table-row-meta">${i.date} ${i.time || ''}</span>
        </div>`).join('') : '<p class="empty-state">No inspection requests yet.</p>';
    } catch (e) { list.innerHTML = '<p class="empty-state">Could not load inspections.</p>'; }
  }
})();
