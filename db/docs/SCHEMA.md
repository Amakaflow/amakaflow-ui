# AmakaFlow Database Schema

## Overview

This document describes all tables, columns, and relationships in the AmakaFlow database.

---

## Tables

### profiles

User profiles linked to Clerk authentication.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | TEXT | NO | - | Primary key (Clerk user ID) |
| `email` | TEXT | YES | - | User email |
| `name` | TEXT | YES | - | Display name |
| `avatar_url` | TEXT | YES | - | Profile picture URL |
| `devices` | TEXT[] | YES | `{garmin}` | Enabled device integrations |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Last update timestamp |

**Indexes:**
- Primary key on `id`

**RLS Policies:**
- Users can view/update their own profile

---

### linked_accounts

OAuth-connected accounts (Strava, Garmin, etc.)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | TEXT | NO | `gen_random_uuid()` | Primary key |
| `profile_id` | TEXT | NO | - | FK to profiles.id |
| `provider` | TEXT | NO | - | OAuth provider (strava, garmin) |
| `provider_account_id` | TEXT | NO | - | Account ID from provider |
| `access_token` | TEXT | YES | - | OAuth access token |
| `refresh_token` | TEXT | YES | - | OAuth refresh token |
| `token_expires_at` | TIMESTAMPTZ | YES | - | Token expiration |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Last update timestamp |

**Indexes:**
- Primary key on `id`
- Unique on `(profile_id, provider)`
- Index on `profile_id`

**Foreign Keys:**
- `profile_id` → `profiles.id` (CASCADE DELETE)

**RLS Policies:**
- Users can CRUD their own linked accounts

---

### workouts

Standard workouts created through the workflow.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | TEXT | NO | `gen_random_uuid()` | Primary key |
| `profile_id` | TEXT | NO | - | FK to profiles.id |
| `title` | TEXT | YES | - | Workout title |
| `description` | TEXT | YES | - | Workout description |
| `workout_data` | JSONB | NO | - | Full workout structure |
| `sources` | TEXT[] | YES | - | Source identifiers |
| `device` | TEXT | NO | - | Target device (garmin, apple, zwift) |
| `exports` | JSONB | YES | - | Generated export formats |
| `validation` | JSONB | YES | - | Validation results |
| `is_exported` | BOOLEAN | NO | `FALSE` | Export status |
| `exported_at` | TIMESTAMPTZ | YES | - | Export timestamp |
| `exported_to_device` | TEXT | YES | - | Device exported to |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Last update timestamp |

**Indexes:**
- Primary key on `id`
- Index on `profile_id`
- Index on `created_at DESC`

**Foreign Keys:**
- `profile_id` → `profiles.id` (CASCADE DELETE)

**RLS Policies:**
- Users can CRUD their own workouts
- Service role can insert (for API)

---

### follow_along_workouts

Video-based workouts ingested from Instagram, YouTube, etc.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | TEXT | NO | `gen_random_uuid()` | Primary key |
| `user_id` | TEXT | NO | - | FK to profiles.id |
| `source` | TEXT | NO | `'instagram'` | Video source platform |
| `source_url` | TEXT | NO | - | Original video URL |
| `title` | TEXT | NO | - | Workout title |
| `description` | TEXT | YES | - | Workout description |
| `video_duration_sec` | INTEGER | YES | - | Video length in seconds |
| `thumbnail_url` | TEXT | YES | - | Thumbnail image URL |
| `video_proxy_url` | TEXT | YES | - | Proxied video URL |
| `garmin_workout_id` | TEXT | YES | - | Synced Garmin workout ID |
| `garmin_last_sync_at` | TIMESTAMPTZ | YES | - | Last Garmin sync |
| `apple_watch_workout_id` | TEXT | YES | - | Apple Watch workout ID |
| `apple_watch_last_sync_at` | TIMESTAMPTZ | YES | - | Last Apple Watch sync |
| `ios_companion_synced_at` | TIMESTAMPTZ | YES | - | Last iOS companion sync |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Last update timestamp |

**Indexes:**
- Primary key on `id`
- Index on `user_id`
- Index on `created_at DESC`

**Foreign Keys:**
- `user_id` → `profiles.id` (CASCADE DELETE)

**RLS Policies:**
- Users can CRUD their own follow-along workouts

---

### follow_along_steps

