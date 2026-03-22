/**
 * AMA-311: Tests for useSyncPolling hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSyncPolling, type SyncStatusItem } from '../useSyncPolling';

describe('AMA-311: useSyncPolling', () => {
  const makeSyncedItems = (): SyncStatusItem[] => [
    { id: '1', status: 'synced' },
    { id: '2', status: 'synced' },
  ];

  const makePendingItems = (): SyncStatusItem[] => [
    { id: '1', status: 'synced' },
    { id: '2', status: 'pending' },
  ];

  describe('without fake timers', () => {
    it('fetches statuses on mount', async () => {
      const fetchStatuses = vi.fn().mockResolvedValue(makeSyncedItems());

      renderHook(() => useSyncPolling({ fetchStatuses }));

      await waitFor(() => {
        expect(fetchStatuses).toHaveBeenCalledOnce();
      });
    });

    it('returns fetched statuses', async () => {
      const items = makeSyncedItems();
      const fetchStatuses = vi.fn().mockResolvedValue(items);

      const { result } = renderHook(() => useSyncPolling({ fetchStatuses }));

      await waitFor(() => {
        expect(result.current.statuses).toEqual(items);
      });
    });

    it('sets lastRefreshedAt after successful fetch', async () => {
      const fetchStatuses = vi.fn().mockResolvedValue(makeSyncedItems());

      const { result } = renderHook(() => useSyncPolling({ fetchStatuses }));

      await waitFor(() => {
        expect(result.current.lastRefreshedAt).not.toBeNull();
      });
    });

    it('reports isAutoPolling when pending items exist', async () => {
      const fetchStatuses = vi.fn().mockResolvedValue(makePendingItems());

      const { result } = renderHook(() =>
        useSyncPolling({ fetchStatuses, intervalMs: 60000 }),
      );

      await waitFor(() => {
        expect(result.current.isAutoPolling).toBe(true);
      });
    });

    it('reports isAutoPolling false when all synced', async () => {
      const fetchStatuses = vi.fn().mockResolvedValue(makeSyncedItems());

      const { result } = renderHook(() =>
        useSyncPolling({ fetchStatuses, intervalMs: 60000 }),
      );

      await waitFor(() => {
        expect(result.current.isAutoPolling).toBe(false);
      });
    });

    it('supports manual refresh', async () => {
      const fetchStatuses = vi.fn().mockResolvedValue(makeSyncedItems());

      const { result } = renderHook(() =>
        useSyncPolling({ fetchStatuses }),
      );

      await waitFor(() => {
        expect(fetchStatuses).toHaveBeenCalledOnce();
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(fetchStatuses).toHaveBeenCalledTimes(2);
    });

    it('handles fetch errors gracefully', async () => {
      const fetchStatuses = vi.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useSyncPolling({ fetchStatuses }),
      );

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
        expect(result.current.error?.message).toBe('Network error');
      });
    });

    it('does not fetch when disabled', async () => {
      const fetchStatuses = vi.fn().mockResolvedValue(makeSyncedItems());

      renderHook(() =>
        useSyncPolling({ fetchStatuses, enabled: false }),
      );

      // Wait a tick to make sure nothing fires
      await new Promise((r) => setTimeout(r, 50));

      expect(fetchStatuses).not.toHaveBeenCalled();
    });
  });

  describe('with fake timers (polling behavior)', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not auto-poll when all synced', async () => {
      const fetchStatuses = vi.fn().mockResolvedValue(makeSyncedItems());

      renderHook(() =>
        useSyncPolling({ fetchStatuses, intervalMs: 1000 }),
      );

      // Let initial fetch resolve
      await vi.waitFor(() => {
        expect(fetchStatuses).toHaveBeenCalledOnce();
      });

      // Advance time past poll interval
      vi.advanceTimersByTime(2000);

      // Should not have polled again (all synced)
      expect(fetchStatuses).toHaveBeenCalledOnce();
    });

    it('auto-polls when there are pending syncs', async () => {
      const fetchStatuses = vi.fn().mockResolvedValue(makePendingItems());

      renderHook(() =>
        useSyncPolling({ fetchStatuses, intervalMs: 1000 }),
      );

      await vi.waitFor(() => {
        expect(fetchStatuses).toHaveBeenCalledOnce();
      });

      // Advance time past poll interval
      vi.advanceTimersByTime(1100);

      await vi.waitFor(() => {
        expect(fetchStatuses).toHaveBeenCalledTimes(2);
      });
    });
  });
});
