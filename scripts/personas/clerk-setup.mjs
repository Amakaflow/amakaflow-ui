/**
 * Persona Testing Harness — Clerk user lifecycle
 *
 * Programmatically creates a Clerk user for a persona at run start and
 * deletes it at run end. Implements the AMA-1447 decision to use real
 * Clerk auth (no bypass) with per-persona identity provisioned via
 * @clerk/backend instead of pre-created dashboard users.
 *
 * Usage:
 *   import { createPersonaUser, deletePersonaUser } from './clerk-setup.mjs';
 *
 *   const credentials = await createPersonaUser({ id: 'marcus', name: 'Marcus' });
 *   // credentials = { userId, email, password }
 *   try {
 *     // ... run persona steps using credentials.email + credentials.password
 *   } finally {
 *     await deletePersonaUser(credentials.userId);
 *   }
 *
 * Requires CLERK_SECRET_KEY in the environment. The persona engine reads
 * .env.local at startup; if running this module directly, source it manually.
 */
import { createClerkClient } from '@clerk/backend';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── env loading ──────────────────────────────────────────────────────────────
//
// The persona engine doesn't use dotenv. Parse .env.local manually so this
// module can be imported standalone without taking on a new dependency.
// Exported so persona-engine.mjs can reuse it instead of duplicating the
// parser (CodeRabbit AMA-1447 nitpick).
export async function loadEnvLocal() {
  const envPath = path.resolve(__dirname, '../../.env.local');
  try {
    const text = await readFile(envPath, 'utf-8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      // Strip matching surrounding quotes so values like KEY="value with
      // spaces" are parsed correctly. Our current .env.local keys aren't
      // quoted, but this makes the parser robust if someone adds one later.
      if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1);
      }
      // Don't clobber pre-set env vars (e.g. when running under CI)
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    // No .env.local — fine, env vars must be set elsewhere
  }
}

await loadEnvLocal();

const SECRET = process.env.CLERK_SECRET_KEY;
if (!SECRET || !SECRET.startsWith('sk_test_')) {
  throw new Error(
    'clerk-setup.mjs: CLERK_SECRET_KEY missing or not a test key. ' +
      'Add it to amakaflow-ui/.env.local (without VITE_ prefix) or set in environment.'
  );
}

const clerk = createClerkClient({ secretKey: SECRET });

// Supabase service-role client — bypasses RLS so we can directly upsert the
// persona's profile row with a pre-seeded device. This lets the persona skip
// the "Complete Your Profile" onboarding wizard that useAppAuth renders when
// the user has no devices selected and no Strava connected. Validating the
// onboarding UI itself is out of scope here — see AMA-1448.
//
// Service role key is backend-only and must NEVER be exposed to client code.
// Read from amakaflow-backend/.env (via VITE_-less env var in .env.local).
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdmin = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Create a Clerk user for a persona.
 *
 * Email is generated as scratch-{personaId}-{timestamp}@example.com.
 * Clerk's email validator rejects RFC-2606 reserved TLDs like .test, so we
 * use @example.com (also reserved per RFC 2606 section 3 but accepted by
 * Clerk's validator).
 *
 * Password is randomized per run and held only in memory.
 */
export async function createPersonaUser(persona) {
  const ts = Date.now();
  const email = `persona-${persona.id}-${ts}@example.com`;
  // Clerk requires passwords to be at least 8 characters and not be in the
  // breach corpus. Random base36 + timestamp + special chars satisfies that.
  const password = `Persona_${persona.id.replace(/[^a-zA-Z0-9]/g, '')}_${Math.random().toString(36).slice(2)}_${ts}!`;

  let user;
  try {
    user = await clerk.users.createUser({
      emailAddress: [email],
      password,
      firstName: persona.name || persona.id,
      lastName: 'Persona',
    });
  } catch (err) {
    const detail = err.errors ? `\n  ${JSON.stringify(err.errors, null, 2)}` : '';
    throw new Error(`Failed to create Clerk user for persona ${persona.id}: ${err.message}${detail}`);
  }

  // Pre-seed the Supabase profile row with a default device so the persona
  // skips the "Complete Your Profile" onboarding wizard on first sign-in.
  // useAppAuth.needsProfileCompletion() returns true when selectedDevices is
  // empty AND Strava is not connected, which blocks the main app from
  // rendering. One device is enough to pass that check.
  //
  // Uses the service role key to bypass RLS, which is why this lives in the
  // test-only clerk-setup module and not in the main app code.
  if (supabaseAdmin) {
    const { error: upsertError } = await supabaseAdmin.rpc('upsert_clerk_profile', {
      p_user_id: user.id,
      p_email: email,
      p_name: `${persona.name || persona.id} Persona`,
      p_selected_devices: ['garmin'],
    });
    if (upsertError) {
      // Best-effort pre-seed. If the RPC isn't available or fails, fall back
      // to a direct insert. If that also fails, warn and continue — the
      // persona will just hit the onboarding gate and the test will surface
      // the problem visibly.
      const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .upsert(
          {
            id: user.id,
            email,
            name: `${persona.name || persona.id} Persona`,
            selected_devices: ['garmin'],
            subscription: 'free',
          },
          { onConflict: 'id' }
        );
      if (insertError) {
        console.warn(`⚠️  Supabase profile pre-seed failed for ${persona.id}: rpc=${upsertError.message}, insert=${insertError.message}`);
        console.warn(`    Persona will hit the onboarding gate on first sign-in.`);
      }
    }
  } else {
    console.warn(
      `⚠️  Supabase admin client not configured (VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing). ` +
        `Persona ${persona.id} will hit the onboarding gate.`
    );
  }

  return {
    userId: user.id,
    email,
    password,
  };
}

/**
 * Delete a Clerk user. Idempotent — logs warning instead of throwing if the
 * user is already gone, so this can be called from a finally block without
 * masking the original error.
 */
export async function deletePersonaUser(userId) {
  if (!userId) return;

  // Delete the Supabase profile row first. Best-effort — if Supabase is
  // unreachable or the delete fails, log and continue so the Clerk user
  // still gets cleaned up. Foreign keys in Supabase may cascade-delete
  // related rows; if not, those become orphans and need a separate cleanup
  // sweep.
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.from('profiles').delete().eq('id', userId);
    if (error) {
      console.warn(`⚠️  Supabase profile delete failed for ${userId}: ${error.message}`);
    }
  }

  try {
    await clerk.users.deleteUser(userId);
  } catch (err) {
    console.warn(`⚠️  deletePersonaUser(${userId}) failed: ${err.message}`);
    console.warn(`   This persona's Clerk user may need manual cleanup in the dashboard.`);
  }
}
