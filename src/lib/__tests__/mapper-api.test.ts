import { describe, it, expect } from "vitest";
import { ingestWorkout } from "../api/ingest";
import { mapBlocks } from "../api/mapper";

const viteEnv = (import.meta as any).env || {};
const nodeEnv =
  (globalThis as any).process?.env as Record<string, string | undefined>;

const runMapperE2E =
  Boolean(viteEnv.VITE_RUN_MAPPER_E2E) ||
  Boolean(nodeEnv?.VITE_RUN_MAPPER_E2E);

const describeMaybe = runMapperE2E ? describe : describe.skip;

const MAPPER_E2E_TIMEOUT_MS =
  Number(viteEnv.VITE_MAPPER_E2E_TIMEOUT_MS) ||
  Number(nodeEnv?.VITE_MAPPER_E2E_TIMEOUT_MS) ||
  30000;

describeMaybe("mapper API E2E – ingest → auto-map", () => {
  it(
    "takes ingested blocks and returns Garmin YAML",
    async () => {
      const sampleUrl =
        viteEnv.VITE_INGEST_SAMPLE_YOUTUBE_URL ||
        nodeEnv?.VITE_INGEST_SAMPLE_YOUTUBE_URL;

      if (!sampleUrl) {
        throw new Error(
          "VITE_INGEST_SAMPLE_YOUTUBE_URL is not set. " +
            "Set it to a known-good workout video URL before running this test."
        );
      }

      // 1) Hit workout-ingestor-api to get raw blocks
      const ingestResult = await ingestWorkout({
        sourceType: "youtube",
        url: String(sampleUrl),
      });

      // 2) Send title + blocks into mapper /map/auto-map
      const started = Date.now();
      const autoMapResult = await mapBlocks({
        title: ingestResult.title,
        source: ingestResult.source,
        blocks: ingestResult.blocks,
      });
      const duration = Date.now() - started;

      // Debug log – shows in Vitest output
      // eslint-disable-next-line no-console
      console.log(
        `[mapper-e2e] Completed in ${duration}ms, ` +
          `title="${autoMapResult.title ?? ingestResult.title}", ` +
          `yamlLength=${autoMapResult.yaml?.length ?? 0}`
      );

      // 3) Assert we got back usable YAML
      expect(typeof autoMapResult.yaml).toBe("string");
      expect((autoMapResult.yaml ?? "").length).toBeGreaterThan(0);
    },
    MAPPER_E2E_TIMEOUT_MS
  );
});
