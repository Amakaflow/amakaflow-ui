import { Footprints, Watch, Bike, Loader2, RefreshCw, Unplug, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { PlatformConnection, PlatformId } from './types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Footprints,
  Watch,
  Bike,
};

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

interface PlatformCardProps {
  connection: PlatformConnection;
  onConnect: (id: PlatformId) => void;
  onDisconnect: (id: PlatformId) => void;
  onSyncNow: (id: PlatformId) => void;
  onRetry: (id: PlatformId) => void;
}

export function PlatformCard({
  connection,
  onConnect,
  onDisconnect,
  onSyncNow,
  onRetry,
}: PlatformCardProps) {
  const { id, name, icon, color, status, lastSyncedAt, errorMessage, username } = connection;
  const Icon = ICON_MAP[icon] || Footprints;

  const isConnected = status === 'connected';
  const isSyncing = status === 'syncing';
  const isError = status === 'error';
  const isDisconnected = status === 'disconnected';

  const borderColor = isDisconnected
    ? 'border-border'
    : isError
      ? 'border-red-400'
      : `border-${color}`;

  return (
    <Card
      data-testid={`platform-card-${id}`}
      className={`transition-all ${isDisconnected ? 'opacity-75' : ''} ${borderColor}`}
      style={
        !isDisconnected && !isError
          ? { borderColor: `var(--color-${color}, currentColor)` }
          : isError
            ? { borderColor: 'rgb(248 113 113)' }
            : undefined
      }
    >
      <CardContent className="flex items-center gap-4 p-4">
        {/* Platform icon */}
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            isDisconnected ? 'bg-muted' : `bg-${color}/10`
          }`}
          style={
            !isDisconnected
              ? { backgroundColor: `color-mix(in srgb, var(--color-${color}, #f97316) 10%, transparent)` }
              : undefined
          }
        >
          <Icon
            className={`w-6 h-6 ${isDisconnected ? 'text-muted-foreground' : `text-${color}`}`}
            style={!isDisconnected ? { color: `var(--color-${color}, #f97316)` } : undefined}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{name}</span>
            {isConnected && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Connected
              </Badge>
            )}
            {isSyncing && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Syncing...
              </Badge>
            )}
            {isError && (
              <Badge variant="destructive">
                <AlertCircle className="w-3 h-3 mr-1" />
                Error
              </Badge>
            )}
          </div>
          {username && (isConnected || isSyncing || isError) && (
            <p className="text-sm text-muted-foreground truncate">{username}</p>
          )}
          {lastSyncedAt && (isConnected || isError) && (
            <p className="text-xs text-muted-foreground">
              Last synced: {formatRelativeTime(lastSyncedAt)}
            </p>
          )}
          {isError && errorMessage && (
            <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isDisconnected && (
            <Button size="sm" onClick={() => onConnect(id)}>
              Connect
            </Button>
          )}
          {isConnected && (
            <>
              <Button size="sm" variant="outline" onClick={() => onSyncNow(id)}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Sync Now
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDisconnect(id)}>
                <Unplug className="w-4 h-4" />
              </Button>
            </>
          )}
          {isSyncing && (
            <Button size="sm" variant="outline" disabled>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              Syncing...
            </Button>
          )}
          {isError && (
            <>
              <Button size="sm" variant="outline" onClick={() => onRetry(id)}>
                Retry
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDisconnect(id)}>
                <Unplug className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
