# amakaflow-backend

Python backend monorepo. All FastAPI services + Supabase migrations.

## Structure

```
services/          ← individual FastAPI services
  chat-api/        ← port 8005, AI conversation
  mapper-api/      ← port 8001, exercise mapping
  calendar-api/    ← port 8003, calendar integration
  workout-ingestor-api/ ← port 8004, video/OCR ingestion
  strava-sync-api/ ← Strava sync
  garmin-sync-api/ ← Garmin sync

packages/
  shared/          ← shared Pydantic models, enums, DB utils

db/                ← Supabase migrations (supabase CLI)
```

## Dev workflow

- Default branch: `develop`
- PRs target `develop`
- `develop` → `main` via PR for production releases
- Branch naming: `feat/ama-NNN-description` or `fix/ama-NNN-description`

## Running locally

```bash
docker compose up              # all services
docker compose up chat mapper  # specific services
```

## Testing

Each service has its own test suite. From repo root:
```bash
cd services/chat-api && pytest
cd services/mapper-api && pytest
```

## Environment

Copy `.env.example` → `.env` and fill in secrets. See `amakaflow-dev-workspace` for reference.

## Deployment

Render: each service has `Root Directory` = `services/{name}`.
Build command and start command stay the same as before.
