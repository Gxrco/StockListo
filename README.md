# StockListo

Sistema de gestión de inventarios transaccional — FastAPI + React + PostgreSQL + Redis.

## Quick start (development)

```bash
# 1. Clone
git clone <repo-url> && cd StockListo

# 2. Configure environment
cp infra/.env.example infra/.env
# Edit infra/.env — change JWT_SECRET and BOOTSTRAP_ADMIN_PASSWORD at minimum

# 3. Build frontend (required for the nginx web container)
cd frontend && npm install && npm run build && cd ..

# 4. Start all services, rebuilding backend/worker/beat images from source
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build

# 5. Wait ~15 s for migrations, then open http://localhost
```

When frontend files change, run `cd frontend && npm run build` again because the
development compose serves the host `frontend/dist` directory through Nginx.
When backend files change, restart with `up -d --build` so Docker copies the
latest Python code into the image.

## Quick start (production — builds everything from source)

```bash
cp infra/.env.example infra/.env
# Edit infra/.env — set strong POSTGRES_PASSWORD, JWT_SECRET, BOOTSTRAP_ADMIN_PASSWORD

docker compose -f infra/docker-compose.prod.yml --env-file infra/.env up -d --build
```

## Default credentials

| Email | Password |
|---|---|
| admin@stocklisto.dev | Admin1234! |

Change the password via the Usuarios page immediately after first login.

## Key features

- **Kardex por producto** — historial de transacciones con saldo acumulado calculado via ventana SQL
- **Ingreso diferido por lote** — múltiples facturas/fechas de vencimiento por producto, cuantificación en cajas y unidades
- **Despacho con carrito** — reserva optimista con bloqueo Redis (TTL 15 min), checkout atómico
- **Alertas automáticas** — stock mínimo y vencimientos evaluados por Celery Beat cada 5 min
- **Reportes con CSV** — stock, movimientos (con rango de fechas), vencimientos, valorización
- **RBAC** — roles ADMIN / OPERATOR / VIEWER con rutas protegidas

## Stack

| Layer | Technology |
|---|---|
| API | FastAPI 0.115 + SQLAlchemy 2.0 async |
| DB | PostgreSQL 16 (pg_trgm, UUID, window functions) |
| Cache / Locks | Redis 7 |
| Background | Celery 5 + Beat |
| Frontend | React 18 + Vite + Tailwind CSS 4 |
| UI | Radix UI primitives, Recharts |

## Development (hot reload)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
DATABASE_URL=postgresql+asyncpg://stocklisto:stocklisto@localhost:5432/stocklisto \
REDIS_URL=redis://localhost:6379/0 \
JWT_SECRET=dev-secret \
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev   # Vite proxy → localhost:8000
```

## Architecture

```
backend/
  app/
    api/v1/routers/   # HTTP layer — validation + serialization only
    services/         # Business logic, Unit of Work transactions
    repositories/     # SQLAlchemy async queries
    models/           # ORM mapped classes (append-only Kardex)
    db/               # Async session + Unit of Work context manager
    core/             # Config, JWT security, RFC 7807 problem details
    tasks/            # Celery: low_stock, expiring_lots
  alembic/            # Versioned migrations (0001 schema, 0002 seed)
frontend/
  src/
    pages/            # Route-level components (Dashboard, Kardex, ...)
    components/       # Shared UI — ingress wizard, dispatch cart, Modal, Toast
    stores/           # Zustand: auth (localStorage), cart (sessionStorage), alerts
    lib/              # Typed API client (auto-refresh on 401), formatters
infra/
  docker-compose.yml       # Dev: nginx mounts pre-built frontend/dist
  docker-compose.prod.yml  # Prod: builds frontend + backend images from source
  nginx/default.conf       # SPA catch-all + /api proxy
  init.sql                 # pg_trgm + uuid-ossp extensions
```
