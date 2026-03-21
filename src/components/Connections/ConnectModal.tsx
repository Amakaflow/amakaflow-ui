import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Loader2 } from 'lucide-react';
import type { PlatformConnection, PlatformId, CredentialsPayload } from './types';

interface ConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: PlatformConnection | null;
  onConnectCredentials: (id: PlatformId, credentials: CredentialsPayload) => Promise<void>;
  onConnectOAuth: (id: PlatformId) => Promise<void>;
}

export function ConnectModal({
  open,
  onOpenChange,
  platform,
  onConnectCredentials,
  onConnectOAuth,
}: ConnectModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!platform) return null;

  const isCredentials = platform.authMethod === 'credentials';

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConnectCredentials(platform.id, { email, password });
      setEmail('');
      setPassword('');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthConnect = async () => {
    setLoading(true);
    try {
      await onConnectOAuth(platform.id);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="connect-modal" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect to {platform.name}</DialogTitle>
          <DialogDescription>
            {isCredentials
              ? `Enter your ${platform.name} credentials to connect your account.`
              : `You will be redirected to ${platform.name} to authorize AmakaFlow.`}
          </DialogDescription>
        </DialogHeader>

        {isCredentials ? (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="connect-email">Email</Label>
              <Input
                id="connect-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="connect-password">Password</Label>
              <Input
                id="connect-password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !email || !password}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/50 text-sm text-muted-foreground">
              <p>
                Clicking the button below will open {platform.name}&apos;s authorization page in a new
                window. After approving access, you&apos;ll be redirected back to AmakaFlow.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleOAuthConnect} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  `Connect with ${platform.name}`
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
