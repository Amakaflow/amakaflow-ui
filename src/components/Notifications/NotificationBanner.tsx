/**
 * In-app banner prompting the user to enable push notifications.
 *
 * AMA-1132: Shows when permission is 'default' (not yet asked) and can
 * be dismissed. Does not show if permission is already granted or denied.
 */

import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '../ui/button';

interface NotificationBannerProps {
  permission: NotificationPermission | 'unsupported';
  onEnable: () => Promise<void>;
}

export function NotificationBanner({ permission, onEnable }: NotificationBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [enabling, setEnabling] = useState(false);

  // Only show for 'default' (never asked) permission state
  if (permission !== 'default' || dismissed) {
    return null;
  }

  const handleEnable = async () => {
    setEnabling(true);
    try {
      await onEnable();
    } finally {
      setEnabling(false);
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
      data-testid="notification-banner"
    >
      <div className="flex items-center gap-3">
        <Bell className="h-5 w-5 text-primary shrink-0" />
        <p className="text-sm">
          <span className="font-medium">Enable notifications</span>{' '}
          <span className="text-muted-foreground">
            to get workout reminders, sync alerts, and conflict warnings
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          onClick={handleEnable}
          disabled={enabling}
          data-testid="enable-notifications-btn"
        >
          {enabling ? 'Enabling...' : 'Enable'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss notification banner"
          data-testid="dismiss-banner-btn"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
