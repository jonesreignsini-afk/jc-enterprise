/**
 * JC Enterprise & Estate Management — backend server
 * Pure Node.js (zero external dependencies). Run with: node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const DB_FILE = path.join(ROOT, 'data', 'db.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ---------- password hashing (scrypt, no deps) ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

// ---------- tiny "database" helpers (JSON file on disk) ----------
function readDB() { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function writeDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function uid(prefix) { return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`; }

// one-time bootstrap: replace seed placeholder with a real hash for the default admin
(function bootstrap() {
  const db = readDB();
  let changed = false;
  db.users.forEach((u) => {
    if (u.passwordHash === 'SEED_ADMIN_PW') {
      u.passwordHash = hashPassword('JCEnterprise2026!');
      changed = true;
    }
  });
  if (changed) writeDB(db);
})();

// ---------- sessions (in-memory) ----------
const sessions = new Map(); // token -> userId
function currentUser(req, db) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !sessions.has(token)) return null;
  const userId = sessions.get(token);
  return db.users.find((u) => u.id === userId) || null;
}
function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

// ---------- body / response helpers ----------
function readJSONBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [], size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 50 * 1024 * 1024) { reject(new Error('Payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

// ---------- static file serving ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mov': 'video/quicktime', '.ico': 'image/x-icon',
};
function serveStatic(req, res, baseDir, urlPath) {
  let safePath = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(baseDir, safePath);
  if (!filePath.startsWith(baseDir)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filePath, (err, stat) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    fs.readFile(filePath, (err2, data) => {
      if (err2) { res.writeHead(404); return res.end('Not found'); }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

// ---------- helpers ----------
function requireAuth(req, db) { return currentUser(req, db); }
function requireRole(req, db, roles) {
  const u = currentUser(req, db);
  if (!u || !roles.includes(u.role)) return null;
  return u;
}
function visibleListing(l) { return l; }

// ---------- API ----------
async function handleAPI(req, res, pathname, query) {
  const db = readDB();

  // ===== AUTH =====
  if (pathname === '/api/register' && req.method === 'POST') {
    const body = await readJSONBody(req);
    if (!body.name || !body.email || !body.password) return sendJSON(res, 400, { error: 'name, email and password are required' });
    if (db.users.find((u) => u.email.toLowerCase() === body.email.toLowerCase())) return sendJSON(res, 409, { error: 'An account with that email already exists' });
    const role = body.role === 'agent' ? 'agent' : 'user';
    const user = {
      id: uid('user'), name: body.name, email: body.email.toLowerCase(),
      passwordHash: hashPassword(body.password), role, favorites: [], createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    writeDB(db);
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, user.id);
    return sendJSON(res, 201, { token, user: publicUser(user) });
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    const body = await readJSONBody(req);
    const user = db.users.find((u) => u.email.toLowerCase() === (body.email || '').toLowerCase());
    if (!user || !verifyPassword(body.password || '', user.passwordHash)) return sendJSON(res, 401, { error: 'Incorrect email or password' });
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, user.id);
    return sendJSON(res, 200, { token, user: publicUser(user) });
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token) sessions.delete(token);
    return sendJSON(res, 200, { ok: true });
  }

  if (pathname === '/api/me' && req.method === 'GET') {
    const u = currentUser(req, db);
    if (!u) return sendJSON(res, 401, { error: 'Not signed in' });
    return sendJSON(res, 200, { user: publicUser(u) });
  }

  // ===== LISTINGS =====
  if (pathname === '/api/listings' && req.method === 'GET') {
    let listings = db.listings.slice();
    const u = currentUser(req, db);
    // public/anonymous only sees approved listings; agents also see their own pending; admin sees all
    listings = listings.filter((l) => l.approved || (u && (u.role === 'admin' || u.id === l.agentId)));

    const category = query.get('category');
    const propertyType = query.get('propertyType');
    const location = query.get('location');
    const minPrice = query.get('minPrice');
    const maxPrice = query.get('maxPrice');
    const bedrooms = query.get('bedrooms');
    const featured = query.get('featured');
    const mine = query.get('mine'); // 'agent' -> only this agent's listings

    if (category && category !== 'all') listings = listings.filter((l) => l.category === category);
    if (propertyType) listings = listings.filter((l) => l.propertyType === propertyType);
    if (location) listings = listings.filter((l) => (l.address || '').toLowerCase().includes(location.toLowerCase()));
    if (minPrice) listings = listings.filter((l) => Number(l.price) >= Number(minPrice));
    if (maxPrice) listings = listings.filter((l) => Number(l.price) <= Number(maxPrice));
    if (bedrooms) listings = listings.filter((l) => Number(l.bedrooms) >= Number(bedrooms));
    if (featured === 'true') listings = listings.filter((l) => l.featured);
    if (mine === 'agent' && u) listings = listings.filter((l) => l.agentId === u.id);

    listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJSON(res, 200, { listings });
  }

  if (pathname === '/api/listings' && req.method === 'POST') {
    const u = requireRole(req, db, ['agent', 'admin']);
    if (!u) return sendJSON(res, 401, { error: 'Sign in as an agent or admin to add a listing' });
    const body = await readJSONBody(req);
    if (!body.title || !body.category) return sendJSON(res, 400, { error: 'title and category are required' });
    const listing = {
      id: uid('listing'), title: body.title, category: body.category, propertyType: body.propertyType || 'house',
      price: body.price != null ? Number(body.price) : 0, currency: body.currency || 'NGN',
      address: body.address || '', lat: body.lat != null ? Number(body.lat) : null, lng: body.lng != null ? Number(body.lng) : null,
      bedrooms: body.bedrooms != null && body.bedrooms !== '' ? Number(body.bedrooms) : null,
      bathrooms: body.bathrooms != null && body.bathrooms !== '' ? Number(body.bathrooms) : null,
      amenities: Array.isArray(body.amenities) ? body.amenities : [],
      description: body.description || '', media: Array.isArray(body.media) ? body.media : [],
      featured: !!body.featured && u.role === 'admin', approved: u.role === 'admin',
      agentId: u.id, createdAt: new Date().toISOString(), comments: [],
    };
    db.listings.push(listing);
    writeDB(db);
    return sendJSON(res, 201, { listing });
  }

  const singleMatch = pathname.match(/^\/api\/listings\/([^/]+)$/);
  if (singleMatch) {
    const id = singleMatch[1];
    const idx = db.listings.findIndex((l) => l.id === id);
    if (req.method === 'GET') {
      if (idx === -1) return sendJSON(res, 404, { error: 'Not found' });
      return sendJSON(res, 200, { listing: db.listings[idx] });
    }
    if (req.method === 'PUT') {
      const u = currentUser(req, db);
      if (idx === -1) return sendJSON(res, 404, { error: 'Not found' });
      const listing = db.listings[idx];
      if (!u || (u.role !== 'admin' && u.id !== listing.agentId)) return sendJSON(res, 401, { error: 'Not authorized' });
      const body = await readJSONBody(req);
      const merged = { ...listing, ...body, id: listing.id, agentId: listing.agentId, createdAt: listing.createdAt, comments: listing.comments };
      if (u.role !== 'admin') { merged.approved = listing.approved; merged.featured = listing.featured; } // agents can't self-approve/feature
      db.listings[idx] = merged;
      writeDB(db);
      return sendJSON(res, 200, { listing: merged });
    }
    if (req.method === 'DELETE') {
      const u = currentUser(req, db);
      if (idx === -1) return sendJSON(res, 404, { error: 'Not found' });
      const listing = db.listings[idx];
      if (!u || (u.role !== 'admin' && u.id !== listing.agentId)) return sendJSON(res, 401, { error: 'Not authorized' });
      db.listings.splice(idx, 1);
      writeDB(db);
      (listing.media || []).forEach((m) => { if (m.url && m.url.startsWith('/uploads/')) fs.unlink(path.join(UPLOADS_DIR, path.basename(m.url)), () => {}); });
      return sendJSON(res, 200, { ok: true });
    }
  }

  // approve / feature (admin only)
  const approveMatch = pathname.match(/^\/api\/listings\/([^/]+)\/approve$/);
  if (approveMatch && req.method === 'POST') {
    const u = requireRole(req, db, ['admin']);
    if (!u) return sendJSON(res, 401, { error: 'Admin only' });
    const listing = db.listings.find((l) => l.id === approveMatch[1]);
    if (!listing) return sendJSON(res, 404, { error: 'Not found' });
    listing.approved = true;
    writeDB(db);
    return sendJSON(res, 200, { listing });
  }
  const featureMatch = pathname.match(/^\/api\/listings\/([^/]+)\/feature$/);
  if (featureMatch && req.method === 'POST') {
    const u = requireRole(req, db, ['admin']);
    if (!u) return sendJSON(res, 401, { error: 'Admin only' });
    const listing = db.listings.find((l) => l.id === featureMatch[1]);
    if (!listing) return sendJSON(res, 404, { error: 'Not found' });
    listing.featured = !listing.featured;
    writeDB(db);
    return sendJSON(res, 200, { listing });
  }

  // comments
  const commentMatch = pathname.match(/^\/api\/listings\/([^/]+)\/comments$/);
  if (commentMatch && req.method === 'POST') {
    const listing = db.listings.find((l) => l.id === commentMatch[1]);
    if (!listing) return sendJSON(res, 404, { error: 'Listing not found' });
    const body = await readJSONBody(req);
    if (!body.name || !body.message) return sendJSON(res, 400, { error: 'name and message are required' });
    const comment = { id: uid('c'), name: String(body.name).slice(0, 80), message: String(body.message).slice(0, 1000), createdAt: new Date().toISOString() };
    listing.comments.push(comment);
    writeDB(db);
    return sendJSON(res, 201, { comment });
  }
  const commentDelMatch = pathname.match(/^\/api\/listings\/([^/]+)\/comments\/([^/]+)$/);
  if (commentDelMatch && req.method === 'DELETE') {
    const [, id, commentId] = commentDelMatch;
    const listing = db.listings.find((l) => l.id === id);
    if (!listing) return sendJSON(res, 404, { error: 'Listing not found' });
    const u = currentUser(req, db);
    if (!u || (u.role !== 'admin' && u.id !== listing.agentId)) return sendJSON(res, 401, { error: 'Not authorized' });
    listing.comments = listing.comments.filter((c) => c.id !== commentId);
    writeDB(db);
    return sendJSON(res, 200, { ok: true });
  }

  // ===== FAVORITES =====
  if (pathname === '/api/favorites' && req.method === 'GET') {
    const u = requireAuth(req, db);
    if (!u) return sendJSON(res, 401, { error: 'Sign in to view favorites' });
    const favs = db.listings.filter((l) => (u.favorites || []).includes(l.id));
    return sendJSON(res, 200, { listings: favs });
  }
  const favToggleMatch = pathname.match(/^\/api\/favorites\/([^/]+)$/);
  if (favToggleMatch && (req.method === 'POST' || req.method === 'DELETE')) {
    const u = requireAuth(req, db);
    if (!u) return sendJSON(res, 401, { error: 'Sign in to save favorites' });
    const dbUser = db.users.find((x) => x.id === u.id);
    dbUser.favorites = dbUser.favorites || [];
    const id = favToggleMatch[1];
    if (req.method === 'POST') { if (!dbUser.favorites.includes(id)) dbUser.favorites.push(id); }
    else { dbUser.favorites = dbUser.favorites.filter((f) => f !== id); }
    writeDB(db);
    return sendJSON(res, 200, { favorites: dbUser.favorites });
  }

  // ===== INSPECTIONS =====
  if (pathname === '/api/inspections' && req.method === 'POST') {
    const body = await readJSONBody(req);
    if (!body.listingId || !body.name || !body.date) return sendJSON(res, 400, { error: 'listingId, name and date are required' });
    const u = currentUser(req, db);
    const inspection = {
      id: uid('insp'), listingId: body.listingId, name: body.name, email: body.email || '',
      phone: body.phone || '', date: body.date, time: body.time || '', userId: u ? u.id : null,
      status: 'pending', createdAt: new Date().toISOString(),
    };
    db.inspections.push(inspection);
    writeDB(db);
    return sendJSON(res, 201, { inspection });
  }
  if (pathname === '/api/inspections' && req.method === 'GET') {
    const u = requireAuth(req, db);
    if (!u) return sendJSON(res, 401, { error: 'Not authorized' });
    let list = db.inspections;
    if (u.role === 'admin') { /* all */ }
    else if (u.role === 'agent') { const myListingIds = db.listings.filter((l) => l.agentId === u.id).map((l) => l.id); list = list.filter((i) => myListingIds.includes(i.listingId)); }
    else { list = list.filter((i) => i.userId === u.id); }
    return sendJSON(res, 200, { inspections: list });
  }
  const inspStatusMatch = pathname.match(/^\/api\/inspections\/([^/]+)$/);
  if (inspStatusMatch && req.method === 'PUT') {
    const u = requireRole(req, db, ['admin', 'agent']);
    if (!u) return sendJSON(res, 401, { error: 'Not authorized' });
    const insp = db.inspections.find((i) => i.id === inspStatusMatch[1]);
    if (!insp) return sendJSON(res, 404, { error: 'Not found' });
    const body = await readJSONBody(req);
    if (body.status) insp.status = body.status;
    writeDB(db);
    return sendJSON(res, 200, { inspection: insp });
  }

  // ===== BLOG =====
  if (pathname === '/api/blog' && req.method === 'GET') {
    return sendJSON(res, 200, { posts: db.blogPosts.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
  }
  if (pathname === '/api/blog' && req.method === 'POST') {
    const u = requireRole(req, db, ['admin', 'agent']);
    if (!u) return sendJSON(res, 401, { error: 'Not authorized' });
    const body = await readJSONBody(req);
    if (!body.title || !body.body) return sendJSON(res, 400, { error: 'title and body are required' });
    const post = { id: uid('blog'), title: body.title, excerpt: body.excerpt || body.body.slice(0, 140), body: body.body, image: body.image || '', authorId: u.id, createdAt: new Date().toISOString() };
    db.blogPosts.push(post);
    writeDB(db);
    return sendJSON(res, 201, { post });
  }
  const blogSingleMatch = pathname.match(/^\/api\/blog\/([^/]+)$/);
  if (blogSingleMatch) {
    const post = db.blogPosts.find((p) => p.id === blogSingleMatch[1]);
    if (req.method === 'GET') { if (!post) return sendJSON(res, 404, { error: 'Not found' }); return sendJSON(res, 200, { post }); }
    if (req.method === 'DELETE') {
      const u = requireRole(req, db, ['admin']);
      if (!u) return sendJSON(res, 401, { error: 'Not authorized' });
      db.blogPosts = db.blogPosts.filter((p) => p.id !== blogSingleMatch[1]);
      writeDB(db);
      return sendJSON(res, 200, { ok: true });
    }
  }

  // ===== TESTIMONIALS =====
  if (pathname === '/api/testimonials' && req.method === 'GET') {
    const u = currentUser(req, db);
    const showAll = u && u.role === 'admin' && query.get('all') === 'true';
    const list = showAll ? db.testimonials : db.testimonials.filter((t) => t.approved);
    return sendJSON(res, 200, { testimonials: list });
  }
  if (pathname === '/api/testimonials' && req.method === 'POST') {
    const body = await readJSONBody(req);
    if (!body.name || !body.message) return sendJSON(res, 400, { error: 'name and message are required' });
    const t = { id: uid('t'), name: body.name, rating: Math.min(5, Math.max(1, Number(body.rating) || 5)), message: body.message, approved: false, createdAt: new Date().toISOString() };
    db.testimonials.push(t);
    writeDB(db);
    return sendJSON(res, 201, { testimonial: t, note: 'Thanks! Your review will appear once approved.' });
  }
  const testApproveMatch = pathname.match(/^\/api\/testimonials\/([^/]+)\/approve$/);
  if (testApproveMatch && req.method === 'POST') {
    const u = requireRole(req, db, ['admin']);
    if (!u) return sendJSON(res, 401, { error: 'Admin only' });
    const t = db.testimonials.find((x) => x.id === testApproveMatch[1]);
    if (!t) return sendJSON(res, 404, { error: 'Not found' });
    t.approved = true;
    writeDB(db);
    return sendJSON(res, 200, { testimonial: t });
  }
  const testDelMatch = pathname.match(/^\/api\/testimonials\/([^/]+)$/);
  if (testDelMatch && req.method === 'DELETE') {
    const u = requireRole(req, db, ['admin']);
    if (!u) return sendJSON(res, 401, { error: 'Admin only' });
    db.testimonials = db.testimonials.filter((t) => t.id !== testDelMatch[1]);
    writeDB(db);
    return sendJSON(res, 200, { ok: true });
  }

  // ===== CONTACT + NEWSLETTER =====
  if (pathname === '/api/contact' && req.method === 'POST') {
    const body = await readJSONBody(req);
    if (!body.name || !body.email || !body.message) return sendJSON(res, 400, { error: 'name, email and message are required' });
    const msg = { id: uid('msg'), name: body.name, email: body.email, phone: body.phone || '', message: body.message, createdAt: new Date().toISOString() };
    db.contactMessages.push(msg);
    writeDB(db);
    return sendJSON(res, 201, { ok: true });
  }
  if (pathname === '/api/contact' && req.method === 'GET') {
    const u = requireRole(req, db, ['admin']);
    if (!u) return sendJSON(res, 401, { error: 'Admin only' });
    return sendJSON(res, 200, { messages: db.contactMessages.slice().reverse() });
  }
  if (pathname === '/api/newsletter' && req.method === 'POST') {
    const body = await readJSONBody(req);
    if (!body.email) return sendJSON(res, 400, { error: 'email is required' });
    if (!db.newsletter.includes(body.email)) db.newsletter.push(body.email);
    writeDB(db);
    return sendJSON(res, 201, { ok: true });
  }

  // ===== ADMIN: users + analytics =====
  if (pathname === '/api/users' && req.method === 'GET') {
    const u = requireRole(req, db, ['admin']);
    if (!u) return sendJSON(res, 401, { error: 'Admin only' });
    return sendJSON(res, 200, { users: db.users.map(publicUser) });
  }
  const userRoleMatch = pathname.match(/^\/api\/users\/([^/]+)\/role$/);
  if (userRoleMatch && req.method === 'PUT') {
    const u = requireRole(req, db, ['admin']);
    if (!u) return sendJSON(res, 401, { error: 'Admin only' });
    const target = db.users.find((x) => x.id === userRoleMatch[1]);
    if (!target) return sendJSON(res, 404, { error: 'Not found' });
    const body = await readJSONBody(req);
    if (!['user', 'agent', 'admin'].includes(body.role)) return sendJSON(res, 400, { error: 'Invalid role' });
    target.role = body.role;
    writeDB(db);
    return sendJSON(res, 200, { user: publicUser(target) });
  }

  if (pathname === '/api/analytics' && req.method === 'GET') {
    const u = requireRole(req, db, ['admin']);
    if (!u) return sendJSON(res, 401, { error: 'Admin only' });
    return sendJSON(res, 200, {
      totalListings: db.listings.length,
      pendingApproval: db.listings.filter((l) => !l.approved).length,
      totalUsers: db.users.length,
      totalAgents: db.users.filter((x) => x.role === 'agent').length,
      totalInspections: db.inspections.length,
      pendingInspections: db.inspections.filter((i) => i.status === 'pending').length,
      totalMessages: db.contactMessages.length,
      newsletterSubscribers: db.newsletter.length,
      byCategory: db.listings.reduce((acc, l) => { acc[l.category] = (acc[l.category] || 0) + 1; return acc; }, {}),
    });
  }

  // ===== MEDIA UPLOAD =====
  if (pathname === '/api/upload' && req.method === 'POST') {
    const u = requireRole(req, db, ['agent', 'admin']);
    if (!u) return sendJSON(res, 401, { error: 'Not authorized' });
    const body = await readJSONBody(req);
    if (!body.filename || !body.dataBase64) return sendJSON(res, 400, { error: 'filename and dataBase64 required' });
    const ext = path.extname(body.filename).toLowerCase() || '.bin';
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.webm', '.mov'];
    if (!allowed.includes(ext)) return sendJSON(res, 400, { error: `Unsupported file type ${ext}` });
    const safeName = `${uid('media')}${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeName);
    const base64Data = body.dataBase64.replace(/^data:[^;]+;base64,/, '');
    fs.writeFile(filePath, Buffer.from(base64Data, 'base64'), (err) => {
      if (err) return sendJSON(res, 500, { error: 'Failed to save file' });
      const type = ['.mp4', '.webm', '.mov'].includes(ext) ? 'video' : 'image';
      sendJSON(res, 201, { url: `/uploads/${safeName}`, type });
    });
    return;
  }

  return sendJSON(res, 404, { error: 'Unknown API route' });
}

// ---------- server ----------
const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsed.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    });
    return res.end();
  }
  if (pathname.startsWith('/api/')) {
    handleAPI(req, res, pathname, parsed.searchParams).catch((err) => { console.error(err); sendJSON(res, 500, { error: 'Server error' }); });
    return;
  }
  if (pathname.startsWith('/uploads/')) return serveStatic(req, res, UPLOADS_DIR, pathname.replace('/uploads', ''));
  return serveStatic(req, res, PUBLIC_DIR, pathname === '/' ? '/index.html' : pathname);
});

server.listen(PORT, () => {
  console.log(`JC Enterprise server running at http://localhost:${PORT}`);
  console.log(`Default admin login: admin@jcenterprise.com / JCEnterprise2026! (change this before launch)`);
});
