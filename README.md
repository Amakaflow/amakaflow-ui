# AmakaFlow Database

This repository is the **single source of truth** for all database schema, migrations, and edge functions for the AmakaFlow platform.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        amakaflow-db (this repo)                     │
│                                                                     │
│  • Schema definitions                                               │
│  • Migrations                                                       │
│  • Edge functions                                                   │
│  • Seed data                                                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                          Supabase Database
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│   Web App     │          │  Mapper API   │          │   iOS App     │
│   (React)     │          │   (Python)    │          │   (Swift)     │
│               │          │               │          │               │
│ Read/Write DB │          │ Read/Write DB │          │ Read/Write DB │
│ No migrations │          │ No migrations │          │ No migrations │
└───────────────┘          └───────────────┘          └───────────────┘
```

## Quick Start

### Prerequisites

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
npx supabase login
```

### Link to Project (One-time)

```bash
npx supabase link --project-ref wdeqaibnwjekcyfpuple
```

### Apply Migrations

```bash
# Check what will be applied
npx supabase db diff

# Apply to production
npx supabase db push
```

## Repository Structure

```
amakaflow-db/
├── supabase/
│   ├── config.toml              # Supabase project configuration
│   ├── migrations/              # SQL migration files
│   │   ├── 001_create_profiles_table.sql
│   │   ├── 20250120000001_create_linked_accounts_table.sql
│   │   ├── 20250120000002_create_workouts_table.sql
│   │   ├── 20250122000000_create_follow_along_workouts.sql
│   │   └── 20250130000000_add_ios_companion_sync.sql
│   └── functions/               # Supabase Edge Functions
│       └── delete-user-account/
├── scripts/
│   └── seed.sql                 # Development seed data
├── docs/
│   ├── SCHEMA.md               # Schema documentation
│   └── DEPLOYMENT.md           # Deployment procedures
└── README.md
```

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `profiles` | User profiles (linked to Clerk auth) |
| `linked_accounts` | OAuth connections (Strava, Garmin, etc.) |
| `workouts` | Standard workouts created via workflow |
| `follow_along_workouts` | Video-based workouts from Instagram/YouTube |
| `follow_along_steps` | Individual steps within follow-along workouts |

### Entity Relationship

```
profiles
    │
    ├── 1:N ── linked_accounts
    │
    ├── 1:N ── workouts
    │
    └── 1:N ── follow_along_workouts
                    │
                    └── 1:N ── follow_along_steps
```

## Commands

### Migrations

```bash
# Create a new migration
npx supabase migration new feature_name
# Creates: supabase/migrations/YYYYMMDDHHMMSS_feature_name.sql

# Apply migrations to remote database
npx supabase db push

# Check migration status / see diff
npx supabase db diff

# Reset local database (development only)
npx supabase db reset
```

### Edge Functions

```bash
# Deploy all functions
npx supabase functions deploy

# Deploy specific function
npx supabase functions deploy delete-user-account

# Test function locally
npx supabase functions serve delete-user-account
```

### Local Development

```bash
# Start local Supabase (Docker required)
npx supabase start

# Stop local Supabase
npx supabase stop

# View local database
npx supabase studio
```

## Migration Guidelines

### Naming Convention

```
YYYYMMDDHHMMSS_description.sql
```

Examples:
- `20250130000000_add_ios_companion_sync.sql`
- `20250201120000_create_notifications_table.sql`

### Best Practices

**DO:**
```sql
-- Use IF NOT EXISTS for idempotency
CREATE TABLE IF NOT EXISTS my_table (...);
ALTER TABLE my_table ADD COLUMN IF NOT EXISTS new_col TEXT;

-- Always add indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_my_table_user_id ON my_table(user_id);

-- Enable RLS on new tables
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view own data" ON my_table
    FOR SELECT USING (auth.uid()::text = user_id);
```

**DON'T:**
```sql
-- Avoid destructive operations without careful planning
DROP TABLE my_table;           -- ⚠️ Data loss!
DROP COLUMN important_data;    -- ⚠️ Data loss!

-- Avoid non-idempotent operations
CREATE TABLE my_table (...);   -- ❌ Fails if exists
ALTER TABLE ADD COLUMN col;    -- ❌ Fails if exists
```

## Deployment Process

### For Schema Changes

1. Create migration in this repo:
   ```bash
   npx supabase migration new your_feature
   ```

2. Edit the generated SQL file

3. Test locally:
   ```bash
   npx supabase db reset  # Applies all migrations fresh
   ```

4. Commit and push:
   ```bash
   git add .
   git commit -m "Add your_feature migration"
   git push
   ```

5. Apply to production:
   ```bash
   npx supabase db push
   ```

6. Deploy dependent services (mapper-api, web-app, iOS) that use the new schema

### Deployment Order

```
1. amakaflow-db      ─→ npx supabase db push
2. mapper-api        ─→ Deploy new API version
3. web-app           ─→ Deploy new frontend
4. iOS app           ─→ Submit to App Store (if needed)
```

## Environment Setup for Other Repos

### Mapper API (.env)

```env
SUPABASE_URL=https://wdeqaibnwjekcyfpuple.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Web App (.env)

```env
VITE_SUPABASE_URL=https://wdeqaibnwjekcyfpuple.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### iOS App (Config.xcconfig)

```
SUPABASE_URL = https://wdeqaibnwjekcyfpuple.supabase.co
SUPABASE_ANON_KEY = eyJ...
```

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/migrate.yml
name: Database Migration

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      
      - run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

## Troubleshooting

### "Migration already applied"
The migration has already run. This is fine - Supabase tracks applied migrations.

### "Relation already exists"
Use `IF NOT EXISTS` in your CREATE statements to make migrations idempotent.

### "Permission denied"
Check that you're using the correct Supabase access token and have admin permissions.

### Local Supabase won't start
```bash
# Reset Docker containers
npx supabase stop --no-backup
docker system prune -f
npx supabase start
```

## Related Repositories

| Repo | Purpose | Database Access |
|------|---------|-----------------|
| `amakaflow-db` | Schema & migrations | Owner |
| `mapper-api` | Backend API | Read/Write |
| `workout-content-transformation` | Web frontend | Read/Write |
| `amakaflow-ios` | iOS app | Read/Write |
