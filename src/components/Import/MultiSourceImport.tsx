/**
 * AMA-1180: Multi-source workout import component.
 *
 * Large textarea for pasting multiple URLs (one per line).
 * Auto-detects platform per URL (Instagram, YouTube, TikTok) with icon badges.
 * "Import All" button -> batch imports all URLs in parallel.
 * Progress indicator per URL (importing... done / failed).
 * After all imported -> auto-opens BlockPicker with all results.
 */

import { useState, useCallback, useRef } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Loader2, CheckCircle, XCircle, Trash2, Clipboard } from 'lucide-react';
import { cn } from '../ui/utils';
import {
  detectPlatform,
  PLATFORM_BADGE_COLORS,
  PLATFORM_LABELS,
  type SourcePlatform,
} from './fixtures/multi-source-demo';
import { PlatformIcon } from './PlatformIcon';
import type { ProcessedItem, QueueItem } from '../../types/import';

// ── Types ────────────────────────────────────────────────────────────────────

export type ImportUrlStatus = 'idle' | 'importing' | 'done' | 'failed';

export interface ParsedUrl {
  id: string;
  url: string;
  platform: SourcePlatform | null;
  status: ImportUrlStatus;
  errorMessage?: string;
}

export interface MultiSourceImportProps {
  /** Called when all URLs have been imported. Receives queue items + processed results. */
  onImportComplete: (queueItems: QueueItem[], processedItems: ProcessedItem[]) => void;
  /** Optional: external import function. If omitted, uses demo mode with mock data. */
  importFn?: (urls: string[]) => Promise<{ queueItems: QueueItem[]; processedItems: ProcessedItem[] }>;
  /** Optional demo data for testing/screenshots. */
  demoQueueItems?: QueueItem[];
  demoProcessedItems?: ProcessedItem[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseUrlLines(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && (s.startsWith('http://') || s.startsWith('https://')));
}

// ── Component ────────────────────────────────────────────────────────────────

export function MultiSourceImport({
  onImportComplete,
  importFn,
  demoQueueItems,
  demoProcessedItems,
}: MultiSourceImportProps) {
  const [urlInput, setUrlInput] = useState('');
  const [parsedUrls, setParsedUrls] = useState<ParsedUrl[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const importAbort = useRef<AbortController | null>(null);

  // ── Parse URLs from textarea ─────────────────────────────────────────────

  const handleUrlChange = useCallback((value: string) => {
    setUrlInput(value);
    const urls = parseUrlLines(value);
    setParsedUrls(
      urls.map((url, i) => ({
        id: `url-${i}-${url.slice(-10)}`,
        url,
        platform: detectPlatform(url),
        status: 'idle' as const,
      }))
    );
  }, []);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        handleUrlChange(text);
      }
    } catch {
      // Clipboard permission denied
    }
  };

  const removeUrl = (id: string) => {
    const next = parsedUrls.filter(u => u.id !== id);
    setParsedUrls(next);
    setUrlInput(next.map(u => u.url).join('\n'));
  };

  // ── Import All ───────────────────────────────────────────────────────────

  const handleImportAll = async () => {
    if (parsedUrls.length === 0) return;

    setIsImporting(true);
    importAbort.current = new AbortController();

    // Mark all as importing
    setParsedUrls(prev => prev.map(u => ({ ...u, status: 'importing' as const })));

    try {
      if (importFn) {
        // Real import: call the provided function
        const urls = parsedUrls.map(u => u.url);
        const result = await importFn(urls);

        setParsedUrls(prev =>
          prev.map(u => ({
            ...u,
            status: result.processedItems.find(
              p => p.queueId === u.id || result.queueItems.find(q => (q.raw as string) === u.url)
            )
              ? 'done'
              : 'failed',
          }))
        );

        onImportComplete(result.queueItems, result.processedItems);
      } else {
        // Demo mode: simulate progressive import with mock data
        const total = parsedUrls.length;
        for (let i = 0; i < total; i++) {
          if (importAbort.current?.signal.aborted) break;

          await new Promise(r => setTimeout(r, 600 + Math.random() * 400));

          setParsedUrls(prev =>
            prev.map((u, idx) =>
              idx === i ? { ...u, status: 'done' as const } : u
            )
          );
          setImportProgress(Math.round(((i + 1) / total) * 100));
        }

        // Use demo data if provided
        if (demoQueueItems && demoProcessedItems) {
          onImportComplete(demoQueueItems, demoProcessedItems);
        }
      }
    } catch (err) {
      setParsedUrls(prev =>
        prev.map(u =>
          u.status === 'importing'
            ? { ...u, status: 'failed' as const, errorMessage: String(err) }
            : u
        )
      );
    } finally {
      setIsImporting(false);
    }
  };

  // ── Counts by platform ───────────────────────────────────────────────────

  const platformCounts: Partial<Record<SourcePlatform, number>> = {};
  parsedUrls.forEach(u => {
    if (u.platform) {
      platformCounts[u.platform] = (platformCounts[u.platform] ?? 0) + 1;
    }
  });

  const allDone = parsedUrls.length > 0 && parsedUrls.every(u => u.status === 'done');
  const hasUrls = parsedUrls.length > 0;

  return (
    <div className="space-y-6" data-testid="multi-source-import">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Import from multiple sources</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Paste URLs from Instagram, YouTube, TikTok -- one per line. We'll import them all at once.
        </p>
      </div>

      {/* URL Textarea */}
      <div className="space-y-2">
        <Textarea
          data-testid="multi-source-textarea"
          placeholder={`https://www.instagram.com/reel/...\nhttps://www.youtube.com/watch?v=...\nhttps://www.tiktok.com/@user/video/...`}
          value={urlInput}
          onChange={e => handleUrlChange(e.target.value)}
          rows={5}
          className="resize-none font-mono text-sm"
          disabled={isImporting}
        />
        <div className="flex items-center gap-2">
          {typeof navigator !== 'undefined' && navigator.clipboard && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePaste}
              className="gap-2"
              disabled={isImporting}
            >
              <Clipboard className="w-4 h-4" />
              Paste from clipboard
            </Button>
          )}
          {hasUrls && !isImporting && (
            <span className="text-xs text-muted-foreground ml-auto">
              {parsedUrls.length} URL{parsedUrls.length !== 1 ? 's' : ''} detected
            </span>
          )}
        </div>
      </div>

      {/* Platform summary badges */}
      {hasUrls && (
        <div className="flex flex-wrap gap-2" data-testid="platform-badges">
          {(Object.entries(platformCounts) as [SourcePlatform, number][]).map(
            ([platform, count]) => (
              <Badge
                key={platform}
                variant="secondary"
                className={cn('gap-1.5 px-2.5 py-1', PLATFORM_BADGE_COLORS[platform])}
              >
                <PlatformIcon platform={platform} className="w-3.5 h-3.5" />
                {count} {PLATFORM_LABELS[platform]}
              </Badge>
            )
          )}
          {parsedUrls.some(u => !u.platform) && (
            <Badge variant="secondary" className="gap-1.5 px-2.5 py-1">
              {parsedUrls.filter(u => !u.platform).length} Unknown
            </Badge>
          )}
        </div>
      )}

      {/* URL list with status */}
      {hasUrls && (
        <div className="space-y-1.5" data-testid="url-list">
          {parsedUrls.map(parsed => (
            <div
              key={parsed.id}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors',
                parsed.status === 'done' && 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
                parsed.status === 'failed' && 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
                parsed.status === 'importing' && 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
                parsed.status === 'idle' && 'border-border bg-muted/30'
              )}
            >
              {parsed.platform && (
                <PlatformIcon platform={parsed.platform} className="w-4 h-4 shrink-0" />
              )}

              <span className="flex-1 truncate font-mono text-xs">{parsed.url}</span>

              {parsed.status === 'importing' && (
                <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
              )}
              {parsed.status === 'done' && (
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              )}
              {parsed.status === 'failed' && (
                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
              )}
              {parsed.status === 'idle' && !isImporting && (
                <button
                  onClick={() => removeUrl(parsed.id)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  aria-label="Remove URL"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Progress bar during import */}
      {isImporting && (
        <div className="space-y-2" data-testid="import-progress">
          <Progress value={importProgress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            Importing... {importProgress}%
          </p>
        </div>
      )}

      {/* Import All button */}
      <Button
        data-testid="import-all-button"
        className="w-full"
        size="lg"
        onClick={handleImportAll}
        disabled={!hasUrls || isImporting || allDone}
      >
        {isImporting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Importing {parsedUrls.length} source{parsedUrls.length !== 1 ? 's' : ''}...
          </>
        ) : allDone ? (
          <>
            <CheckCircle className="w-4 h-4 mr-2" />
            All imported -- building workout...
          </>
        ) : (
          `Import All (${parsedUrls.length} source${parsedUrls.length !== 1 ? 's' : ''})`
        )}
      </Button>
    </div>
  );
}
