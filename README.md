# DakhalNama — Deed & Property Entry Desk

A standalone citizen deed/property-registration data-entry portal, built as an
original application (own brand, models, and UI) — **not** a clone of any
existing government site. It is inspired by the general workflow shown in the
reference screenshots (login → dashboard of modules → draw a token → fill in
presentation/deed details → stamp duty estimate), reimplemented from scratch
with its own design system, data model, and codebase.

Stack:
- **Frontend:** React 18 + Vite, react-router-dom, axios
- **Backend:** FastAPI + SQLAlchemy + JWT auth
- **Database:** PostgreSQL

## Project layout

```
PDE/
├── pde-backend/         FastAPI app
│   ├── app/
│   │   ├── main.py         app entrypoint, CORS + security/CSRF middleware
│   │   ├── config.py       env-driven settings (CORS, CSRF, DEBUG, rate limits)
│   │   ├── middleware.py   SecurityHeaders + CSRF double-submit protection
│   │   ├── ratelimit.py    in-memory per-IP rate limiter for auth
│   │   ├── database.py     SQLAlchemy engine/session
│   │   ├── models.py       User, EntryToken, DocumentEntry, District, ...
│   │   ├── schemas.py      Pydantic request/response models
│   │   ├── security.py     password hashing + JWT
│   │   ├── seed.py         seeds districts/offices/article types
│   │   └── routers/        auth(CSRF+login+register), tokens, documents, ...
│   ├── requirements.txt
│   ├── .env.example        documents every env var (§2/§6)
│   └── Dockerfile
├── pde-frontend/        React + Vite app
│   └── src/
│       ├── pages/          Login, Register, Dashboard, TokenInformation, DocumentEntry
│       ├── components/     HeaderTeal, HeaderSarita, ProtectedRoute, common/LanguageSwitcher
│       ├── api/axios.js    API client: JWT + ensureCsrfToken() + 401/403 handling
│       └── i18n/           i18next setup (index.js) + locales/{en,mr}/ namespaces
├── deploy/              deploy.sh + pde-api.service (systemd)
├── SECURITY.md          how security conventions are implemented
├── DEPLOYMENT.md        production deployment + troubleshooting guide
├── docker-compose.yml   Postgres + backend + frontend, one command
└── README.md
```

## Quick start (Docker — recommended)

```bash
docker compose up --build
```
- API: http://localhost:8000 (docs at /docs)
- Frontend: http://localhost:5173
- Postgres: localhost:5432 (db `dakhalnama`, user `dakhal_user`, pass `dakhal_pass`)

Then seed reference data (districts / offices / article types) once the DB is up:
```bash
docker compose exec backend python -m app.seed
```

## Quick start (manual)

### 1. PostgreSQL
Create a database and user matching `backend/.env.example`, or edit the values:
```sql
CREATE USER dakhal_user WITH PASSWORD 'dakhal_pass';
CREATE DATABASE dakhalnama OWNER dakhal_user;
```

### 2. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                # adjust DATABASE_URL / SECRET_KEY
python -m app.seed                                  # optional but recommended
uvicorn app.main:app --reload
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env                                # VITE_API_BASE_URL
npm run dev
```

Visit http://localhost:5173, register a new account, then log in.

## API overview

| Method | Path                              | Purpose                          |
|--------|------------------------------------|-----------------------------------|
| GET    | /api/auth/check-username           | Username availability             |
| POST   | /api/auth/register                 | Create account                    |
| POST   | /api/auth/login                    | Log in, returns JWT               |
| GET    | /api/auth/me                       | Current user                      |
| GET    | /api/reference/districts           | List districts                    |
| GET    | /api/reference/offices             | List offices (optional filter)    |
| GET    | /api/reference/article-types       | List deed article types           |
| POST   | /api/tokens                        | Draw a new entry token            |
| GET    | /api/tokens                        | List/filter your tokens           |
| POST   | /api/documents/calculate-stamp-duty| Estimate stamp duty                |
| POST   | /api/documents                     | Save a deed presentation entry    |
| GET    | /api/documents                     | List your entries                 |

All `/api/tokens` and `/api/documents` routes require `Authorization: Bearer <token>`.

## Notes

- The stamp-duty calculation is a simplified, illustrative flat rate for demo
  purposes only — it is **not** the official Maharashtra stamp duty schedule.
  Replace `STAMP_DUTY_RATE_PERCENT` in `backend/app/routers/documents.py` with
  the correct, verified slab rates before any real use.
- JWT `SECRET_KEY` in `.env.example` / `docker-compose.yml` is a placeholder —
  change it before deploying anywhere reachable.
