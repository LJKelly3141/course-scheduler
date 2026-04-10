# UWRF Course Scheduler: Web App Feasibility Report

**Date:** 2026-04-05
**Context:** Exploration of what it would take to convert the current Electron desktop app into a multi-department web application.

---

## Current Architecture Summary

The course scheduler is a full-stack app:
- **Backend**: Python / FastAPI / SQLAlchemy 2.0 / Alembic / SQLite
- **Frontend**: React 18 / TypeScript / Vite / Tailwind CSS
- **Desktop**: Electron wraps the above, spawning a PyInstaller-bundled backend and serving the built frontend from local files

Key facts:
- No authentication (was removed — single-user desktop app)
- SQLite database stored locally
- Hardcoded `127.0.0.1:8000` references throughout
- File system operations (export directory browsing, database backup) assume local access
- SQLite-specific code in `main.py` (PRAGMA calls, WAL checkpoints, schema patching)

---

## 1. Hosting

### What Needs to Change

The backend is already FastAPI, which is a standard Python web framework — it's deployable anywhere. The main work is:

1. **Parameterize host/port** — `run_server.py` and `electron/main.cjs` hardcode `127.0.0.1:8000`
2. **Add production WSGI/ASGI server config** — Gunicorn with Uvicorn workers is standard for FastAPI
3. **Serve frontend separately** — the React build output (`frontend/dist/`) needs to be served as static files, either by Nginx, a CDN, or FastAPI's `StaticFiles` middleware
4. **SSL/TLS** — required for any web-facing app; handled by reverse proxy or platform
5. **Update CORS** — currently allows `localhost:*`, `app://.`, and `null`; needs the actual domain

### Option A: Traditional VPS

**Platforms:** DigitalOcean, Linode, AWS Lightsail, Vultr
**Cost:** $5-20/month
**Architecture:**
```
Internet -> Nginx (SSL termination, static files)
                |-> Gunicorn/Uvicorn (FastAPI backend)
                |-> PostgreSQL
```

**Pros:**
- Full control over the environment
- Cheapest option for a small-scale app
- Can run PostgreSQL on the same server
- No vendor lock-in

**Cons:**
- You manage OS updates, security patches, backups, SSL renewal
- Manual scaling if multiple departments drive significant load
- Need to set up deployment pipeline (or use something like Ansible/Docker)

**Good fit if:** You're comfortable with Linux server administration or have IT support.

### Option B: Platform-as-a-Service (PaaS)

**Platforms:** Railway, Render, Fly.io, Google Cloud Run
**Cost:** $5-25/month (depends on usage; Render and Railway have free tiers but they sleep)

**Architecture:**
```
Internet -> PaaS-managed load balancer (SSL automatic)
                |-> Container running FastAPI
                |-> Managed PostgreSQL (or external like Supabase/Neon)
Frontend -> Static hosting (Vercel, Netlify, or same PaaS)
```

**Pros:**
- Push-to-deploy (connect GitHub repo, auto-deploys on merge)
- SSL, scaling, health checks handled automatically
- Managed PostgreSQL add-ons available
- Low maintenance overhead

**Cons:**
- Slightly higher cost than raw VPS at scale
- Less control over infrastructure
- Cold starts on free/cheap tiers (app sleeps when idle)
- Some platforms have egress/bandwidth limits

**Platform-specific notes:**
- **Railway**: Easiest Python deployment, managed Postgres add-on, ~$5/mo for low traffic
- **Render**: Free tier available (sleeps after 15min), managed Postgres, good docs
- **Fly.io**: More control (runs containers globally), Postgres included, slightly more complex setup
- **Cloud Run (GCP)**: Pay-per-request, scales to zero, but more complex to configure

**Good fit if:** You want minimal DevOps overhead and are okay with a small monthly cost.

### Recommendation

**Railway or Render** (Option B) is the best fit — minimal DevOps overhead, push-to-deploy, managed PostgreSQL, and reasonable cost. A VPS (Option A) is the fallback if you need maximum control or the lowest possible cost.

---

## 2. Data

### Database Migration: SQLite to PostgreSQL

SQLAlchemy abstracts most database differences, so the core models and queries would work with PostgreSQL with minimal changes. The specific work:

**Must change:**
- `database.py`: Replace SQLite connection string with PostgreSQL (`postgresql://user:pass@host/db`)
- `alembic.ini` / `alembic/env.py`: Dynamic database URL from environment variable (currently hardcoded SQLite path)
- `main.py` `_ensure_schema_current()`: Remove SQLite PRAGMA calls (lines ~74, 104, 141, 151, 161). PostgreSQL uses `ALTER TABLE` natively — no need for the workaround pattern of create-new-table, copy data, drop old
- `settings.py`: Remove SQLite WAL checkpoint in database backup endpoint

