(async function () {
  const me = await JCE.renderChrome('listings');
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const container = document.getElementById('listing-detail');
  if (!id) { container.innerHTML = '<p class="empty-state">No property specified.</p>'; return; }

  let listing;
  try {
    const res = await fetch(`/api/listings/${id}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    listing = data.listing;
  } catch (e) {
    container.innerHTML = '<p class="empty-state">This property could not be found.</p>';
    return;
  }

  let favIds = [];
  if (me) {
    try { const r = await fetch('/api/favorites', { headers: JCE.authHeaders() }); if (r.ok) favIds = (await r.json()).listings.map((l) => l.id); } catch (e) {}
  }
  const isFav = favIds.includes(listing.id);

  const media = listing.media || [];
  const gallery = media.length
    ? media.map((m) => m.type === 'video' ? `<video src="${JCE.escapeHTML(m.url)}" controls></video>` : `<img src="${JCE.escapeHTML(m.url)}" alt="${JCE.escapeHTML(listing.title)}">`).join('')
    : '';
  const mapHTML = (listing.lat != null && listing.lng != null)
    ? `<iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${listing.lat},${listing.lng}&z=15&output=embed"></iframe>`
    : (listing.address
        ? `<iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(listing.address)}&z=14&output=embed"></iframe>`
        : `<div class="map-fallback">No location has been set for this property yet.</div>`);
  const amenities = (listing.amenities || []).map((a) => `<span class="amenity-pill">${JCE.escapeHTML(a)}</span>`).join('');
  const meta = [];
  if (listing.bedrooms) meta.push(`${listing.bedrooms} bedrooms`);
  if (listing.bathrooms) meta.push(`${listing.bathrooms} bathrooms`);

  const showCalc = listing.category === 'sale' || listing.category === 'commercial' || listing.category === 'land';

  container.innerHTML = `
    <div class="dash-grid">
      <div class="glass" style="padding:30px;">
        ${gallery ? `<div class="modal-gallery">${gallery}</div>` : ''}
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
          <div>
            <span class="card-tag" style="position:static; display:inline-block; margin-bottom:10px;">${JCE.CATEGORY_LABEL[listing.category] || listing.category}</span>
            <h1 style="font-size:1.7rem;">${JCE.escapeHTML(listing.title)}</h1>
          </div>
          <button class="card-fav ${isFav ? 'active' : ''}" id="fav-btn" style="position:static;">${isFav ? '♥' : '♡'}</button>
        </div>
        <div class="card-price" style="font-size:1.2rem;">${JCE.money(listing.price, listing.currency, listing.category)}</div>
        <div class="card-address">${JCE.escapeHTML(listing.address || '')}</div>
        <div class="card-meta" style="margin-top:6px;">${meta.join(' · ')}</div>
        <p class="modal-desc" style="margin-top:16px;">${JCE.escapeHTML(listing.description || '')}</p>
        ${amenities ? `<div class="amenity-list">${amenities}</div>` : ''}
        <div class="modal-map">${mapHTML}</div>

        <div class="comments">
          <h3>Comments &amp; questions</h3>
          <div class="comment-list" id="comment-list">
            ${(listing.comments || []).length ? listing.comments.map(commentItemHTML).join('') : '<p class="empty-state" style="padding:8px 0;">No comments yet — be the first to ask a question.</p>'}
          </div>
          <form class="comment-form stack-form" id="comment-form">
            <input type="text" name="name" placeholder="Your name" required maxlength="80">
            <textarea name="message" rows="3" placeholder="Ask a question or leave a comment…" required maxlength="1000"></textarea>
            <button type="submit" class="btn btn-gold">Post comment</button>
            <p class="form-msg" id="comment-form-msg"></p>
          </form>
        </div>
      </div>

      <div>
        <div class="glass" style="padding:26px; margin-bottom:20px;">
          <h3 style="font-size:1.1rem;">Interested in this property?</h3>
          <p class="hint" style="margin-bottom:14px;">Book an inspection or chat with us directly.</p>
          <button id="open-booking" class="btn btn-gold btn-block" style="margin-bottom:10px;">Book an inspection</button>
          <a href="https://wa.me/2348034199497?text=${encodeURIComponent('Hi, I am interested in: ' + listing.title)}" target="_blank" rel="noopener" class="btn btn-ghost btn-block">Chat on WhatsApp</a>
        </div>
        ${showCalc ? mortgageCalcHTML(listing.price) : ''}
      </div>
    </div>
  `;

  document.getElementById('fav-btn').addEventListener('click', async () => {
    const favs = await JCE.toggleFavorite(listing.id, isFav);
    if (favs) window.location.reload();
  });

  document.getElementById('comment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const msgEl = document.getElementById('comment-form-msg');
    const name = form.name.value.trim();
    const message = form.message.value.trim();
    if (!name || !message) return;
    msgEl.textContent = 'Posting…';
    try {
      const res = await fetch(`/api/listings/${listing.id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, message }) });
      if (!res.ok) throw new Error();
      const { comment } = await res.json();
      const list = document.getElementById('comment-list');
      if (list.querySelector('.empty-state')) list.innerHTML = '';
      list.insertAdjacentHTML('beforeend', commentItemHTML(comment));
      form.reset();
      msgEl.textContent = 'Posted!';
      setTimeout(() => (msgEl.textContent = ''), 2000);
    } catch (err) {
      msgEl.textContent = 'Could not post your comment. Please try again.';
    }
  });

  function commentItemHTML(c) {
    return `<div class="comment">
      <div class="comment-name">${JCE.escapeHTML(c.name)}</div>
      <div class="comment-msg">${JCE.escapeHTML(c.message)}</div>
      <div class="comment-time">${new Date(c.createdAt).toLocaleString()}</div>
    </div>`;
  }

  function mortgageCalcHTML(price) {
    return `
      <div class="glass" style="padding:26px;">
        <h3 style="font-size:1.1rem;">Mortgage calculator</h3>
        <form id="calc-form" class="stack-form">
          <label>Property price (₦)<input type="number" id="calc-price" value="${price || ''}"></label>
          <label>Down payment (%)<input type="number" id="calc-down" value="20"></label>
          <label>Interest rate (% per year)<input type="number" id="calc-rate" value="18" step="0.1"></label>
          <label>Loan term (years)<input type="number" id="calc-years" value="15"></label>
          <button type="submit" class="btn btn-ghost btn-block">Calculate</button>
        </form>
        <div id="calc-result" class="calc-result hidden" style="margin-top:14px;">
          <div class="stat-num" id="calc-monthly">—</div>
          <div class="stat-label">Estimated monthly payment</div>
        </div>
        <p class="hint" style="margin-top:10px;">Estimate only — actual mortgage terms depend on your lender.</p>
      </div>`;
  }

  const calcForm = document.getElementById('calc-form');
  if (calcForm) {
    calcForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const price = Number(document.getElementById('calc-price').value) || 0;
      const downPct = Number(document.getElementById('calc-down').value) || 0;
      const ratePct = Number(document.getElementById('calc-rate').value) || 0;
      const years = Number(document.getElementById('calc-years').value) || 1;
      const principal = price * (1 - downPct / 100);
      const monthlyRate = ratePct / 100 / 12;
      const n = years * 12;
      const monthly = monthlyRate === 0 ? principal / n : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
      document.getElementById('calc-monthly').textContent = `₦${new Intl.NumberFormat('en-NG').format(Math.round(monthly))}`;
      document.getElementById('calc-result').classList.remove('hidden');
    });
  }

  // booking modal
  const bookingOverlay = document.getElementById('booking-overlay');
  document.getElementById('open-booking').addEventListener('click', () => bookingOverlay.classList.remove('hidden'));
  document.getElementById('booking-close').addEventListener('click', () => bookingOverlay.classList.add('hidden'));
  document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('booking-msg');
    const payload = {
      listingId: listing.id,
      name: document.getElementById('bk-name').value,
      email: document.getElementById('bk-email').value,
      phone: document.getElementById('bk-phone').value,
      date: document.getElementById('bk-date').value,
      time: document.getElementById('bk-time').value,
    };
    try {
      const res = await fetch('/api/inspections', { method: 'POST', headers: JCE.authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      msgEl.textContent = 'Inspection requested! We will confirm by email or phone shortly.';
      msgEl.className = 'form-msg success';
      document.getElementById('booking-form').reset();
    } catch (err) {
      msgEl.textContent = 'Could not submit request. Please try again.';
      msgEl.className = 'form-msg error';
    }
  });
})();
