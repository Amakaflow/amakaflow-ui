# AmakaFlow Backend

Python backend monorepo for AmakaFlow — consolidates all FastAPI services and database migrations.

## Services

| Service | Port | Description |
|---------|------|-------------|
| `services/chat-api` | 8005 | AI conversation service |
| `services/mapper-api` | 8001 | Exercise mapping service |
| `services/calendar-api` | 8003 | Calendar integration service |
| `services/workout-ingestor-api` | 8004 | Video/OCR ingestion service |
| `services/strava-sync-api` | — | Strava sync service |
| `services/garmin-sync-api` | — | Garmin sync service |

## Packages

| Package | Description |
|---------|-------------|
| `packages/shared` | Shared Pydantic models, enums, utilities |

## Database

Supabase migrations live in `db/` (migrated from `amakaflow-db`).

## Development

```bash
# Start all services
docker compose up

# Start specific service
docker compose up chat mapper

# Run tests for a service
cd services/chat-api && pytest
```

## Deployment

Each service is deployed independently on Render with `Root Directory` set to `services/{name}`.

## Previous repos (archived)

- `Amakaflow/chat-api`
- `Amakaflow/mapper-api`
- `Amakaflow/calendar-api`
- `Amakaflow/workout-ingestor-api`
- `Amakaflow/strava-sync-api`
- `Amakaflow/garmin-sync-api`
- `Amakaflow/amakaflow-db`
