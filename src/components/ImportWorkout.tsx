/**
 * ImportWorkout — Standalone page for importing workouts from URLs.
 *
 * Users paste a YouTube, TikTok, Instagram, or Pinterest URL,
 * then see streaming pipeline progress and a workout preview.
 *
 * Part of AMA-567 Phase C: Import Pipelines
 */

import { useState } from 'react';
import { Download, Globe, CheckCircle2, Search, FileText, Library } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { StreamingWorkflow } from './StreamingWorkflow';
import { useStreamingPipeline } from '../hooks/useStreamingPipeline';
import type { StageConfig } from './ChatPanel/StageIndicator';
import { toast } from 'sonner';

const IMPORT_STAGE_CONFIG: StageConfig = {
  fetching: { icon: Globe, label: 'Fetching content' },
  extracting: { icon: Download, label: 'Extracting content' },
  parsing: { icon: FileText, label: 'Identifying exercises' },
  mapping: { icon: Library, label: 'Matching to library' },
  complete: { icon: CheckCircle2, label: 'Complete' },
};

const IMPORT_STAGES = ['fetching', 'extracting', 'parsing', 'mapping'];

const SUPPORTED_PLATFORMS = [
  { name: 'YouTube', domain: 'youtube.com', example: 'https://www.youtube.com/watch?v=...' },
  { name: 'TikTok', domain: 'tiktok.com', example: 'https://www.tiktok.com/@user/video/...' },
  { name: 'Instagram', domain: 'instagram.com', example: 'https://www.instagram.com/p/...' },
  { name: 'Pinterest', domain: 'pinterest.com', example: 'https://www.pinterest.com/pin/...' },
];

export function ImportWorkout() {
  const [url, setUrl] = useState('');
  const pipeline = useStreamingPipeline();

  const handleImport = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error('Please enter a URL to import from.');
      return;
    }

    try {
      new URL(trimmed);
    } catch {
      toast.error('Please enter a valid URL.');
      return;
    }

    pipeline.start('/api/workouts/import/stream', { url: trimmed });
  };

  const handleRetry = () => {
    handleImport();
  };

  const handleSave = () => {
    if (!pipeline.preview?.source_url) return;
    toast.info('Save coming soon — wiring to save endpoint in Phase D');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Download className="w-6 h-6 text-primary" />
          Import from URL
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste a workout video or post URL and we'll extract the exercises for you.
        </p>
      </div>

      {/* URL input form */}
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor="import-url">URL</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                id="import-url"
                type="url"
                placeholder="Paste a YouTube, TikTok, Instagram, or Pinterest URL..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && url.trim() && !pipeline.isStreaming) {
                    handleImport();
                  }
                }}
                disabled={pipeline.isStreaming}
                className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <Button
              onClick={handleImport}
              disabled={pipeline.isStreaming || !url.trim()}
              className="gap-2 shrink-0"
            >
              <Download className="w-4 h-4" />
              {pipeline.isStreaming ? 'Importing...' : 'Import'}
            </Button>
          </div>
        </div>

        {/* Supported platforms hint */}
        {!pipeline.isStreaming && !pipeline.preview && !pipeline.error && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Supported platforms:</p>
            <div className="grid grid-cols-2 gap-1">
              {SUPPORTED_PLATFORMS.map((p) => (
                <span key={p.name} className="truncate">
                  {p.name} — <span className="text-muted-foreground/70">{p.example}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Streaming progress + preview */}
      <StreamingWorkflow
        currentStage={pipeline.currentStage}
        completedStages={pipeline.completedStages}
        preview={pipeline.preview}
        isStreaming={pipeline.isStreaming}
        error={pipeline.error}
        onSave={pipeline.preview ? handleSave : undefined}
        onRetry={handleRetry}
        stageConfig={IMPORT_STAGE_CONFIG}
        stages={IMPORT_STAGES}
      />
    </div>
  );
}
