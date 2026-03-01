import { useState } from 'react';
import { fileToBase64 } from '../../../lib/bulk-import-api';
import type { QueueItem } from '../../../types/import';

export interface ImportQueueResult {
  queue: QueueItem[];
  addUrls: (raw: string) => void;
  addFiles: (files: File[]) => void;
  removeItem: (id: string) => void;
  clearQueue: () => void;
  toDetectPayload: () => Promise<{
    urls: string[];
    base64Items: Array<{ base64: string; type: 'image' | 'pdf' }>;
  }>;
}

export function useImportQueue(): ImportQueueResult {
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const addUrls = (raw: string) => {
    const parsed = raw
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(Boolean);

    setQueue(prev => [
      ...prev,
      ...parsed.map(url => ({
        id: crypto.randomUUID(),
        type: 'url' as const,
        label: (() => {
          try {
            const u = new URL(url);
            return u.hostname + u.pathname.slice(0, 40);
          } catch {
            return url.slice(0, 60);
          }
        })(),
        raw: url,
      })),
    ]);
  };

  const addFiles = (files: File[]) => {
    setQueue(prev => [
      ...prev,
      ...files.map(file => ({
        id: crypto.randomUUID(),
        type: (file.type.startsWith('image/') ? 'image' : 'pdf') as 'image' | 'pdf',
        label: file.name,
        raw: file,
      })),
    ]);
  };

  const removeItem = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const clearQueue = () => setQueue([]);

  const toDetectPayload = async () => {
    const urlItems = queue.filter(i => i.type === 'url');
    const mediaItems = queue.filter(i => i.type === 'image' || i.type === 'pdf');

    const urls = urlItems.map(i => i.raw as string);
    const base64Items = await Promise.all(
      mediaItems.map(async item => ({
        base64: await fileToBase64(item.raw as File),
        type: item.type as 'image' | 'pdf',
      }))
    );

    return { urls, base64Items };
  };

  return { queue, addUrls, addFiles, removeItem, clearQueue, toDetectPayload };
}