**Should change:**
- Database backup endpoint: Can't just stream the file. Would need `pg_dump` or a logical backup approach
- Export directory browsing: Won't work on a remote server. Exports would need to download to the user's browser instead

**Minimal changes:**
- Model definitions: Standard SQLAlchemy types used throughout — these are portable
- Queries: No raw SQL detected; all queries use SQLAlchemy ORM — these are portable
- Alembic migration files: Mostly portable, but would need testing against PostgreSQL

### Multi-Tenancy

For multiple departments sharing one instance, you need data isolation. Two approaches:

**Approach A: Schema-per-department (recommended for simplicity)**
- Each department gets its own PostgreSQL schema (like a namespace)
- Application routes requests to the correct schema based on the logged-in user's department
- Clean isolation — one department can't accidentally see another's data
- Backup/restore per department is straightforward
- Downside: schema migrations must run against each schema

**Approach B: Shared schema with `department_id`**
- One set of tables, every row tagged with `department_id`
- Every query must filter by department (easy to forget, risky)
- More complex but scales better for large numbers of departments
- Standard approach for SaaS applications

**Recommendation:** Schema-per-department is simpler and safer for a university tool with a modest number of departments. You'd add a `departments` table in a shared schema for department metadata and user-department mappings.

---

## 3. Authentication

### Current State

Authentication was fully implemented and then removed (migration `d1f4e14cdc49_drop_users_table`). The app has zero auth — all endpoints are open. Legacy dependencies (`python-jose`, `passlib`, `bcrypt`) are still installed.

### What Needs Protection

Every endpoint needs auth for a web deployment. Specifically critical:
- All data mutation endpoints (create/update/delete for sections, meetings, courses, etc.)
- Import endpoints (XLSX import can overwrite schedule data)
- Settings endpoints (database backup, directory operations)
- Term finalization (irreversible in workflow terms)

### Option A: OAuth2 (Google / Microsoft)

**How it works:**
- "Sign in with Google" or "Sign in with Microsoft" button
- Uses OAuth2 + OpenID Connect (OIDC) standard flow
- App receives user's email, name, profile picture

**Implementation:**
- `authlib` library with FastAPI integration
- Register app with Google Cloud Console or Azure AD (App Registration)
- Restrict allowed email domains to `@uwrf.edu`

**Pros:**
- Well-documented, battle-tested libraries
- No IT coordination needed (if using public Google/Microsoft OAuth)
- Users likely already signed into Google or Microsoft in their browser
- Simpler than SAML

**Cons:**
- Doesn't automatically provide department affiliation (you'd manage this in-app)
- If UWRF uses Google Workspace, Google OAuth could effectively act like SSO
- Requires internet access to authenticate (not a problem for a web app)

**Good fit if:** You want auth up and running quickly without waiting on IT.

### Option B: Email/Password (Custom Auth)

**How it works:**
- Traditional registration/login with email and password
- You previously had this — could reimplement

**Implementation:**
- Reuse `passlib`/`bcrypt` (already installed) for password hashing
- `python-jose` (already installed) for JWT tokens
- FastAPI's `OAuth2PasswordBearer` dependency for token validation
- Add back a `users` table with email, hashed password, department, role

**Pros:**
- Fully self-contained — no external dependencies
- You've done it before in this codebase
- Works regardless of university IT cooperation

**Cons:**
- Yet another password for users to manage
- You're responsible for password security, reset flows, etc.
- No automatic department/identity verification
- Least user-friendly option

**Not recommended** for a multi-department university tool — too much friction and liability.

### Role-Based Access Control (RBAC)

Regardless of auth method, you'd need roles:

| Role | Permissions |
|------|------------|
| **System Admin** | Manage departments, manage all users, view all data |
| **Department Admin** | Full CRUD on their department's schedules, manage department users, import/export, finalize terms |
| **Editor** | Create/edit sections and meetings in their department, cannot finalize |
| **Viewer** | Read-only access to their department's schedules |

### Two-Factor Authentication (2FA)

For a web-facing app with scheduling data, 2FA is worth considering:

**If using OAuth2 (Option A):**
- Google and Microsoft both support 2FA on their accounts
- If a user has 2FA enabled on their Google/Microsoft account, it applies automatically during OAuth login
- You can't *enforce* 2FA from your app, but most university-managed Google Workspace / M365 tenants already require it
- No additional work needed in your app — the identity provider handles it

**If using Email/Password (Option B):**
- You'd need to implement 2FA yourself: TOTP via authenticator apps (Google Authenticator, Authy, etc.) or email-based codes
- Libraries: `pyotp` for TOTP generation/verification, `qrcode` for setup QR codes
- Adds significant complexity: enrollment flow, recovery codes, backup methods, admin reset capability
- Another reason to avoid custom auth

