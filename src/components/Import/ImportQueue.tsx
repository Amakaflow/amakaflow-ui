import { useState, useRef } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { X, Plus, Image, FileText, Link, Clipboard } from 'lucide-react';
import { cn } from '../ui/utils';
import type { QueueItem } from '../../types/import';

interface ImportQueueProps {
  queue: QueueItem[];
  onQueueChange: (queue: QueueItem[]) => void;
}

function parseUrls(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function makeLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.slice(0, 40);
  } catch {
    return url.slice(0, 60);
  }
}

export function ImportQueue({ queue, onQueueChange }: ImportQueueProps) {
  const [urlInput, setUrlInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addUrls = () => {
    const urls = parseUrls(urlInput);
    if (urls.length === 0) return;
    const newItems: QueueItem[] = urls.map(url => ({
      id: crypto.randomUUID(),
      type: 'url' as const,
      label: makeLabel(url),
      raw: url,
    }));
    onQueueChange([...queue, ...newItems]);
    setUrlInput('');
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    const urls = parseUrls(text);
    if (urls.length > 0 && text.trim().startsWith('http')) {
      e.preventDefault();
      const newItems: QueueItem[] = urls.map(url => ({
        id: crypto.randomUUID(),
        type: 'url' as const,
        label: makeLabel(url),
        raw: url,
      }));
      onQueueChange([...queue, ...newItems]);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return;
      setUrlInput(text);
      const urls = parseUrls(text);
      if (urls.length > 0) {
        const newItems: QueueItem[] = urls.map(url => ({
          id: crypto.randomUUID(),
          type: 'url' as const,
          label: makeLabel(url),
          raw: url,
        }));
        onQueueChange([...queue, ...newItems]);
        setUrlInput('');
      }
    } catch {
      // Clipboard permission denied — silently ignore
    }
  };

  const remove = (id: string) => {
    onQueueChange(queue.filter(item => item.id !== id));
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newItems: QueueItem[] = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      type: file.type === 'application/pdf' ? ('pdf' as const) : ('image' as const),
      label: file.name,
      raw: file,
    }));
    onQueueChange([...queue, ...newItems]);
  };

  return (
    <div className="space-y-4">
      {/* URL input */}
      <div className="space-y-2">
        <Textarea
          placeholder="Paste URLs here — one per line, or comma-separated"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onPaste={handlePaste}
          rows={3}
          className="resize-none"
        />
        <div className="flex gap-2">
          <Button
            onClick={addUrls}
            disabled={urlInput.trim().length === 0}
            size="sm"
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add to queue
          </Button>
          {typeof navigator !== 'undefined' && navigator.clipboard && (
            <Button variant="outline" size="sm" onClick={pasteFromClipboard} className="gap-2">
              <Clipboard className="w-4 h-4" />
              Paste from clipboard
            </Button>
          )}
        </div>
      </div>

      {/* Image / PDF drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-border hover:bg-muted/30'
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        role="button"
        aria-label="Drop images or PDFs here"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
      >
        <Image className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drop images or PDFs here, or{' '}
          <span className="text-primary underline">browse</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG, HEIC, PDF</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* Queue list */}
      {queue.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {queue.length} item{queue.length !== 1 ? 's' : ''} queued
          </p>
          {queue.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 rounded-md border bg-muted/30 text-sm"
            >
              {item.type === 'pdf' ? (
                <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
              ) : item.type === 'image' ? (
                <Image className="w-4 h-4 shrink-0 text-muted-foreground" />
              ) : (
                <Link className="w-4 h-4 shrink-0 text-muted-foreground" />
              )}
              <span className="flex-1 truncate">{item.label}</span>
              <Badge variant="secondary" className="text-xs shrink-0">{item.type}</Badge>
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-auto"
                onClick={() => remove(item.id)}
                aria-label="remove"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
