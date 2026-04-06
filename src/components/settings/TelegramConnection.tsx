import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { MessageCircle, ExternalLink, Copy, Check } from 'lucide-react';

interface TelegramConnectionProps {
  isConnected?: boolean;
  telegramUsername?: string;
  botUrl?: string;
}

export function TelegramConnection({
  isConnected = false,
  telegramUsername,
  botUrl = 'https://t.me/AmakaFlowBot',
}: TelegramConnectionProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(botUrl);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in insecure contexts — silent fallback
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-500" />
            Telegram
          </CardTitle>
          <Badge
            variant={isConnected ? 'default' : 'secondary'}
            className={isConnected ? 'bg-green-500' : ''}
          >
            {isConnected ? 'Connected' : 'Not connected'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Connected as <strong>@{telegramUsername || 'unknown'}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              You can chat with your AI coach, import workouts, and approve plan changes directly from
              Telegram.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect Telegram to chat with your AI coach, get workout reminders, and approve plan
              changes — all from your phone.
            </p>

            <div className="space-y-2">
              <p className="text-xs font-medium">How to connect:</p>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Open the AmakaFlow bot on Telegram</li>
                <li>
                  Send{' '}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">/link</code> followed by
                  your account code
                </li>
                <li>You'll see a confirmation message when connected</li>
              </ol>
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="gap-2" asChild>
                <a href={botUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-3.5 h-3.5" />
                  Open AmakaFlow Bot
                  <ExternalLink className="w-3 h-3" />
                </a>
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={handleCopy}>
                {copied ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? 'Copied!' : 'Copy link'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
