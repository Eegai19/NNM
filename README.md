# NNM — Nokia Node Manager

An operations portal for tracking network node deployments: the nodes
themselves, the activities performed on each one, the engineers who own them,
and an audit trail of everything that happened.

- **Backend** — FastAPI, SQLAlchemy 2.0, JWT auth, SQLite (PostgreSQL-ready)
- **Frontend** — React 18, Vite, TypeScript, TailwindCSS, Radix/shadcn-style UI,
  React Router, Axios, Recharts, Lucide icons

---

## Table of contents

- [Quick start](#quick-start)
- [Backend setup](#backend-setup)
- [Frontend setup](#frontend-setup)
- [Environment variables](#environment-variables)
- [Domain model](#domain-model)
- [Permission matrix](#permission-matrix)
- [Business rules](#business-rules)
- [API reference](#api-reference)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Moving to PostgreSQL](#moving-to-postgresql)
- [Troubleshooting](#troubleshooting)

---

## Quick start

Two terminals, about two minutes.

```bash
# --- Terminal 1: backend -------------------------------------------------
cd backend
python3 -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # optional but recommended
python -m scripts.seed --demo                          # schema + master data + demo nodes
uvicorn app.main:app --reload

# --- Terminal 2: frontend ------------------------------------------------
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173> and sign in.

| Account | Username | Password | Role |
|---|---|---|---|
| Bootstrap admin | `admin` | `Admin@123` | TPM |
| Demo lead | `priya.lead` | `Nokia@123` | LEAD |
| Demo engineer | `eegai` | `Nokia@123` | ENGINEER |

> The demo accounts exist only when you seed with `--demo`. **Change
> `admin`'s password immediately in any real deployment** — the value comes from
> `NNM_FIRST_TPM_PASSWORD` and is intended for first login only.

Interactive API docs: <http://localhost:8000/docs>

---

## Backend setup

**Requirements:** Python 3.11+

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Configuration

Copy `.env.example` to `.env` and edit it. Every setting can also be supplied as
an environment variable with the `NNM_` prefix. Sensible defaults let the app
start with no `.env` at all.

### Database

The schema is created automatically on first start. The seed script also loads
reference data and the bootstrap TPM:

```bash
python -m scripts.seed            # schema + products, circles, activities + admin
python -m scripts.seed --demo     # ...plus 8 demo users, 40 nodes, ~180 activities
python -m scripts.seed --reset    # DROP every table first (asks for confirmation)
```

Seeding is idempotent — re-running it will not duplicate master data.

### Running

```bash
uvicorn app.main:app --reload                 # development, port 8000
uvicorn app.main:app --host 0.0.0.0 --port 8000   # bind for a LAN/container
```

| URL | What |
|---|---|
| `/docs` | Swagger UI |
| `/redoc` | ReDoc |
| `/openapi.json` | OpenAPI schema |
| `/health` | Liveness probe |

---

## Frontend setup

**Requirements:** Node.js 20+

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

The dev server proxies `/api` to `http://127.0.0.1:8000`, so the browser never
hits CORS locally. Point it elsewhere with `VITE_PROXY_TARGET`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript only, no emit |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit + component suites |
| `npm run test:watch` | Vitest in watch mode |
| `npm run e2e` | Browser smoke tests (needs both servers running) |

---

## Environment variables

### Backend (`backend/.env`, prefix `NNM_`)

| Variable | Default | Purpose |
|---|---|---|
| `NNM_PROJECT_NAME` | `NNM - Nokia Node Manager` | Title in the API docs |
| `NNM_ENVIRONMENT` | `development` | Free-form environment label |
| `NNM_DEBUG` | `true` | Verbose logging |
| `NNM_SECRET_KEY` | insecure dev value | **JWT signing key — must be changed in production** |
| `NNM_ALGORITHM` | `HS256` | JWT algorithm |
| `NNM_ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | Token lifetime without "remember me" |
| `NNM_DATABASE_URL` | `sqlite:///./nnm.db` | SQLAlchemy URL |
| `NNM_STORAGE_DIR` | `./storage/activity_logs` | Where uploaded files are written |
| `NNM_MAX_UPLOAD_SIZE_MB` | `25` | Per-file upload cap |
| `NNM_CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed origins |
| `NNM_FIRST_TPM_USERNAME` | `admin` | Bootstrap account (seed script) |
| `NNM_FIRST_TPM_PASSWORD` | `Admin@123` | Bootstrap password (seed script) |
| `NNM_FIRST_TPM_NAME` | `System Administrator` | Bootstrap display name |
| `NNM_FIRST_TPM_MOBILE` | `9000000000` | Bootstrap mobile number |

Generate a production secret with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

### Frontend (`frontend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Base URL the browser calls |
| `VITE_PROXY_TARGET` | `http://127.0.0.1:8000` | Dev-server proxy target |

Set `VITE_API_BASE_URL` to an absolute URL (e.g. `https://nnm.example.com/api`)
when the frontend is served from a different origin than the API.

---

## Domain model

```
User ────────┬─< NodeAssignment >──┬──── Node ──┬──< NodeActivity >──── ActivityMaster
             │                     │            │          │
             └─ owner / lead / tpm ┘            │          └──< ActivityLog (files)
                                                │
                                      Product ──┴── Circle

AuditTrail — append-only, references any entity and optionally a node
```

| Entity | Notes |
|---|---|
| `User` | `name`, `username`, `password_hash`, `mobile_number`, `role`, `is_active` |
| `Product` / `Circle` | Master data; deactivate rather than delete once in use |
| `Node` | Unique `node_name`, a product, a circle, owner/lead/tpm, `deployment_state`, `overall_status` |
| `ActivityMaster` | The catalogue of activities a node can have |
| `NodeActivity` | A catalogue activity attached to a node, with status, dates, remarks |
| `NodeAssignment` | Links a user to a node with `PRIMARY_OWNER` / `SECONDARY_OWNER` / `SUPPORT_ENGINEER` |
| `ActivityLog` | An evidence file attached to a node activity |
| `AuditTrail` | Who did what, when, with a before/after diff |

**Enumerations**

- `deployment_state`: `PLANNED`, `IN_PROGRESS`, `INTEGRATION`, `ACCEPTANCE`, `LIVE`, `ON_HOLD`, `CANCELLED`
- `overall_status`: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `BLOCKED`
- activity `status`: `Pending`, `In Progress`, `Completed`

---

## Permission matrix

| Capability | TPM | LEAD | ENGINEER |
|---|:--:|:--:|:--:|
| Create / edit users | ✅ | ❌ | ❌ |
| Activate / deactivate users | ✅ | ❌ | ❌ |
| Reset passwords | ✅ | ❌ | ❌ |
| Delete users | ✅ | ❌ | ❌ |
| Create nodes | ✅ | ✅ | ❌ |
| Edit nodes | ✅ | ✅ | only when assigned |
| Delete nodes | ✅ | ❌ | ❌ |
| Assign engineers | ✅ | ✅ | ❌ |
| Create / edit catalogue activities | ✅ | ✅ | ❌ |
| Delete catalogue activities | ✅ | ❌ | ❌ |
| Add / edit node activities | ✅ | ✅ | only when assigned |
| Upload / delete activity logs | ✅ | ✅ | only when assigned |
| View dashboard, nodes, activities | ✅ | ✅ | ✅ |
| View / export reports | ✅ | ✅ | ✅ |
| View audit trail | ✅ | ✅ | ❌ |

**"Only when assigned"** means a `NodeAssignment` row links the engineer to that
node as `PRIMARY_OWNER`, `SECONDARY_OWNER` or `SUPPORT_ENGINEER`. Everywhere
else an engineer is read-only.

The rule lives in one place — `backend/app/core/permissions.py`:

```python
can_modify_node(db, user, node_id) -> bool      # TPM/LEAD always; engineers if assigned
require_node_modify_access(db, user, node_id)   # the same check, raising 403
```

The UI mirrors it: `GET /api/nodes/{id}/can-modify` tells the frontend whether
to render write controls, so an engineer sees a **Read only** badge instead of
buttons that would fail. The server enforces it regardless of what the UI shows.

---

## Business rules

**An activity cannot be completed without evidence.** `PUT /api/activities/{id}`
with `status: "Completed"` returns `422` unless at least one `ActivityLog` file
has been uploaded against it. The same guard blocks creating an activity
directly in the `Completed` state, and prevents deleting the *last* log of an
already-completed activity.

**A node's `overall_status` is derived** from its activities — no activities →
`NOT_STARTED`, all completed → `COMPLETED`, otherwise `IN_PROGRESS`. Setting a
node to `BLOCKED` pins it there until you change it back.

**Duplicates are rejected** at both the service layer and with database
constraints:

- duplicate node names (case-insensitive) → `409`
- the same user assigned twice to one node → `409`
- a second `PRIMARY_OWNER` or `SECONDARY_OWNER` on one node → `409`
- the same catalogue activity attached twice to one node → `409`

**Uploads are validated** for extension (`pdf`, `zip`, `txt`, `xlsx`, `csv`,
`png`, `jpg`, `jpeg`), size (default 25 MB), and emptiness. File names are
sanitised and stored under a random prefix, so path traversal and collisions are
both impossible.

**Everything mutating is audited** — node creation and edits, engineer
assignment, activity status changes, log uploads and deletions, user
administration and sign-ins. `GET /api/nodes/{id}/timeline` renders as the node
timeline in the UI.

---

## API reference

All routes are prefixed with `/api` and require `Authorization: Bearer <token>`
except `POST /api/auth/login`.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{username, password, remember_me}` → token + user |
| GET | `/auth/me` | Current user |
| POST | `/auth/change-password` | Change your own password |

### Dashboard
| Method | Path | Returns |
|---|---|---|
| GET | `/dashboard/summary` | `total_nodes`, `pending_activities`, `in_progress_activities`, `completed_activities` (+ totals and completion rate) |
| GET | `/dashboard/circle-summary` | `[{circle, count}]` |
| GET | `/dashboard/engineer-workload` | `[{engineer, assigned_nodes, activities}]` |
| GET | `/dashboard/status-breakdown` | `[{status, count}]` |

### Nodes
| Method | Path | Access |
|---|---|---|
| GET | `/nodes` | all — filter by `search`, `circle_id`, `product_id`, `deployment_state`, `overall_status`, `assigned_user_id`, `mine`; paginated |
| POST | `/nodes` | TPM, LEAD |
| GET | `/nodes/{id}` | all |
| GET | `/nodes/{id}/can-modify` | all |
| PUT | `/nodes/{id}` | TPM, LEAD, assigned engineers |
| DELETE | `/nodes/{id}` | TPM |
| GET | `/nodes/{id}/timeline` | all |

### Assignments
| Method | Path | Access |
|---|---|---|
| GET | `/nodes/{id}/assignments` | all |
| POST | `/nodes/{id}/assignments` | TPM, LEAD |
| PUT | `/nodes/{id}/assignments/{aid}` | TPM, LEAD |
| DELETE | `/nodes/{id}/assignments/{aid}` | TPM, LEAD |

### Activities and logs
| Method | Path | Access |
|---|---|---|
| GET | `/activities` | all — filter by `search`, `node_id`, `status`, `assigned_to`, `circle_id`, `product_id`, `mine`; paginated |
| GET | `/nodes/{id}/activities` | all |
| POST | `/nodes/{id}/activities` | node-modify access |
| GET | `/activities/{id}` | all |
| PUT | `/activities/{id}` | node-modify access |
| DELETE | `/activities/{id}` | node-modify access |
| GET | `/activities/{id}/logs` | all |
| POST | `/activities/{id}/logs` | node-modify access (multipart `file`) |
| GET | `/activity-logs/{id}/download` | all |
| DELETE | `/activity-logs/{id}` | node-modify access |

### Users and master data
| Method | Path | Access |
|---|---|---|
| GET | `/users`, `/users/{id}`, `/users/assignable` | all |
| POST / PUT / DELETE | `/users`, `/users/{id}` | TPM |
| PATCH | `/users/{id}/status?is_active=` | TPM |
| POST | `/users/{id}/reset-password` | TPM |
| GET | `/products`, `/circles`, `/activity-masters` | all |
| POST / PUT | same paths | TPM, LEAD |
| DELETE | same paths | TPM |

### Search, audit, exports
| Method | Path | Access |
|---|---|---|
| GET | `/search?q=&page=&page_size=` | all — nodes, activities, engineers, circles, products, each paginated |
| GET | `/audit` | TPM, LEAD — filter by entity, action, node, actor |
| GET | `/exports/nodes.xlsx` | all — accepts the same filters as `/nodes`, so an export matches the table on screen |
| GET | `/exports/activities.xlsx` | all — accepts the same filters as `/activities` |

---

## Testing

### Backend — 108 tests

```bash
cd backend
pytest                      # whole suite
pytest tests/test_permissions.py -v
pytest --tb=short -q
```

Each test gets an isolated in-memory database and its own upload directory.
Coverage spans auth and JWT expiry, the full permission matrix, node and
activity workflows, the completion rule, uploads and downloads, dashboard
aggregations, search, Excel exports and the audit trail.

### Frontend — 37 tests

```bash
cd frontend
npm test                    # Vitest, jsdom
npm run test:watch
```

Unit tests cover the formatting and validation helpers; component tests cover
the login form, buttons, badges, pagination, the role gate, the confirm dialog
and the error boundary. Network calls are blocked in the test setup, so an
unmocked request fails loudly instead of reaching out.

### Browser smoke tests

```bash
# with both servers running and the database seeded with --demo
cd frontend && npm run e2e
```

Drives a real browser through every page, both themes, the 390px mobile layout,
the activity-completion rule and the engineer read-only rule. See
[`frontend/e2e/README.md`](frontend/e2e/README.md).

---

## Project structure

```
NNM/
├── README.md
├── .gitignore
├── backend/
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── .env.example
│   ├── app/
│   │   ├── main.py             # app factory, CORS, exception handlers
│   │   ├── core/               # config, database, security, deps, permissions
│   │   ├── models/             # SQLAlchemy ORM models and enums
│   │   ├── schemas/            # Pydantic request/response models
│   │   ├── crud/               # database access
│   │   ├── services/           # audit, storage, activity rules, dashboard, search, exports
│   │   ├── routers/            # HTTP endpoints
│   │   └── utils/              # error helpers, cross-entity validators
│   ├── scripts/seed.py         # schema + master data + optional demo data
│   ├── storage/activity_logs/  # uploaded files (gitignored)
│   └── tests/                  # pytest suite
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── eslint.config.js
    ├── .env.example
    ├── e2e/                    # browser smoke tests
    └── src/
        ├── main.tsx
        ├── App.tsx             # routing, providers, role-based guards
        ├── index.css           # design tokens, light + dark themes
        ├── components/
        │   ├── ui/             # Button, Input, Dialog, Select, Table, Toast, …
        │   ├── common/         # PageHeader, Pagination, EmptyState, ErrorBoundary, …
        │   └── charts/         # Recharts wrappers and the chart theme
        ├── layouts/            # AppLayout, Sidebar, Topbar, navigation
        ├── pages/              # Login, Dashboard, Nodes, Activities, Assignments,
        │                       #   Reports, Users, Master Data, error pages
        ├── contexts/           # AuthContext, ThemeContext
        ├── hooks/              # useAsync, useDebounce, useToast, useDocumentTitle
        ├── services/           # Axios client + one module per API area
        ├── types/              # TypeScript mirrors of the API schemas
        └── utils/              # cn, formatting, validation, constants
```

---

## Deployment

### 1. Build the frontend

```bash
cd frontend
VITE_API_BASE_URL=/api npm run build      # outputs dist/
```

Serve `dist/` from any static host or CDN. It is a single-page app, so the
server must fall back to `index.html` for unknown paths:

```nginx
server {
    listen 80;
    server_name nnm.example.com;

    root /srv/nnm/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;      # SPA fallback
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 30M;              # >= NNM_MAX_UPLOAD_SIZE_MB
    }
}
```

Serving both from one origin like this means you do not need CORS at all.

### 2. Run the backend

```bash
cd backend
pip install -r requirements.txt "uvicorn[standard]" gunicorn
python -m scripts.seed                       # first deploy only

gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers 4 --bind 127.0.0.1:8000
```

As a systemd unit:

```ini
[Unit]
Description=NNM API
After=network.target

[Service]
User=nnm
WorkingDirectory=/srv/nnm/backend
EnvironmentFile=/srv/nnm/backend/.env
ExecStart=/srv/nnm/backend/.venv/bin/gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker --workers 4 --bind 127.0.0.1:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

### Production checklist

- [ ] `NNM_SECRET_KEY` set to a long random value (never the default)
- [ ] `NNM_DEBUG=false`, `NNM_ENVIRONMENT=production`
- [ ] `NNM_CORS_ORIGINS` restricted to your real frontend origin — or unset,
      if you serve both from one origin as above
- [ ] The bootstrap `admin` password changed after first sign-in
- [ ] `NNM_STORAGE_DIR` on persistent, backed-up storage (**not** inside a
      container layer that is recreated on deploy)
- [ ] Reverse proxy `client_max_body_size` at least `NNM_MAX_UPLOAD_SIZE_MB`
- [ ] HTTPS terminated at the proxy
- [ ] Database and `storage/` included in your backup schedule

> Multiple backend workers require a shared database and a shared storage
> directory. SQLite tolerates a single worker; use PostgreSQL and shared
> storage (or object storage) before scaling out.

---

## Moving to PostgreSQL

Nothing in the application code is SQLite-specific — engine options branch on
the URL scheme in `app/core/database.py`, and enums are stored as strings that
both backends handle identically.

```bash
pip install "psycopg[binary]"
export NNM_DATABASE_URL="postgresql+psycopg://nnm:secret@localhost:5432/nnm"
python -m scripts.seed
uvicorn app.main:app
```

Tables are created via `Base.metadata.create_all()`. For a long-lived
production database, add Alembic so schema changes are versioned:

```bash
pip install alembic
alembic init migrations
# point sqlalchemy.url at NNM_DATABASE_URL and target_metadata at app.core.database.Base.metadata
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

---

## Troubleshooting

**`401` on every request right after signing in.** The JWT is signed with
`NNM_SECRET_KEY`; restarting the backend with a different key invalidates every
existing token. Sign in again, and pin the key in `.env`.

**Frontend shows "Cannot reach the server".** The backend is not running on the
proxy target, or `VITE_PROXY_TARGET` points elsewhere. Check
<http://localhost:8000/health>.

**Uploads fail with `413`.** The file exceeds `NNM_MAX_UPLOAD_SIZE_MB`, or your
reverse proxy's `client_max_body_size` is lower than the app's limit.

**"An activity cannot be marked as Completed…"** — this is the completion rule
working as designed. Upload an activity log first.

**Cannot delete a product, circle or catalogue activity.** It is still
referenced by a node. Deactivate it instead: it disappears from the pickers
while existing records keep working.

**Cannot delete a user.** They still own, lead or are the TPM of a node.
Reassign those nodes, or deactivate the account instead.

**Fonts look different offline.** The UI requests Inter from Google Fonts and
falls back to the system UI font stack when that is unreachable. Self-host Inter
if you need it in an air-gapped network.
