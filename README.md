# JC Enterprise & Estate Management — Website

A full-stack property site: public listings (sale, rent, commercial, land,
short-let) with photo/video galleries, Google Maps per listing, comments,
favorites, and reviews — plus **three role-based dashboards** (buyer/user,
agent, admin), a blog, contact + newsletter, an inspection-booking flow, and
a mortgage calculator.

Built with **plain Node.js on the backend (zero npm dependencies)** and plain
HTML/CSS/JS on the frontend, so it runs anywhere Node runs — no `npm install`,
no build step.

## Read this first — what's real vs. what needs your own accounts

You asked for a React/Next.js + Laravel/Node + MySQL/Postgres stack with
Cloudinary, Google Maps API, and Paystack/Flutterwave. I built this in a
sandboxed environment with **no internet access**, so I couldn't run
`npm install` for React/Next, connect to a live database server, or call
Cloudinary/Paystack/Flutterwave (they all need live API keys and a network
call I'm not able to make here). Rather than hand you a half-wired scaffold
that name-drops those services but doesn't work, I built the same feature
set on a stack that runs immediately, with zero setup:

- **Works out of the box, fully functional:** everything listed under
  "What's included" below — auth, listings, search/filter, favorites,
  inspections, blog, reviews, contact form, newsletter, media upload,
  Google Maps embeds, mortgage calculator, dark mode, all three dashboards.
- **Needs your own accounts to go live (I've left clear integration points):**
  real payments (Paystack/Flutterwave), Cloudinary-hosted media instead of
  local disk, and a production database if you outgrow the JSON file. See
  "Swapping in real services" below.
- **Not built:** AI recommendations, 360° virtual tours, live chat, and
  multi-language — these are genuinely large sub-projects on their own;
  happy to scope any one of them next if you want it.

## 1. Run it

Requires [Node.js](https://nodejs.org) 16+.

```bash
cd jc-enterprise
node server.js
```

Open **http://localhost:3000**. Data lives in `data/db.json` and uploaded
media in `uploads/` — both are real files on disk, so everything survives a
restart.

## 2. Logging in

**Admin** (seeded automatically on first run):
- Email: `admin@jcenterprise.com`
- Password: `JCEnterprise2026!`
- Change it: set `ADMIN_PASSWORD`... actually this build derives the admin
  password from the seed in `data/db.json` — easiest way to change it is to
  sign in, then have an admin update it directly in future versions, or
  edit the seed password before first run (see `server.js` → `bootstrap()`).

**Agents and buyers** register themselves from `/account.html` — choose
"List properties as an agent" or "Browse & save properties." New agent
listings are held as **pending** until an admin approves them from
`/admin.html`, so nothing goes live without review.

## 3. What's included

- **Homepage** — hero, search bar, featured properties, services grid,
  testimonials, newsletter signup.
- **Listings** (`/listings.html`) — filter by status (sale/rent/commercial/
  land/short-let), property type, location, price range; each listing has
  its own page with a photo/video gallery, write-up, amenities, an embedded
  Google Map (no API key needed), comments, a "Book an inspection" form, a
  WhatsApp deep link, and a mortgage calculator for sale/land/commercial listings.
- **Accounts** (`/account.html`) — register/login, save favorites, view your
  inspection requests.
- **Agent dashboard** (`/agent.html`) — add/edit/delete your own listings,
  upload photos & videos, see inspection requests for your listings.
- **Admin dashboard** (`/admin.html`) — analytics, approve/feature/delete any
  listing, promote users to agent/admin, publish blog posts, moderate
  reviews, see all inspection requests and contact-form messages.
- **Blog, FAQ, About (with CEO contact), Contact form, newsletter capture.**
- **Glassmorphism UI** in the navy/gold palette from your logo, dark/light
  toggle, fully responsive (phone through desktop), floating WhatsApp button.

## 4. Personalize before launch

- **Logo** — already wired in at `public/img/logo.png` from what you sent.
- **CEO photo** — drop the file at `public/img/ceo.jpg`, then in
  `public/about.html` swap `<div class="ceo-photo">` for an `<img>` tag (or
  set it as a CSS background-image) pointing at that file.
- **CEO / office email** — you gave the phone number (0803 419 9497,
  already live as a tap-to-call and WhatsApp link) but not an email, so
  `ceo@jcenterprise.com` and `info@jcenterprise.com` are placeholders —
  search for them in `public/about.html`, `public/contact.html`, and
  `public/js/common.js` and replace with the real addresses.
- **Office address & map** — `public/contact.html` currently maps to
  "Lagos, Nigeria" generally; replace the address text and the map's `q=`
  parameter with your real office location.

## 5. Swapping in real services

- **Payments (Paystack/Flutterwave):** neither is wired in, since that
  needs your live secret keys and a real bank/settlement account. The
  cleanest integration point is `server.js` — add a `/api/payments/*`
  route that calls their REST API server-side (never expose secret keys in
  frontend JS), and a checkout button on the relevant page. Both providers'
  Node quickstarts are copy-paste once you have keys.
- **Cloudinary:** uploads currently save straight to the `uploads/` folder
  on disk via `/api/upload` in `server.js`. To use Cloudinary instead,
  swap the `fs.writeFile` call in that route for a Cloudinary upload call
  and store the returned URL the same way listings already store media URLs.
- **Production database:** `data/db.json` is fine for a small-to-medium
  site, but if you outgrow it, the whole persistence layer is the
  `readDB()`/`writeDB()` pair in `server.js` — swap those for calls to
  Postgres/MySQL (e.g. via `pg` or `mysql2`) without touching the rest of
  the API logic.
- **Hosting:** this runs as a Node process. Any VPS or PaaS that runs
  Node (Render, Railway, Fly.io, a DigitalOcean droplet) works — set
  `PORT` via environment variable and put it behind HTTPS (Caddy/Nginx or
  the platform's built-in TLS). Note most PaaS filesystems aren't
  persistent across deploys, so if you're using local `uploads/` storage,
  move to Cloudinary (or S3) before deploying there.

## 6. API reference

Auth: `Authorization: Bearer <token>` from `/api/login` or `/api/register`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/register` | – | create account (`role`: user or agent) |
| POST | `/api/login` | – | `{ email, password }` → `{ token, user }` |
| POST | `/api/logout` | any | invalidate token |
| GET | `/api/me` | any | current user |
| GET | `/api/listings` | – | list/search (`category`, `propertyType`, `location`, `minPrice`, `maxPrice`, `bedrooms`, `featured`, `mine=agent`) |
| POST | `/api/listings` | agent/admin | create (agents' listings start unapproved) |
| PUT / DELETE | `/api/listings/:id` | owner/admin | update / remove |
| POST | `/api/listings/:id/approve` | admin | publish a pending listing |
| POST | `/api/listings/:id/feature` | admin | toggle homepage feature |
| POST | `/api/listings/:id/comments` | – | post a comment |
| DELETE | `/api/listings/:id/comments/:cid` | owner/admin | remove a comment |
| GET / POST / DELETE | `/api/favorites[/:id]` | user | manage saved listings |
| POST | `/api/inspections` | – | book an inspection |
| GET | `/api/inspections` | any | your/your listings'/all (role-based) |
| PUT | `/api/inspections/:id` | agent/admin | update status |
| GET / POST | `/api/blog` | – / agent/admin | list / publish posts |
| DELETE | `/api/blog/:id` | admin | remove a post |
| GET / POST | `/api/testimonials` | – | list approved / submit (needs approval) |
| POST | `/api/testimonials/:id/approve` | admin | publish a review |
| DELETE | `/api/testimonials/:id` | admin | remove a review |
| POST | `/api/contact` | – | contact form |
| GET | `/api/contact` | admin | view messages |
| POST | `/api/newsletter` | – | subscribe an email |
| GET | `/api/users` | admin | list users |
| PUT | `/api/users/:id/role` | admin | change a user's role |
| GET | `/api/analytics` | admin | dashboard counts |
| POST | `/api/upload` | agent/admin | upload a photo/video, returns its URL |
