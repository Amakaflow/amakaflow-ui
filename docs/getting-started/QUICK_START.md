# Quick Start - Database Setup

## One-Time Setup (2 minutes)

### Step 1: Login to Supabase CLI
```bash
npx supabase login
```
(A browser will open for authentication)

### Step 2: Link Your Project
```bash
npm run db:link
```

### Step 3: Run Migrations
```bash
npm run db:push
```

**Done!** ✅ Your database is now set up. All future migrations can be run with `npm run db:push`.

## What This Does

- Creates the `profiles` table
- Sets up Row Level Security (RLS) policies
- Creates automatic profile creation trigger
- No manual SQL editor needed!

## All Database Commands

```bash
# Push migrations to database
npm run db:push

# Link project (one-time setup)
npm run db:link

# Complete setup (login + link + push)
npm run db:setup

# Create new migration
npx supabase migration new migration_name

# View migration status
npx supabase migration list
```

## Troubleshooting

**"Not authenticated"**
→ Run: `npx supabase login`

**"Project not linked"**
→ Run: `npm run db:link`

**"Migration already applied"**
→ This is normal if you've run it before. The migration is idempotent.

