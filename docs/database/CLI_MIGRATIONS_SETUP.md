# Database Migrations via CLI

All database changes are managed through Supabase CLI and migration files. **No manual SQL editor usage required.**

## Initial Setup (One Time)

### 1. Login to Supabase CLI

```bash
npx supabase login
```

This will open your browser for authentication. After logging in, you're done with this step.

### 2. Link Your Project

```bash
npm run db:link
```

Or manually:
```bash
npx supabase link --project-ref wdeqaibnwjekcyfpuple
```

### 3. Push Migrations

```bash
npm run db:push
```

This will automatically run all migrations in `.supabase/migrations/` folder.

**That's it!** After this one-time setup, you can use `npm run db:push` for all future migrations.

## Quick Commands

```bash
# Push all migrations to database
npm run db:push

# Create a new migration file
npx supabase migration new migration_name

# Reset database (WARNING: deletes all data)
npm run db:reset

# View migration status
npx supabase migration list
```

## Migration Files

All migrations are stored in: `.supabase/migrations/`

Migration files are named with timestamps: `YYYYMMDDHHMMSS_description.sql`

Example: `20241219120000_create_profiles_table.sql`

## Workflow for New Migrations

1. **Create a new migration:**
   ```bash
   npx supabase migration new add_new_feature
   ```

2. **Edit the generated file** in `.supabase/migrations/`

3. **Push to database:**
   ```bash
   npm run db:push
   ```

## Current Migrations

- ✅ `create_profiles_table.sql` - Creates user profiles table with RLS policies

## Troubleshooting

### "Project not linked"
Run: `npm run db:link`

### "Not authenticated"
Run: `npx supabase login`

### "Migration failed"
Check the error message and fix the SQL in the migration file, then run `npm run db:push` again.

## Important Notes

- ✅ All database changes go through migrations
- ✅ No manual SQL editor needed
- ✅ Migrations are version controlled
- ✅ Can be run on any environment (dev, staging, production)
- ✅ Rollback support available

