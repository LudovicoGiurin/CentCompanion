# Cent Companion

Unofficial companion app for **Centurion Commander** — event registration, Swiss pairings, national leaderboard, and metagame stats.

**Production:** [centcomp.net](https://centcomp.net)  
**Repo:** Cloudflare Pages (frontend) + Pages Functions / Workers API + Neon Postgres

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, React Router, Framer Motion |
| API | Hono on Cloudflare Pages Functions (`worker/`) |
| Database | Neon Postgres via `@neondatabase/serverless` + Drizzle ORM |
| Auth | JWT (httpOnly cookie), bcrypt passwords, email verification |
| Email | Resend (`RESEND_API_KEY`, `EMAIL_FROM`) |
| Captcha | Cloudflare Turnstile |
| Design | Spritecraft pixel UI kit (see below), styles in `src/styles/index.css` |

---

## Local development

```bash
cp .dev.vars.example .dev.vars   # fill DATABASE_URL, JWT_SECRET, etc.
npm install
npm run db:migrate               # apply Drizzle migrations
npm run dev                      # Vite :5173 + Wrangler proxy :8788
```

Open **http://localhost:8788** (API + frontend together).

### Design system

The UI is built on **Spritecraft**, a pixel-art design system from
[Uiverse Design](https://design.uiverse.io). Its tokens and base components
live in `css/system.css`, which `src/styles/index.css` imports before layering
the app's own `.cc-*` styles on top. See [NOTICE](./NOTICE) for licensing.

Build: `npm run build`  
Deploy: see [Deployment](#deployment)

---

## Project layout

```
src/                    React app (pages, components, hooks, lib)
worker/                 Hono API handlers + shared logic
  handlers/             Route handlers (auth, events, admin, …)
  _shared/              Auth, email, registrations, Swiss pairings
db/                     Drizzle schema + migrations
functions/              Cloudflare entry (api proxy, scheduled sync)
public/                 Static assets, manifest.json, _redirects
```

Key pages: `EventDetailPage`, `DashboardPage` (settings), `AdminPage`, `OrganizerPage`.

---

## Features (current)

### Auth & accounts
- Register / log in with email verification (Resend)
- Resend verification flow (`/resend-verification`)
- Forgot / reset password, change password in settings
- **Delete my account** in `/settings` — password confirm, anonymizes user, blocks admins and organizers with active events
- GDPR: privacy/terms pages, consent on signup, data export (`GET /api/auth/export`)
- Auth return URLs: `?return=/events/123?tab=register` after login/register

### Events & tournaments
- Event list + detail (hero, overview, roster, registration, **tournament** tab)
- Logged-in registration + optional **guest registration** (claim on login)
- **Join codes** — `/join` page, venue code on manage tab
- **WotC Companion event codes** — display on event page; organizer can **pull results** into Cent Companion (`COMPANION_ACCESS_TOKEN`)
- Moxfield deck URL + optional pasted/snapshot decklists, waitlist with position
- **Swiss / Swiss+Top Cut / Single Elim** — multi-phase pairings, configurable rounds, late enrollment
- **Player UX:** “Your table” hero, best-of-3 **score entry**, auto-refresh pairings on live tab
- **Organizer console:** drop players, manual pairings, round timer, public **display mode**, **event staff** (co-organizer / judge / scorekeeper)
- Live banner + sticky mobile CTA on event pages
- Add to calendar (Google + `.ics`), directions link

### Auth
- Email register/login + **Google/Discord OAuth** + **magic link**
- Organizer public profiles at `/organizers/:id`

### Other
- National leaderboard (Google Sheet sync + local DB)
- Metagame / rules pages (scheduled content sync)
- Admin: coordinator approvals, event review
- **Gibbo** — skippable dashboard onboarding tutorial (replay from Settings)
- PWA manifest, **dynamic OG images** for event links (`/api/events/:id/og.png`)
- Cloudflare Turnstile on register/login/guest register

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Full Neon `postgresql://…` URL (**required** in prod) |
| `JWT_SECRET` | Token signing |
| `APP_URL` | `https://centcomp.net` — used in verification email links |
| `RESEND_API_KEY` | Transactional email |
| `EMAIL_FROM` | e.g. `Cent Companion <noreply@centcomp.net>` |
| `TURNSTILE_SECRET_KEY` | Server-side captcha |
| `VITE_TURNSTILE_SITE_KEY` | Client-side captcha (build-time) |

Hyperdrive is **not** used; the Neon HTTP driver reads `DATABASE_URL` directly (`worker/runtime.ts`).

---

## Database

Schema: `db/schema.ts`  
Migrations: `db/migrations/` — run with `npm run db:migrate`

**First admin:** no account is seeded. After migrating, insert one by hand —
`db/migrations/20260701160000_seed_default_admin/migration.sql` has the exact
statement and the command for generating a bcrypt hash.

Notable tables: `users`, `events`, `event_registrations` (incl. guest regs), `matches`, `leaderboard_entries`, `coordinator_requests`.

---

## API routes (summary)

| Area | Examples |
|------|----------|
| Auth | `POST /api/auth/register`, `login`, `delete-account`, `export`, `change-password` |
| Events | `GET/POST /api/events`, register, pairings, manage |
| Admin | coordinator/event review |
| Public | leaderboard, news, rules, metagame |

Full routing: `worker/app.ts`

---

## Deployment

Cloudflare Pages, building to `dist/`. Connect the repo and Pages builds on
push with `npm run build`; `wrangler.toml` already declares the output
directory. To deploy by hand instead:

```bash
npm run build
npx wrangler pages deploy dist
```

Set the environment variables listed above on the Pages project (Production and
Preview), then redeploy — new variables do not reach an already-running
deployment until you do.

After deploy, confirm in Cloudflare dashboard:
- `DATABASE_URL` and `APP_URL=https://centcomp.net` set
- Resend domain verified for `@centcomp.net`
- Workers Paid plan enabled (bcrypt CPU)

---

## Design & conventions

- UI uses Spritecraft tokens (`--sc-*` CSS variables)
- Frontend API client: `src/lib/api.ts`
- Toast feedback: `useToast()`
- Mobile-first; compact header (`C//C`) with Log in / Join

---

## Changelog (high level)

| Date | Work |
|------|------|
| 2026-07 | Initial app: auth, events, Swiss pairings, leaderboard |
| 2026-07 | Turnstile, admin/organizer hubs, Spritecraft design kit |
| 2026-07 | Resend verification flow, change password, event detail redesign |
| 2026-07 | Guest registration, mobile UX, GDPR (privacy/export/delete), UX polish batch |
| 2026-07-06 | **Tournament revamp:** join codes, player tournament panel, organizer console, display mode, round timer |
| 2026-07-06 | Gibbo dashboard tutorial, OG embed images for event shares |
| 2026-07-06 | Best-of-3 match score entry; deploy fix (remove `[[rules]]` from wrangler.toml) |

**New machine:** `git pull`, `npm install`, `npm run db:migrate`, `npm run dev` → http://localhost:8788.

---

## Notes

Legal pages (`src/pages/LegalPages.tsx`) are **templates** — review with a lawyer before treating as final GDPR compliance.

Privacy contact: `privacy@centcomp.net` (`src/lib/legal.ts`).

---

## License

Source code is MIT licensed — see [LICENSE](./LICENSE). Third-party material
(the Spritecraft UI kit, Phosphor Icons, fonts, and Magic: The Gathering data)
is listed in [NOTICE](./NOTICE).
