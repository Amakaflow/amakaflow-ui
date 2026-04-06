"use client";

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Link2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

type ImportState = 'idle' | 'importing' | 'success' | 'error';

export function QuickImport() {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<ImportState>('idle');
  const [result, setResult] = useState<string>('');

  const isValidUrl = /https?:\/\/(www\.)?(youtube\.com|youtu\.be|instagram\.com|tiktok\.com)/i.test(url);

  const handleImport = async () => {
    if (!isValidUrl) return;
    setState('importing');
    setResult('');
    try {
      const { sendMessage } = await import('../api/clients/orchestrator');
      const response = await sendMessage(url, 'web');
      if (response?.intent === 'import_workout') {
        setState('success');
        setResult(response.response || 'Workout imported successfully!');
      } else {
        setState('success');
        setResult(response?.response || 'Processed!');
      }
    } catch {
      setState('error');
      setResult('Import failed. Please try again or use the full import page.');
    }
  };

  const handleReset = () => {
    setUrl('');
    setState('idle');
    setResult('');
  };

  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Quick Import</span>
          <span className="text-xs text-muted-foreground">— paste a link, get a workout</span>
        </div>

        {state === 'idle' || state === 'error' ? (
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && isValidUrl && handleImport()}
              placeholder="Paste YouTube, Instagram, or TikTok link..."
              className="flex-1 text-sm"
            />
            <Button
              size="sm"
              onClick={handleImport}
              disabled={!isValidUrl}
            >
              Import
            </Button>
          </div>
        ) : state === 'importing' ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Extracting workout structure...
          </div>
        ) : (
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>{result}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={handleReset}>
              Import another
            </Button>
          </div>
        )}

        {state === 'error' && result && (
          <p className="text-xs text-destructive mt-2">{result}</p>
        )}

        {url && !isValidUrl && url.length > 5 && (
          <p className="text-xs text-muted-foreground mt-1">
            Supported: YouTube, Instagram, TikTok links
          </p>
        )}
      </CardContent>
    </Card>
  );
}
