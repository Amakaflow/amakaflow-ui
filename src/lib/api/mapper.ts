import { IngestResponse } from "./ingest";

// Minimal canonical exercise/block types in case we later expand auto-map
export interface CanonicalExercise {
  id?: string;
  name: string;
  sets: number | null;
  reps: number | null;
  reps_range: string | null;
  duration_sec: number | null;
  rest_sec: number | null;
  distance_m: number | null;
  distance_range: string | null;
  type: string;
  notes?: string | null;
}

export interface CanonicalBlock {
  label: string;
  structure?: string | null;
  exercises: CanonicalExercise[];
  rounds?: number | null;
  sets?: number | null;
  time_cap_sec?: number | null;
  time_work_sec?: number | null;
  time_rest_sec?: number | null;
  rest_between_rounds_sec?: number | null;
  rest_between_sets_sec?: number | null;
  rest_between_sec?: number | null;
  default_reps_range?: string | null;
  default_sets?: number | null;
  supersets?: {
    exercises: CanonicalExercise[];
    rest_between_sec?: number | null;
  }[];
}

// What the UI sends into auto-map
export interface AutoMapBlocksJson {
  title?: string | null;
  source?: string | null;
  blocks: IngestResponse["blocks"];
}

// What auto-map can return (based on your flow doc)
export interface AutoMapResponse {
  // Primary contract: Garmin YAML
  yaml?: string;

  // Optional richer structure if backend adds it later
  blocks?: CanonicalBlock[];

  // Optional extra exports
  exports?: Record<string, unknown>;

  // Any other metadata
  _provenance?: Record<string, unknown>;
}

function getMapperBaseUrl(): string {
  // Vite env (browser)
  const viteEnv = (import.meta as any).env || {};
  const fromVite = viteEnv.VITE_MAPPER_API_URL as string | undefined;

  // Node env (Vitest / CI)
  const nodeEnv =
    (globalThis as any).process?.env as Record<string, string | undefined>;

  const raw = fromVite || nodeEnv?.VITE_MAPPER_API_URL;

  if (!raw) {
    throw new Error(
      "VITE_MAPPER_API_URL is not configured. " +
        "Set it in your .env or export before running mapper E2E tests."
    );
  }

  return raw.replace(/\/$/, "");
}

/**
 * Thin client around mapper-api /map/auto-map.
 *
 * Backend contract from your flow doc:
 *
 * POST http://mapper-api:8001/map/auto-map
 * Body:
 * {
 *   "blocks_json": {
 *     "title": "Workout Title",
 *     "blocks": [...]
 *   }
 * }
 *
 * Response:
 * {
 *   "yaml": "Garmin YAML format..."
 * }
 */
export async function mapBlocks(
  blocksJson: AutoMapBlocksJson
): Promise<AutoMapResponse> {
  const baseUrl = getMapperBaseUrl();

  // Optional client-side timeout so Vitest / UI don’t hang forever
  const viteEnv = (import.meta as any).env || {};
  const nodeEnv =
    (globalThis as any).process?.env as Record<string, string | undefined>;
  const timeoutMs =
    Number(viteEnv.VITE_MAPPER_CLIENT_TIMEOUT_MS) ||
    Number(nodeEnv?.VITE_MAPPER_CLIENT_TIMEOUT_MS) ||
    20000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${baseUrl}/map/auto-map`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    // IMPORTANT: backend expects { blocks_json: { ... } }
    body: JSON.stringify({ blocks_json: blocksJson }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Mapper failed: ${res.status} ${res.statusText} for ${url}${
        text ? ` – ${text}` : ""
      }`
    );
  }

  return (await res.json()) as AutoMapResponse;
}
