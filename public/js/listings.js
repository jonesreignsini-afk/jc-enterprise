(async function () {
  const me = await JCE.renderChrome('listings');
  let favIds = [];
  if (me) {
    try {
      const res = await fetch('/api/favorites', { headers: JCE.authHeaders() });
      if (res.ok) { const d = await res.json(); favIds = d.listings.map((l) => l.id); }
    } catch (e) {}
  }

  const grid = document.getElementById('listings-grid');
  const params = new URLSearchParams(window.location.search);
  let currentCategory = params.get('category') || 'all';

  document.getElementById('f-location').value = params.get('location') || '';
  document.getElementById('f-type').value = params.get('propertyType') || '';
  document.getElementById('f-min').value = params.get('minPrice') || '';
  document.getElementById('f-max').value = params.get('maxPrice') || '';

  document.querySelectorAll('#category-filters .filter-pill').forEach((btn) => {
    if (btn.dataset.category === currentCategory) btn.classList.add('active'); else btn.classList.remove('active');
    btn.addEventListener('click', () => {
      document.querySelectorAll('#category-filters .filter-pill').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      load();
    });
  });

  document.getElementById('filter-form').addEventListener('submit', (e) => { e.preventDefault(); load(); });

  async function load() {
    grid.innerHTML = '<p class="loading">Loading properties…</p>';
    const q = new URLSearchParams();
    if (currentCategory !== 'all') q.set('category', currentCategory);
    const location = document.getElementById('f-location').value.trim();
    const type = document.getElementById('f-type').value;
    const min = document.getElementById('f-min').value;
    const max = document.getElementById('f-max').value;
    if (location) q.set('location', location);
    if (type) q.set('propertyType', type);
    if (min) q.set('minPrice', min);
    if (max) q.set('maxPrice', max);
    if (params.get('bedrooms')) q.set('bedrooms', params.get('bedrooms'));

    try {
      const res = await fetch(`/api/listings?${q.toString()}`);
      const data = await res.json();
      grid.innerHTML = (data.listings || []).length
        ? data.listings.map((l) => JCE.cardHTML(l, favIds)).join('')
        : '<p class="empty-state">No properties match your search yet.</p>';
      JCE.wireCardClicks(grid);
    } catch (e) {
      grid.innerHTML = '<p class="empty-state">Could not load properties. Please refresh.</p>';
    }
  }

  load();
})();
