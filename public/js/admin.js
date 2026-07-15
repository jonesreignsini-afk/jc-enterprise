(async function () {
  const me = await JCE.renderChrome('admin');
  if (!me || me.role !== 'admin') {
    document.getElementById('gate').classList.remove('hidden');
    document.getElementById('gate-msg').innerHTML = me
      ? 'This dashboard is for administrators only.'
      : 'Please <a href="/account.html" style="color:var(--gold-light);">sign in</a> as an admin to access this dashboard.';
    return;
  }
  document.getElementById('admin-section').classList.remove('hidden');

  document.querySelectorAll('#admin-section > .tabs .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#admin-section > .tabs .tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.d-tab-panel').forEach((p) => p.classList.add('hidden'));
      document.getElementById(`d-tab-${btn.dataset.dtab}`).classList.remove('hidden');
      loaders[btn.dataset.dtab] && loaders[btn.dataset.dtab]();
    });
  });

  async function loadStats() {
    const res = await fetch('/api/analytics', { headers: JCE.authHeaders() });
    const s = await res.json();
    document.getElementById('stat-grid').innerHTML = `
      <div class="glass stat-card"><div class="stat-num">${s.totalListings}</div><div class="stat-label">Listings</div></div>
      <div class="glass stat-card"><div class="stat-num">${s.pendingApproval}</div><div class="stat-label">Pending approval</div></div>
      <div class="glass stat-card"><div class="stat-num">${s.totalUsers}</div><div class="stat-label">Users</div></div>
      <div class="glass stat-card"><div class="stat-num">${s.totalAgents}</div><div class="stat-label">Agents</div></div>
      <div class="glass stat-card"><div class="stat-num">${s.pendingInspections}</div><div class="stat-label">Pending inspections</div></div>
      <div class="glass stat-card"><div class="stat-num">${s.newsletterSubscribers}</div><div class="stat-label">Newsletter subs</div></div>
    `;
  }

  async function loadListings() {
    const el = document.getElementById('admin-listings');
    el.innerHTML = '<p class="loading">Loading…</p>';
    const res = await fetch('/api/listings', { headers: JCE.authHeaders() });
    const data = await res.json();
    el.innerHTML = data.listings.length ? data.listings.map((l) => `
      <div class="table-row" id="row-${l.id}">
        <div class="table-row-top">
          <span class="table-row-title">${JCE.escapeHTML(l.title)}</span>
          <span class="badge ${l.approved ? 'badge-approved' : 'badge-pending'}">${l.approved ? 'live' : 'pending'}</span>
        </div>
        <span class="table-row-meta">${l.category} · ${JCE.escapeHTML(l.address || '')} · ${l.comments.length} comment${l.comments.length === 1 ? '' : 's'}</span>
        <div class="table-row-actions">
          ${!l.approved ? `<button class="approve-btn" data-id="${l.id}">Approve</button>` : ''}
          <button class="feature-btn" data-id="${l.id}">${l.featured ? 'Unfeature' : 'Feature'}</button>
          <a href="/listing.html?id=${l.id}" target="_blank"><button type="button">View</button></a>
          <button class="delete-btn danger" data-id="${l.id}">Delete</button>
        </div>
      </div>`).join('') : '<p class="empty-state">No listings yet.</p>';
    el.querySelectorAll('.approve-btn').forEach((b) => b.addEventListener('click', async () => { await fetch(`/api/listings/${b.dataset.id}/approve`, { method: 'POST', headers: JCE.authHeaders() }); loadListings(); loadStats(); }));
    el.querySelectorAll('.feature-btn').forEach((b) => b.addEventListener('click', async () => { await fetch(`/api/listings/${b.dataset.id}/feature`, { method: 'POST', headers: JCE.authHeaders() }); loadListings(); }));
    el.querySelectorAll('.delete-btn').forEach((b) => b.addEventListener('click', async () => { if (!confirm('Delete this listing?')) return; await fetch(`/api/listings/${b.dataset.id}`, { method: 'DELETE', headers: JCE.authHeaders() }); loadListings(); loadStats(); }));
  }

  async function loadUsers() {
    const el = document.getElementById('admin-users');
    el.innerHTML = '<p class="loading">Loading…</p>';
    const res = await fetch('/api/users', { headers: JCE.authHeaders() });
    const data = await res.json();
    el.innerHTML = data.users.map((u) => `
      <div class="table-row">
        <div class="table-row-top"><span class="table-row-title">${JCE.escapeHTML(u.name)}</span><span class="badge">${u.role}</span></div>
        <span class="table-row-meta">${JCE.escapeHTML(u.email)}</span>
        <div class="table-row-actions">
          <select data-id="${u.id}" class="role-select">
            <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
            <option value="agent" ${u.role === 'agent' ? 'selected' : ''}>Agent</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </div>
      </div>`).join('');
    el.querySelectorAll('.role-select').forEach((sel) => sel.addEventListener('change', async () => {
      await fetch(`/api/users/${sel.dataset.id}/role`, { method: 'PUT', headers: JCE.authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ role: sel.value }) });
      loadStats();
    }));
  }

  document.getElementById('blog-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('blog-form-msg');
    const payload = { title: document.getElementById('b-title').value, image: document.getElementById('b-image').value, body: document.getElementById('b-body').value };
    try {
      const res = await fetch('/api/blog', { method: 'POST', headers: JCE.authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error);
      document.getElementById('blog-form').reset();
      msgEl.textContent = 'Published!';
      loadBlog();
    } catch (err) { msgEl.textContent = err.message || 'Could not publish.'; }
  });
  async function loadBlog() {
    const el = document.getElementById('admin-blog');
    el.innerHTML = '<p class="loading">Loading…</p>';
    const res = await fetch('/api/blog');
    const data = await res.json();
    el.innerHTML = data.posts.length ? data.posts.map((p) => `
      <div class="table-row"><div class="table-row-top"><span class="table-row-title">${JCE.escapeHTML(p.title)}</span></div>
      <div class="table-row-actions"><button class="del-blog danger" data-id="${p.id}">Delete</button></div></div>`).join('') : '<p class="empty-state">No posts yet.</p>';
    el.querySelectorAll('.del-blog').forEach((b) => b.addEventListener('click', async () => { await fetch(`/api/blog/${b.dataset.id}`, { method: 'DELETE', headers: JCE.authHeaders() }); loadBlog(); }));
  }

  async function loadTestimonials() {
    const el = document.getElementById('admin-testimonials');
    el.innerHTML = '<p class="loading">Loading…</p>';
    const res = await fetch('/api/testimonials?all=true', { headers: JCE.authHeaders() });
    const data = await res.json();
    el.innerHTML = data.testimonials.length ? data.testimonials.map((t) => `
      <div class="table-row">
        <div class="table-row-top"><span class="table-row-title">${JCE.escapeHTML(t.name)} — ${'★'.repeat(t.rating)}</span><span class="badge ${t.approved ? 'badge-approved' : 'badge-pending'}">${t.approved ? 'live' : 'pending'}</span></div>
        <span class="table-row-meta">${JCE.escapeHTML(t.message)}</span>
        <div class="table-row-actions">
          ${!t.approved ? `<button class="approve-t" data-id="${t.id}">Approve</button>` : ''}
          <button class="del-t danger" data-id="${t.id}">Delete</button>
        </div>
      </div>`).join('') : '<p class="empty-state">No reviews yet.</p>';
    el.querySelectorAll('.approve-t').forEach((b) => b.addEventListener('click', async () => { await fetch(`/api/testimonials/${b.dataset.id}/approve`, { method: 'POST', headers: JCE.authHeaders() }); loadTestimonials(); }));
    el.querySelectorAll('.del-t').forEach((b) => b.addEventListener('click', async () => { await fetch(`/api/testimonials/${b.dataset.id}`, { method: 'DELETE', headers: JCE.authHeaders() }); loadTestimonials(); }));
  }

  async function loadInspections() {
    const el = document.getElementById('admin-inspections');
    el.innerHTML = '<p class="loading">Loading…</p>';
    const res = await fetch('/api/inspections', { headers: JCE.authHeaders() });
    const data = await res.json();
    el.innerHTML = data.inspections.length ? data.inspections.map((i) => `
      <div class="table-row">
        <div class="table-row-top"><span class="table-row-title">${JCE.escapeHTML(i.name)}</span><span class="badge badge-${i.status === 'confirmed' ? 'approved' : 'pending'}">${i.status}</span></div>
        <span class="table-row-meta">${i.date} ${i.time || ''} · ${JCE.escapeHTML(i.email || i.phone || '')}</span>
      </div>`).join('') : '<p class="empty-state">No inspection requests yet.</p>';
  }

  async function loadMessages() {
    const el = document.getElementById('admin-messages');
    el.innerHTML = '<p class="loading">Loading…</p>';
    const res = await fetch('/api/contact', { headers: JCE.authHeaders() });
    const data = await res.json();
    el.innerHTML = data.messages.length ? data.messages.map((m) => `
      <div class="table-row">
        <div class="table-row-top"><span class="table-row-title">${JCE.escapeHTML(m.name)}</span><span class="table-row-meta">${new Date(m.createdAt).toLocaleString()}</span></div>
        <span class="table-row-meta">${JCE.escapeHTML(m.email)} ${m.phone ? '· ' + JCE.escapeHTML(m.phone) : ''}</span>
        <p style="font-size:.86rem; margin:4px 0 0;">${JCE.escapeHTML(m.message)}</p>
      </div>`).join('') : '<p class="empty-state">No messages yet.</p>';
  }

  const loaders = { listings: loadListings, users: loadUsers, blog: loadBlog, testimonials: loadTestimonials, inspections: loadInspections, messages: loadMessages };

  loadStats();
  loadListings();
})();
