# packages/shared

Shared Python code used across multiple services.

## What belongs here

- Pydantic models shared between services (e.g. `WorkoutDTO` consumed by both chat-api and mapper-api)
- Common enums and constants
- Shared database utilities (Supabase client setup)
- Auth helpers (JWT verification, test auth bypass)
- Shared config base classes

## What does NOT belong here

- Service-specific business logic
- API route handlers
- Service-specific models

## Usage

Each service installs this as a local package:

```
# services/chat-api/requirements.txt
../../packages/shared
```

Or with pip editable install in development:

```bash
pip install -e ../../packages/shared
```

## Structure (to be built out)

```
shared/
├── pyproject.toml
├── amakaflow_shared/
│   ├── __init__.py
│   ├── models/          ← shared Pydantic models
│   ├── auth/            ← JWT + test auth helpers
│   ├── db/              ← Supabase client setup
│   └── config.py        ← base settings class
```
