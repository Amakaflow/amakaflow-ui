import { useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { X, Plus, Image, FileText, Link } from 'lucide-react';
import type { QueueItem } from '../../types/unified-import';

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
          rows={3}
          className="resize-none"
        />
        <Button
          onClick={addUrls}
          disabled={urlInput.trim().length === 0}
          size="sm"
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add to queue
        </Button>
      </div>

      {/* Image / PDF picker */}
      <div>
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <span>
              <Image className="w-4 h-4" />
              Add images / PDFs
            </span>
          </Button>
        </label>
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
