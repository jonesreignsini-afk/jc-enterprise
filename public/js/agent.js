(async function () {
  const me = await JCE.renderChrome('agent');
  if (!me || (me.role !== 'agent' && me.role !== 'admin')) {
    document.getElementById('gate').classList.remove('hidden');
    document.getElementById('gate-msg').innerHTML = me
      ? 'This dashboard is for agents only.'
      : 'Please <a href="/account.html" style="color:var(--gold-light);">sign in</a> as an agent to access this dashboard.';
    return;
  }
  document.getElementById('agent-section').classList.remove('hidden');

  document.querySelectorAll('#agent-section > .tabs .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#agent-section > .tabs .tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.a-tab-panel').forEach((p) => p.classList.add('hidden'));
      document.getElementById(`a-tab-${btn.dataset.atab}`).classList.remove('hidden');
      if (btn.dataset.atab === 'inspections') loadInspections();
    });
  });

  let pendingMedia = [];
  const fMedia = document.getElementById('f-media');
  const mediaPreview = document.getElementById('media-preview');
  const listingForm = document.getElementById('listing-form');
  const listingFormMsg = document.getElementById('listing-form-msg');
  const cancelEditBtn = document.getElementById('cancel-edit');
  const formModeLabel = document.getElementById('form-mode-label');

  fMedia.addEventListener('change', async () => {
    const files = Array.from(fMedia.files);
    for (const file of files) {
      const dataBase64 = await fileToBase64(file);
      listingFormMsg.textContent = `Uploading ${file.name}…`;
      try {
        const res = await fetch('/api/upload', { method: 'POST', headers: JCE.authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ filename: file.name, dataBase64 }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        pendingMedia.push({ url: data.url, type: data.type });
        renderMediaPreview();
        listingFormMsg.textContent = '';
      } catch (err) { listingFormMsg.textContent = `Could not upload ${file.name}: ${err.message}`; }
    }
    fMedia.value = '';
  });

  function fileToBase64(file) {
    return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
  }
  function renderMediaPreview() {
    mediaPreview.innerHTML = pendingMedia.map((m, i) => `
      <div class="thumb">${m.type === 'video' ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}">`}<button type="button" data-idx="${i}">&times;</button></div>`).join('');
    mediaPreview.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', () => { pendingMedia.splice(Number(btn.dataset.idx), 1); renderMediaPreview(); }));
  }

  listingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('listing-id').value;
    const amenities = document.getElementById('f-amenities').value.split(',').map((s) => s.trim()).filter(Boolean);
    const payload = {
      title: document.getElementById('f-title').value.trim(),
      category: document.getElementById('f-category').value,
      propertyType: document.getElementById('f-type').value,
      price: document.getElementById('f-price').value ? Number(document.getElementById('f-price').value) : 0,
      address: document.getElementById('f-address').value.trim(),
      lat: document.getElementById('f-lat').value ? Number(document.getElementById('f-lat').value) : null,
      lng: document.getElementById('f-lng').value ? Number(document.getElementById('f-lng').value) : null,
      bedrooms: document.getElementById('f-bedrooms').value || null,
      bathrooms: document.getElementById('f-bathrooms').value || null,
      amenities,
      description: document.getElementById('f-description').value.trim(),
      media: pendingMedia,
    };
    listingFormMsg.textContent = 'Saving…';
    try {
      const res = await fetch(id ? `/api/listings/${id}` : '/api/listings', {
        method: id ? 'PUT' : 'POST', headers: JCE.authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      listingFormMsg.textContent = id ? 'Updated!' : 'Saved — pending admin approval before it goes public.';
      resetForm();
      loadMyListings();
      setTimeout(() => (listingFormMsg.textContent = ''), 3000);
    } catch (err) { listingFormMsg.textContent = err.message; }
  });

  cancelEditBtn.addEventListener('click', resetForm);
  function resetForm() {
    listingForm.reset(); document.getElementById('listing-id').value = ''; pendingMedia = []; renderMediaPreview();
    formModeLabel.textContent = 'New listing'; cancelEditBtn.classList.add('hidden');
  }
  function startEdit(l) {
    document.getElementById('listing-id').value = l.id;
    document.getElementById('f-title').value = l.title || '';
    document.getElementById('f-category').value = l.category || 'sale';
    document.getElementById('f-type').value = l.propertyType || 'house';
    document.getElementById('f-price').value = l.price || '';
    document.getElementById('f-address').value = l.address || '';
    document.getElementById('f-lat').value = l.lat ?? '';
    document.getElementById('f-lng').value = l.lng ?? '';
    document.getElementById('f-bedrooms').value = l.bedrooms ?? '';
    document.getElementById('f-bathrooms').value = l.bathrooms ?? '';
    document.getElementById('f-amenities').value = (l.amenities || []).join(', ');
    document.getElementById('f-description').value = l.description || '';
    pendingMedia = (l.media || []).slice(); renderMediaPreview();
    formModeLabel.textContent = 'Editing listing'; cancelEditBtn.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadMyListings() {
    const el = document.getElementById('my-listings');
    el.innerHTML = '<p class="loading">Loading…</p>';
    const res = await fetch('/api/listings?mine=agent', { headers: JCE.authHeaders() });
    const data = await res.json();
    const mine = data.listings || [];
    el.innerHTML = mine.length ? mine.map((l) => `
      <div class="table-row" id="row-${l.id}">
        <div class="table-row-top">
          <span class="table-row-title">${JCE.escapeHTML(l.title)}</span>
          <span class="badge ${l.approved ? 'badge-approved' : 'badge-pending'}">${l.approved ? 'live' : 'pending approval'}</span>
        </div>
        <span class="table-row-meta">${l.category} · ${JCE.escapeHTML(l.address || '')}</span>
        <div class="table-row-actions">
          <button class="edit-btn">Edit</button>
          <button class="delete-btn danger">Delete</button>
        </div>
      </div>`).join('') : '<p class="empty-state">No listings yet — add your first one.</p>';
    mine.forEach((l) => {
      const row = document.getElementById(`row-${l.id}`);
      row.querySelector('.edit-btn').addEventListener('click', () => startEdit(l));
      row.querySelector('.delete-btn').addEventListener('click', async () => {
        if (!confirm('Delete this listing?')) return;
        await fetch(`/api/listings/${l.id}`, { method: 'DELETE', headers: JCE.authHeaders() });
        loadMyListings();
      });
    });
  }

  async function loadInspections() {
    const el = document.getElementById('agent-inspections');
    el.innerHTML = '<p class="loading">Loading…</p>';
    const res = await fetch('/api/inspections', { headers: JCE.authHeaders() });
    const data = await res.json();
    el.innerHTML = data.inspections.length ? data.inspections.map((i) => `
      <div class="table-row" id="insp-${i.id}">
        <div class="table-row-top"><span class="table-row-title">${JCE.escapeHTML(i.name)}</span><span class="badge badge-${i.status === 'confirmed' ? 'approved' : 'pending'}">${i.status}</span></div>
        <span class="table-row-meta">${i.date} ${i.time || ''} · ${JCE.escapeHTML(i.email || i.phone || '')}</span>
        <div class="table-row-actions">
          <select data-id="${i.id}" class="status-select">
            <option value="pending" ${i.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="confirmed" ${i.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="cancelled" ${i.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </div>
      </div>`).join('') : '<p class="empty-state">No inspection requests yet.</p>';
    el.querySelectorAll('.status-select').forEach((sel) => {
      sel.addEventListener('change', async () => {
        await fetch(`/api/inspections/${sel.dataset.id}`, { method: 'PUT', headers: JCE.authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ status: sel.value }) });
      });
    });
  }

  loadMyListings();
})();
