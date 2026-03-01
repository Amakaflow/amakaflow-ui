import { describe, it, expectTypeOf } from 'vitest';
import type { ImportTab, QueueItem } from '../../../types/unified-import';

describe('unified-import types', () => {
  it('ImportTab includes clip-queue', () => {
    const tab: ImportTab = 'clip-queue';
    expectTypeOf(tab).toMatchTypeOf<ImportTab>();
  });

  it('QueueItem type includes clip', () => {
    const item: QueueItem = {
      id: '1',
      type: 'clip',
      label: 'test',
      raw: 'https://example.com',
    };
    expectTypeOf(item).toMatchTypeOf<QueueItem>();
  });
});
