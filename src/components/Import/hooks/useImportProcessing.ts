import { useState } from 'react';
import { bulkImportApi } from '../../../lib/bulk-import-api';
import type { QueueItem, ProcessedItem } from '../../../types/import';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * The payload accepted by `detect`.
 *
 * `urlQueueIds` and `base64QueueIds` must mirror the order of `urls` and
 * `base64Items` respectively so the hook can map each API result back to the
 * originating queue item.
 */
export interface DetectPayload {
  urls: string[];
  base64Items: Array<{ base64: string; type: 'image' | 'pdf' }>;
  urlQueueIds: string[];
  base64QueueIds: string[];
}

export interface ImportProcessingResult {
  processedItems: ProcessedItem[];
  detect: (userId: string, payload: DetectPayload) => Promise<void>;
  retry: (queueId: string, userId: string, item: QueueItem) => Promise<void>;
  removeResult: (queueId: string) => void;
  clearResults: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map a single raw DetectedItem to a ProcessedItem. */
function mapDetectedToProcessed(
  queueId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detected: any
): ProcessedItem {
  if (detected.errors?.length) {
    return {
      queueId,
      status: 'failed',
      errorMessage: detected.errors[0] as string,
    };
  }

  return {
    queueId,
    status: 'done',
    workoutTitle: (detected.parsedTitle as string | undefined) ?? 'Untitled workout',
    blockCount: (detected.parsedBlockCount as number | undefined) ?? 0,
    exerciseCount: (detected.parsedExerciseCount as number | undefined) ?? 0,
    workout: detected.rawData,
  };
}

/** Build an error ProcessedItem for a given queueId. */
function errorItem(queueId: string, message: string): ProcessedItem {
  return { queueId, status: 'error', errorMessage: message };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useImportProcessing(): ImportProcessingResult {
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);

  // ── detect ──────────────────────────────────────────────────────────────────

  const detect = async (userId: string, payload: DetectPayload): Promise<void> => {
    const { urls, base64Items, urlQueueIds, base64QueueIds } = payload;

    // Build the ordered list of queueIds we expect results for.
    const allQueueIds = [...urlQueueIds, ...base64QueueIds];

    try {
      // We make up to two API calls (one for URLs, one for images/PDFs) then
      // combine the results, preserving the position→queueId mapping.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allDetected: any[] = [];

      if (urls.length > 0) {
        const response = await bulkImportApi.detect(userId, 'urls', urls);
        allDetected.push(...response.items);
      }

      if (base64Items.length > 0) {
        const base64Strings = base64Items.map(b => b.base64);
        const response = await bulkImportApi.detect(userId, 'images', base64Strings);
        allDetected.push(...response.items);
      }

      const results: ProcessedItem[] = allQueueIds.map((queueId, idx) => {
        const detected = allDetected[idx];
        if (!detected) {
          return errorItem(queueId, 'No result returned');
        }
        return mapDetectedToProcessed(queueId, detected);
      });

      setProcessedItems(results);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      setProcessedItems(allQueueIds.map(queueId => errorItem(queueId, message)));
    }
  };

  // ── retry ───────────────────────────────────────────────────────────────────

  const retry = async (queueId: string, userId: string, item: QueueItem): Promise<void> => {
    // Immediately reset the item to pending so the UI can show a spinner.
    setProcessedItems(prev =>
      prev.map(p =>
        p.queueId === queueId
          ? { queueId, status: 'pending', errorMessage: undefined }
          : p
      )
    );

    try {
      let detected: unknown;

      if (item.type === 'url') {
        const response = await bulkImportApi.detect(userId, 'urls', [item.raw as string]);
        detected = response.items[0];
      } else if (item.type === 'image' || item.type === 'pdf') {
        // For retry, the QueueItem.raw is a File — callers must pass the original
        // QueueItem so we can get the base64 from it. However, since this hook has
        // no access to fileToBase64 directly AND we want to avoid making this hook
        // depend on File IO, we accept that retry for file items re-issues a detect
        // using the sourceRef string. In practice, retry is called from the
        // processing screen where the caller wraps the file.
        //
        // For now: if the raw value is a string (already a base64), use it directly.
        // If it's a File, use the sourceRef fallback by treating it as a URL-style
        // detect call. This is a known limitation documented here.
        const raw = item.raw;
        if (typeof raw === 'string') {
          const response = await bulkImportApi.detect(userId, 'images', [raw]);
          detected = response.items[0];
        } else {
          // raw is a File — we cannot fileToBase64 here without a browser FileReader.
          // Surface an error so the caller knows to handle this case.
          throw new Error('Cannot retry file items without base64 — convert to base64 before calling retry');
        }
      } else {
        // text / clip — treat raw as a plain string
        const response = await bulkImportApi.detect(userId, 'urls', [item.raw as string]);
        detected = response.items[0];
      }

      if (!detected) {
        throw new Error('No result returned');
      }

      setProcessedItems(prev =>
        prev.map(p =>
          p.queueId === queueId ? mapDetectedToProcessed(queueId, detected) : p
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Retry failed';
      setProcessedItems(prev =>
        prev.map(p =>
          p.queueId === queueId ? errorItem(queueId, message) : p
        )
      );
    }
  };

  // ── removeResult ────────────────────────────────────────────────────────────

  const removeResult = (queueId: string): void => {
    setProcessedItems(prev => prev.filter(p => p.queueId !== queueId));
  };

  // ── clearResults ────────────────────────────────────────────────────────────

  const clearResults = (): void => {
    setProcessedItems([]);
  };

  return { processedItems, detect, retry, removeResult, clearResults };
}
