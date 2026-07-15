(async function () {
  const me = await JCE.renderChrome('home');
  let favIds = [];
  if (me) {
    try {
      const res = await fetch('/api/favorites', { headers: JCE.authHeaders() });
      if (res.ok) { const d = await res.json(); favIds = d.listings.map((l) => l.id); }
    } catch (e) {}
  }

  // featured listings
  const grid = document.getElementById('featured-grid');
  try {
    const res = await fetch('/api/listings?featured=true');
    const data = await res.json();
    grid.innerHTML = (data.listings || []).length
      ? data.listings.slice(0, 6).map((l) => JCE.cardHTML(l, favIds)).join('')
      : '<p class="empty-state">No featured properties yet.</p>';
    JCE.wireCardClicks(grid);
  } catch (e) {
    grid.innerHTML = '<p class="empty-state">Could not load properties.</p>';
  }

  // testimonials
  const tGrid = document.getElementById('testimonials-grid');
  try {
    const res = await fetch('/api/testimonials');
    const data = await res.json();
    tGrid.innerHTML = (data.testimonials || []).length
      ? data.testimonials.map((t) => `
          <div class="glass testimonial-card">
            <div class="stars">${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</div>
            <p class="testimonial-msg">${JCE.escapeHTML(t.message)}</p>
            <div class="testimonial-name">${JCE.escapeHTML(t.name)}</div>
          </div>`).join('')
      : '<p class="empty-state">No reviews yet.</p>';
  } catch (e) {
    tGrid.innerHTML = '<p class="empty-state">Could not load reviews.</p>';
  }

  // hero search -> listings.html
  document.getElementById('hero-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    const location = document.getElementById('hs-location').value.trim();
    const category = document.getElementById('hs-category').value;
    const type = document.getElementById('hs-type').value;
    const bedrooms = document.getElementById('hs-bedrooms').value;
    if (location) params.set('location', location);
    if (category && category !== 'all') params.set('category', category);
    if (type) params.set('propertyType', type);
    if (bedrooms) params.set('bedrooms', bedrooms);
    window.location.href = `/listings.html?${params.toString()}`;
  });

  // newsletter
  document.getElementById('newsletter-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('newsletter-msg');
    const email = document.getElementById('newsletter-email').value;
    try {
      const res = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (!res.ok) throw new Error();
      msgEl.textContent = 'Subscribed! Thanks for joining.';
      msgEl.className = 'form-msg success';
      document.getElementById('newsletter-email').value = '';
    } catch (e) {
      msgEl.textContent = 'Could not subscribe. Please try again.';
      msgEl.className = 'form-msg error';
    }
  });

  // review modal
  const reviewOverlay = document.getElementById('review-overlay');
  document.getElementById('open-review').addEventListener('click', () => reviewOverlay.classList.remove('hidden'));
  document.getElementById('review-close').addEventListener('click', () => reviewOverlay.classList.add('hidden'));
  document.getElementById('review-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('review-msg');
    const payload = {
      name: document.getElementById('rv-name').value,
      rating: document.getElementById('rv-rating').value,
      message: document.getElementById('rv-message').value,
    };
    try {
      const res = await fetch('/api/testimonials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      msgEl.textContent = data.note || 'Thanks for your review!';
      msgEl.className = 'form-msg success';
      document.getElementById('review-form').reset();
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.className = 'form-msg error';
    }
  });
})();
