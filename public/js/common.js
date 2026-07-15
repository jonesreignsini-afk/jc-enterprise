// ===== JC Enterprise — shared chrome (header, footer, auth, dark mode) =====
const JCE = (function () {
  const TOKEN_KEY = 'jce_token';
  const THEME_KEY = 'jce_theme';

  function token() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }
  function authHeaders(extra = {}) {
    const t = token();
    return t ? Object.assign({ Authorization: `Bearer ${t}` }, extra) : extra;
  }

  async function getMe() {
    if (!token()) return null;
    try {
      const res = await fetch('/api/me', { headers: authHeaders() });
      if (!res.ok) { clearToken(); return null; }
      const data = await res.json();
      return data.user;
    } catch (e) { return null; }
  }

  function applyTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.classList.toggle('light', saved === 'light');
  }
  function toggleTheme() {
    const isLight = document.documentElement.classList.toggle('light');
    localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
  }

  function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function money(amount, currency, category) {
    if (amount == null || amount === '') return 'Price on request';
    const n = Number(amount);
    const formatted = new Intl.NumberFormat('en-NG').format(n);
    const symbol = currency === 'USD' ? '$' : '₦';
    const suffix = category === 'shortlet' ? '/night' : category === 'rent' ? '/year' : '';
    return `${symbol}${formatted}${suffix}`;
  }

  async function renderChrome(activePage) {
    applyTheme();
    const me = await getMe();

    const headerEl = document.getElementById('app-header');
    if (headerEl) headerEl.innerHTML = headerHTML(me, activePage);

    const footerEl = document.getElementById('app-footer');
    if (footerEl) footerEl.innerHTML = footerHTML();

    if (!document.querySelector('.whatsapp-float')) {
      const wa = document.createElement('a');
      wa.href = 'https://wa.me/2348034199497';
      wa.target = '_blank';
      wa.rel = 'noopener';
      wa.className = 'whatsapp-float';
      wa.setAttribute('aria-label', 'Chat with us on WhatsApp');
      wa.textContent = '💬';
      document.body.appendChild(wa);
    }

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    const logoutBtn = document.getElementById('logout-link');
    if (logoutBtn) logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try { await fetch('/api/logout', { method: 'POST', headers: authHeaders() }); } catch (err) {}
      clearToken();
      window.location.href = '/';
    });

    const navToggle = document.getElementById('nav-toggle');
    const navEl = document.getElementById('main-nav');
    if (navToggle && navEl) navToggle.addEventListener('click', () => navEl.classList.toggle('nav-open'));

    return me;
  }

  function headerHTML(me, activePage) {
    const link = (href, label, key) => `<a href="${href}" class="${activePage === key ? 'active-link' : ''}">${label}</a>`;
    let authLinks = `<a href="/account.html" class="nav-pill">Sign in</a>`;
    if (me) {
      const dashHref = me.role === 'admin' ? '/admin.html' : me.role === 'agent' ? '/agent.html' : '/account.html';
      authLinks = `
        <a href="${dashHref}" class="nav-pill">${escapeHTML(me.name.split(' ')[0])} · ${me.role}</a>
        <a href="#" id="logout-link">Log out</a>`;
    }
    return `
      <div class="wrap topbar-inner">
        <a href="/" class="brand">
          <img src="/img/logo.png" alt="JC Enterprise logo">
          <span>JC Enterprise</span>
        </a>
        <nav class="nav" id="main-nav">
          ${link('/listings.html', 'Properties', 'listings')}
          ${link('/about.html', 'About', 'about')}
          ${link('/blog.html', 'Blog', 'blog')}
          ${link('/faq.html', 'FAQ', 'faq')}
          ${link('/contact.html', 'Contact', 'contact')}
          <button id="theme-toggle" class="icon-btn" title="Toggle dark / light" aria-label="Toggle theme">◐</button>
          ${authLinks}
        </nav>
      </div>`;
  }

  function footerHTML() {
    return `
      <div class="wrap footer-inner">
        <span>&copy; ${new Date().getFullYear()} JC Enterprise &amp; Estate Management. Managing spaces, creating value.</span>
        <div class="social-row">
          <a href="tel:+2348034199497" title="Call us">📞</a>
          <a href="mailto:info@jcenterprise.com" title="Email us">✉️</a>
          <a href="https://wa.me/2348034199497" target="_blank" rel="noopener" title="WhatsApp">💬</a>
        </div>
      </div>`;
  }

  const CATEGORY_LABEL = { sale: 'For Sale', rent: 'For Rent', commercial: 'Commercial', land: 'Land', shortlet: 'Short-let' };

  function cardHTML(l, favIds) {
    const media = (l.media || [])[0];
    let mediaHTML = '<div class="no-media">No photo yet</div>';
    if (media) {
      mediaHTML = media.type === 'video'
        ? `<video src="${escapeHTML(media.url)}" muted playsinline></video>`
        : `<img src="${escapeHTML(media.url)}" alt="${escapeHTML(l.title)}" loading="lazy">`;
    }
    const isFav = favIds && favIds.includes(l.id);
    const meta = [];
    if (l.bedrooms) meta.push(`${l.bedrooms} bed`);
    if (l.bathrooms) meta.push(`${l.bathrooms} bath`);
    return `
      <article class="card" data-id="${l.id}">
        <div class="card-media">
          <span class="card-tag">${CATEGORY_LABEL[l.category] || l.category}</span>
          <button class="card-fav ${isFav ? 'active' : ''}" data-fav="${l.id}" aria-label="Save to favorites">${isFav ? '♥' : '♡'}</button>
          ${mediaHTML}
        </div>
        <div class="card-body">
          ${!l.approved ? '<span class="pending-badge">Pending approval</span>' : ''}
          <h3>${escapeHTML(l.title)}</h3>
          <span class="card-price">${money(l.price, l.currency, l.category)}</span>
          <span class="card-meta">${meta.join(' · ')}</span>
          <span class="card-address">${escapeHTML(l.address || '')}</span>
        </div>
      </article>`;
  }

  async function toggleFavorite(id, isActive) {
    if (!token()) { window.location.href = '/account.html'; return null; }
    const res = await fetch(`/api/favorites/${id}`, { method: isActive ? 'DELETE' : 'POST', headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.favorites;
  }

  function wireCardClicks(container) {
    container.querySelectorAll('.card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-fav')) return;
        window.location.href = `/listing.html?id=${card.dataset.id}`;
      });
    });
    container.querySelectorAll('.card-fav').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.fav;
        const isActive = btn.classList.contains('active');
        const favs = await toggleFavorite(id, isActive);
        if (favs) { btn.classList.toggle('active'); btn.textContent = btn.classList.contains('active') ? '♥' : '♡'; }
      });
    });
  }

  return { token, setToken, clearToken, authHeaders, getMe, renderChrome, escapeHTML, money, toggleTheme, cardHTML, wireCardClicks, toggleFavorite, CATEGORY_LABEL };
})();
