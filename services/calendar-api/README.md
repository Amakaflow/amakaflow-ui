# Calendar API

Python FastAPI service for managing workout calendar events.

## Overview

This service provides CRUD operations for workout events stored in PostgreSQL (Supabase). It replaces the previous Next.js API routes and is designed to be a standalone microservice.

## Setup

### 1. Create Virtual Environment

```bash
cd calendar-api
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment Variables

Create a `.env` file in the `calendar-api` directory (or use the repo root `.env`):

```bash
# Option 1: Direct PostgreSQL connection string
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.wdeqaibnwjekcyfpuple.supabase.co:5432/postgres

# Option 2: Use Supabase env vars (same pattern as mapper-api)
SUPABASE_URL=https://wdeqaibnwjekcyfpuple.supabase.co
SUPABASE_DB_PASSWORD=[YOUR_DATABASE_PASSWORD]
```

The service will automatically construct `DATABASE_URL` from `SUPABASE_URL` + `SUPABASE_DB_PASSWORD` if `DATABASE_URL` is not set directly.

### 4. Run the Service

```bash
uvicorn app.main:app --reload --port 8003
```

The API will be available at `http://localhost:8003`

## API Endpoints

### Health Check

- **GET** `/healthz` - Returns `{status: "ok"}`

### Calendar Events

- **GET** `/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD` - Get events for date range
- **POST** `/calendar` - Create a new event
- **PUT** `/calendar/{id}` - Update an existing event
- **DELETE** `/calendar/{id}` - Delete an event

All calendar endpoints require the `X-User-Id` header for authentication.

**TODO**: Replace `X-User-Id` header with proper Clerk JWT validation.

## Local Testing

1. Start the calendar-api service:
   ```bash
   cd calendar-api
   source venv/bin/activate
   uvicorn app.main:app --reload --port 8003
   ```

2. Start the UI:
   ```bash
   cd ui
   npm run dev
   ```

3. Set environment variable in `ui/.env.local`:
   ```bash
   VITE_CALENDAR_API_BASE_URL=http://localhost:8003
   ```

4. Open `/calendar` in the UI and test creating/updating/deleting events.

## API Documentation

Once the service is running, visit:
- Swagger UI: `http://localhost:8003/docs`
- ReDoc: `http://localhost:8003/redoc`

## Database Schema

The service uses the `workout_events` table in PostgreSQL:

```sql
CREATE TABLE workout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  source text CHECK (source IN ('runna','gym_class','amaka','instagram','tiktok','manual','garmin')),
  date date NOT NULL,
  start_time time NULL,
  end_time time NULL,
  type text CHECK (type IN ('run','strength','hyrox','class','home_workout','mobility','recovery')),
  json_payload jsonb,
  status text CHECK (status IN ('planned','completed')) DEFAULT 'planned',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## Development

### Project Structure

```
calendar-api/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI app
│   ├── db.py            # Database connection
│   ├── models.py        # Data models
│   ├── schemas.py       # Pydantic schemas
│   └── routes/
│       ├── __init__.py
│       └── calendar.py  # Calendar API routes
├── requirements.txt
└── README.md
```

## TODO

- [ ] Replace `X-User-Id` header authentication with proper Clerk JWT validation
- [ ] Align `DATABASE_URL` env var name with existing Supabase/Postgres configuration
- [ ] Add Docker support (Dockerfile, docker-compose integration)
- [ ] Add comprehensive error handling and logging
- [ ] Add unit tests
- [ ] Add integration tests