Individual steps/exercises within a follow-along workout.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | TEXT | NO | `gen_random_uuid()` | Primary key |
| `follow_along_workout_id` | TEXT | NO | - | FK to follow_along_workouts.id |
| `order` | INTEGER | NO | - | Step order (1-indexed) |
| `label` | TEXT | NO | - | Step/exercise name |
| `canonical_exercise_id` | TEXT | YES | - | Matched canonical exercise |
| `start_time_sec` | INTEGER | NO | - | Start time in video |
| `end_time_sec` | INTEGER | NO | - | End time in video |
| `duration_sec` | INTEGER | NO | - | Step duration |
| `target_reps` | INTEGER | YES | - | Target rep count |
| `target_duration_sec` | INTEGER | YES | - | Target duration |
| `intensity_hint` | TEXT | YES | - | easy, moderate, hard |
| `notes` | TEXT | YES | - | Additional notes |
| `follow_along_url` | TEXT | YES | - | Per-step video URL |
| `carousel_position` | INTEGER | YES | - | Instagram carousel index |
| `video_start_time_sec` | INTEGER | YES | - | YouTube timestamp |

**Indexes:**
- Primary key on `id`
- Index on `(follow_along_workout_id, order)`

**Foreign Keys:**
- `follow_along_workout_id` → `follow_along_workouts.id` (CASCADE DELETE)

**Constraints:**
- `intensity_hint` IN ('easy', 'moderate', 'hard')

**RLS Policies:**
- Users can CRUD steps of their own workouts

---

## Entity Relationship Diagram

```
┌─────────────────┐
│    profiles     │
├─────────────────┤
│ id (PK)         │◄─────────────────────────────────────────┐
│ email           │                                          │
│ name            │                                          │
│ devices[]       │                                          │
└────────┬────────┘                                          │
         │                                                   │
         │ 1:N                                               │
         ▼                                                   │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐
│ linked_accounts │    │    workouts     │    │ follow_along_workouts   │
├─────────────────┤    ├─────────────────┤    ├─────────────────────────┤
│ id (PK)         │    │ id (PK)         │    │ id (PK)                 │
│ profile_id (FK) │────│ profile_id (FK) │────│ user_id (FK)            │
│ provider        │    │ title           │    │ source                  │
│ access_token    │    │ workout_data    │    │ source_url              │
│ refresh_token   │    │ device          │    │ title                   │
└─────────────────┘    │ is_exported     │    │ garmin_workout_id       │
                       └─────────────────┘    │ ios_companion_synced_at │
                                              └───────────┬─────────────┘
                                                          │
                                                          │ 1:N
                                                          ▼
                                              ┌─────────────────────────┐
                                              │   follow_along_steps    │
                                              ├─────────────────────────┤
                                              │ id (PK)                 │
                                              │ follow_along_workout_id │
                                              │ order                   │
                                              │ label                   │
                                              │ start_time_sec          │
                                              │ duration_sec            │
                                              │ follow_along_url        │
                                              │ carousel_position       │
                                              └─────────────────────────┘
```

---

## Row Level Security (RLS)

All tables have RLS enabled. Policies ensure users can only access their own data.

### Common Pattern

```sql
-- SELECT: Users can view their own data
CREATE POLICY "Users can view own data" ON table_name
    FOR SELECT USING (auth.uid()::text = user_id);

-- INSERT: Users can insert their own data
CREATE POLICY "Users can insert own data" ON table_name
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- UPDATE: Users can update their own data
CREATE POLICY "Users can update own data" ON table_name
    FOR UPDATE USING (auth.uid()::text = user_id);

-- DELETE: Users can delete their own data
CREATE POLICY "Users can delete own data" ON table_name
    FOR DELETE USING (auth.uid()::text = user_id);
```

### Service Role Bypass

The mapper-api uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS for backend operations.

---

## Migrations History

| Migration | Date | Description |
|-----------|------|-------------|
| `001_create_profiles_table` | 2025-01-17 | Initial profiles table |
| `20250120000000_update_profiles_for_clerk` | 2025-01-20 | Clerk auth integration |
| `20250120000001_create_linked_accounts_table` | 2025-01-20 | OAuth linked accounts |
| `20250120000002_create_workouts_table` | 2025-01-20 | Main workouts table |
| `20250122000000_create_follow_along_workouts` | 2025-01-22 | Follow-along feature |
| `20250130000000_add_ios_companion_sync` | 2025-01-30 | iOS companion sync |
