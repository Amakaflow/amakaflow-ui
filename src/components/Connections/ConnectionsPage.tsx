import { useState } from 'react';
import { ArrowLeft, Link2 } from 'lucide-react';
import { Button } from '../ui/button';
import { PlatformCard } from './PlatformCard';
import { ConnectModal } from './ConnectModal';
import { useConnections } from './hooks/useConnections';
import type { PlatformConnection, PlatformId } from './types';
import { TelegramConnection } from '../settings/TelegramConnection';

interface ConnectionsPageProps {
  onBack?: () => void;
}

export function ConnectionsPage({ onBack }: ConnectionsPageProps) {
  const {
    connections,
    connectWithCredentials,
    connectWithOAuth,
    disconnect,
    syncNow,
    retry,
  } = useConnections();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformConnection | null>(null);

  const handleConnect = (id: PlatformId) => {
    const platform = connections.find((c) => c.id === id);
    if (platform) {
      setSelectedPlatform(platform);
      setModalOpen(true);
    }
  };

  const connectedCount = connections.filter(
    (c) => c.status === 'connected' || c.status === 'syncing'
  ).length;

  return (
    <div data-testid="connections-page" className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Go back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="w-6 h-6" />
            Platform Connections
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your fitness platforms to sync workouts and activity data.
            {connectedCount > 0 && (
              <span className="ml-1 font-medium">
                {connectedCount} of {connections.length} connected
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Platform cards */}
      <div className="space-y-3">
        {connections.map((connection) => (
          <PlatformCard
            key={connection.id}
            connection={connection}
            onConnect={handleConnect}
            onDisconnect={disconnect}
            onSyncNow={syncNow}
            onRetry={retry}
          />
        ))}
      </div>

      {/* Telegram */}
      <TelegramConnection />

      {/* Connect Modal */}
      <ConnectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        platform={selectedPlatform}
        onConnectCredentials={connectWithCredentials}
        onConnectOAuth={connectWithOAuth}
      />
    </div>
  );
}
