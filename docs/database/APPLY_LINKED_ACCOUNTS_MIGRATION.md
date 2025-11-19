# Linked Accounts Migration

The `linked_accounts` table has been created via Supabase CLI migration.

## Migration Applied

✅ **Migration:** `20250120000001_create_linked_accounts_table.sql`
✅ **Status:** Applied successfully

This migration created:
- `linked_accounts` table for storing connected third-party accounts
- Row Level Security (RLS) policies (validated in application layer for Clerk)
- Indexes for faster lookups
- Helper function `get_linked_account_status()`

## Apply Future Migrations

To apply any new migrations:

```bash
cd ui
npm run db:push
```

Or if migrations need to be applied with older migrations:

```bash
cd ui
npx supabase db push --include-all
```

## Verify Migration

After running the migration, verify it worked:

1. In Supabase Dashboard, go to **Table Editor**
2. You should see `linked_accounts` table in the list
3. Check that it has the following columns:
   - `id` (uuid)
   - `profile_id` (uuid)
   - `provider` (text)
   - `external_id` (text)
   - `external_username` (text)
   - `access_token_encrypted` (text)
   - `refresh_token_encrypted` (text)
   - `expires_at` (bigint)
   - `connected_at` (timestamptz)
   - `last_sync_at` (timestamptz)
   - `permissions` (text[])
   - `metadata` (jsonb)

## Troubleshooting

If you get an error about the table already existing:
- The migration uses `CREATE TABLE IF NOT EXISTS`, so it should be safe to run again
- Check if the table exists in **Table Editor**

If you get an error about RLS policies:
- The migration should create them automatically
- Check **Authentication** > **Policies** to see if policies were created