**Bottom line:** OAuth2 effectively gives you 2FA for free because the identity provider handles it. Custom email/password auth would require building 2FA from scratch — yet another reason it's not recommended.

### Recommendation

**Start with OAuth2 (Google or Microsoft)** — it's the fastest path to working auth with a good user experience, and 2FA comes for free via the provider. Restrict to `@uwrf.edu` emails. Email/password is not worth the maintenance burden or 2FA implementation cost for a university tool.

---

## 4. Budget Planning (10 Departments)

Estimated monthly and annual costs for running the course scheduler as a web app serving 10 UWRF departments. Assumes low-to-moderate traffic (department chairs and a few editors per department — roughly 30-50 users total, not concurrent).

### Scenario A: Railway (Recommended)

| Item | Monthly | Annual |
|------|---------|--------|
| **Pro plan** (base subscription) | $20 | $240 |
| **Compute** (FastAPI backend, light usage ~0.5 vCPU / 512MB) | ~$5-10 | ~$60-120 |
| **PostgreSQL** (storage is near-free on Railway; CPU/memory usage-based) | ~$3-7 | ~$36-84 |
| **Network egress** ($0.10/GB, minimal for this app) | ~$1-2 | ~$12-24 |
| **Domain name** (.edu likely already owned, or ~$12/yr for custom) | $0-1 | $0-12 |
| **SSL certificate** (free via Let's Encrypt, auto-managed by Railway) | $0 | $0 |
| **Google OAuth** (free for authentication) | $0 | $0 |
| **Total** | **~$29-40** | **~$348-480** |

Railway bills by the second based on actual CPU/memory utilization, so idle time costs near-zero. The Pro plan's $20/mo base includes $20 of usage credits. For a scheduling app used primarily during business hours with 10 departments, expect to land in the $30-40/mo range.

### Scenario B: Render

| Item | Monthly | Annual |
|------|---------|--------|
| **Web service** (Starter: 512MB RAM, 0.5 vCPU) | $7 | $84 |
| **PostgreSQL** (Starter: 512MB RAM, 0.5 vCPU, 1GB included) | $7 | $84 |
| **Additional DB storage** ($0.25/GB/mo if needed beyond 1GB) | ~$0-3 | ~$0-36 |
| **Domain + SSL** (free Let's Encrypt, auto-managed) | $0 | $0 |
| **Google OAuth** | $0 | $0 |
| **Total** | **~$14-17** | **~$168-204** |

Render is cheaper at the entry level with fixed-price instances. The tradeoff: the $7 instances are modest — if you need more headroom, the next tier (Standard) is $25/mo each for web service and database.

### Scenario C: VPS (DigitalOcean/Linode)

| Item | Monthly | Annual |
|------|---------|--------|
| **Droplet/VPS** (2GB RAM, 1 vCPU — runs both app + PostgreSQL) | $12 | $144 |
| **Managed PostgreSQL** (optional, if you don't want to self-manage) | $15 | $180 |
| **Backups** (automated snapshots) | ~$2-3 | ~$24-36 |
| **Domain + SSL** (Let's Encrypt, free) | $0 | $0 |
| **Google OAuth** | $0 | $0 |
| **Total (self-managed DB)** | **~$14-15** | **~$168-180** |
| **Total (managed DB)** | **~$29-30** | **~$348-360** |

Cheapest option if you run PostgreSQL on the same VPS. More maintenance overhead.

### Cost Comparison Summary

| Platform | Monthly Est. | Annual Est. | Maintenance |
|----------|-------------|-------------|-------------|
| **Railway** | $30-40 | $350-480 | Low (push-to-deploy, managed DB) |
| **Render** | $14-17 | $170-200 | Low (fixed instances, managed DB) |
| **VPS (self-managed DB)** | $14-15 | $170-180 | High (you manage everything) |
| **VPS (managed DB)** | $29-30 | $350-360 | Medium (managed DB, you manage server) |

### What's Free

- **Google OAuth / Microsoft OAuth** — free for authentication (no per-user fees)
- **SSL certificates** — free via Let's Encrypt (auto-managed on all platforms above)
- **2FA** — free, handled by the OAuth provider
- **Domain** — UWRF likely already owns a domain; a subdomain costs nothing

### Scaling Notes

These estimates assume 10 departments with ~30-50 total users. This is well within the capacity of the smallest tier on any platform. You'd only need to scale up if:
- The app sees significant concurrent usage during registration periods
- You add heavy features (real-time collaboration, large file uploads)
- You expand beyond UWRF to other universities

At 10 departments, **the cheapest viable option is ~$170/year (Render)** and the most comfortable option is **~$400/year (Railway Pro)**.

### Render vs Railway Pro

| Factor | Render | Railway Pro |
|--------|--------|-------------|
| **Cost** | ~$170-200/yr | ~$350-480/yr |
| **Pricing model** | Fixed monthly per instance | Usage-based (billed per second of CPU/memory) |
| **PostgreSQL** | Managed, starts at $7/mo (Starter: 512MB, 0.5 vCPU, 1GB storage) | Managed, usage-based (near-zero storage cost, CPU/memory metered) |
| **Deploy model** | Git push auto-deploy | Git push auto-deploy |
| **SSL** | Free, automatic | Free, automatic |
| **Cold starts** | Free tier sleeps after 15min; paid tier stays warm | No sleep on Pro plan |
| **Dashboard/DX** | Clean, simple UI; good docs | Polished UI; real-time logs; service graphs |
| **Scaling** | Manual tier upgrades ($7 -> $25 -> $85) | Automatic — just uses more CPU/memory, billed accordingly |
| **DB backups** | Daily automatic backups on paid plans; point-in-time recovery being added | Manual snapshots; less built-in backup tooling |
| **Community/support** | Community forum + email support | Active Discord + email support |

**Render Pros:**
- Half the cost (~$170/yr vs ~$400/yr) for a low-traffic app
- Predictable monthly bill — no surprises from usage spikes
- Simple mental model: pick an instance size, pay that amount
- Good documentation, especially for Python/FastAPI deployments
- Database backups included on paid plans

**Render Cons:**
- Fixed instance sizes mean you pay the same whether idle or busy
- Jumping from Starter ($7) to Standard ($25) is a 3.5x price increase if you outgrow the smallest tier
- Starter instances are modest (512MB RAM) — fine for 50 users but leaves less headroom
- Less granular observability compared to Railway

**Railway Pro Pros:**
- Pay only for what you use — idle hours cost near-zero
- No cold starts on Pro plan
- Scales smoothly without manual tier changes — if registration week spikes traffic, it just handles it
- Better real-time observability (logs, metrics, resource graphs)
- Active community on Discord for troubleshooting
- More flexible if you later add services (Redis, cron workers, etc.)

**Railway Pro Cons:**
- ~2x the cost of Render for steady-state usage
- Usage-based billing means the monthly bill can vary
- $20/mo base subscription even during months with minimal usage
- Database backup tooling is less mature than Render's

**Recommendation: Render** for this use case. Here's why:

1. **Cost matters for a university department tool.** $170/yr vs $400/yr is meaningful when you're justifying budget to a college. Render is the easier sell.
2. **Traffic is predictable.** A scheduling app used by ~50 department chairs/editors won't have dramatic usage spikes. The Starter tier (512MB / 0.5 vCPU) is comfortably sized for this workload.
3. **Predictable billing.** Fixed monthly costs are easier to budget for in an academic environment than variable usage-based billing.
4. **Built-in DB backups.** Automatic daily backups on paid Postgres plans — one less thing to configure.

Railway Pro becomes the better choice if: you later expand to many universities (need elastic scaling), add real-time features, or want to run multiple background services. But for 10 departments at one university, Render is the right fit.

---

## Summary: Effort Estimate

| Area | Work Involved | Complexity |
|------|--------------|------------|
| **Parameterize backend for web** | Update host/port, CORS, remove hardcoded localhost | Low |
| **Switch to PostgreSQL** | Update database.py, alembic config, remove SQLite-specific code | Medium |
| **Add authentication** | OAuth2 integration, JWT session management, protect all endpoints | Medium-High |
| **Add multi-tenancy** | Schema-per-department or department_id scoping on all queries | Medium-High |
| **Rework file operations** | Replace local file exports with browser downloads, remove directory browsing | Low-Medium |
| **Deploy infrastructure** | Server/platform setup, CI/CD, DNS, SSL | Medium |
| **Frontend updates** | Remove Electron-specific code paths, update API client | Low |

This is a meaningful project — likely 2-4 weeks of focused work depending on the auth and multi-tenancy choices. The backend architecture is solid and doesn't need a rewrite; it's mostly about adding layers (auth, tenancy) and swapping infrastructure (SQLite -> PostgreSQL, local -> hosted).

---

## Next Steps

1. **Decide on auth approach** — OAuth2 (Google vs Microsoft) is the biggest architectural decision and affects everything else.
2. **Pick a hosting platform** — Railway or Render are the top candidates; spin up a test deployment.
3. **Prototype the database migration** — try running the existing models against PostgreSQL to identify any compatibility issues.
