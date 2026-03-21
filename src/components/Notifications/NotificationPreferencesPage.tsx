/**
 * Notification preferences page with toggle switches for each notification
 * type and quiet hours configuration.
 *
 * AMA-1132: Push notifications — workout reminders, sync alerts, conflict warnings.
 */

import { Bell, Clock, Dumbbell, RefreshCw, AlertTriangle, Activity, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { NotificationPreferences } from '../../hooks/useNotifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationPreferencesPageProps {
  preferences: NotificationPreferences | null;
  onToggle: (key: keyof Omit<NotificationPreferences, 'user_id' | 'quiet_hours_start' | 'quiet_hours_end'>, value: boolean) => void;
  onQuietHoursChange: (start: string, end: string) => void;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Notification type descriptors
// ---------------------------------------------------------------------------

const NOTIFICATION_ITEMS = [
  {
    key: 'workout_reminders' as const,
    label: 'Workout Reminders',
    description: '60 min before scheduled workouts',
    example: 'Your interval run is in 1 hour. Already on your Garmin.',
    icon: Dumbbell,
    color: 'text-blue-500',
  },
  {
    key: 'sync_alerts' as const,
    label: 'Sync Alerts',
    description: 'When new sessions are pulled from connected devices',
    example: 'Stryd — 3 new sessions pulled',
    icon: RefreshCw,
    color: 'text-green-500',
  },
  {
    key: 'conflict_warnings' as const,
    label: 'Conflict Warnings',
    description: 'When hard sessions are scheduled too close together',
    example: 'Hard lower + hyrox within 48h — want to adjust?',
    icon: AlertTriangle,
    color: 'text-amber-500',
  },
  {
    key: 'readiness_alerts' as const,
    label: 'Readiness Alerts',
    description: 'When readiness score suggests swapping sessions',
    example: 'Low readiness (38) — consider swapping today\'s hard session',
    icon: Activity,
    color: 'text-red-500',
  },
  {
    key: 'weekly_summary' as const,
    label: 'Weekly Summary',
    description: 'End-of-week training recap',
    example: 'This week: 5/6 sessions, 6h 30min, streak: 12 days',
    icon: BarChart3,
    color: 'text-purple-500',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationPreferencesPage({
  preferences,
  onToggle,
  onQuietHoursChange,
  isLoading = false,
}: NotificationPreferencesPageProps) {
  const prefs = preferences ?? {
    user_id: '',
    workout_reminders: true,
    sync_alerts: true,
    conflict_warnings: true,
    readiness_alerts: true,
    weekly_summary: true,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto" data-testid="notification-preferences-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Bell className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
          <p className="text-sm text-muted-foreground">
            Choose which notifications you want to receive
          </p>
        </div>
      </div>

      {/* Notification toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notification Types</CardTitle>
          <CardDescription>
            Enable or disable specific notification categories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {NOTIFICATION_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            const enabled = prefs[item.key] as boolean;

            return (
              <div key={item.key}>
                {idx > 0 && <Separator className="my-4" />}
                <div
                  className="flex items-start justify-between gap-4 py-2"
                  data-testid={`notification-toggle-${item.key}`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`mt-0.5 ${item.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Label className="text-sm font-medium leading-none cursor-pointer">
                        {item.label}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.description}
                      </p>
                      <Badge variant="secondary" className="mt-2 text-xs font-normal max-w-full truncate">
                        {item.example}
                      </Badge>
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => onToggle(item.key, checked)}
                    disabled={isLoading}
                    aria-label={`Toggle ${item.label}`}
                    data-testid={`switch-${item.key}`}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Quiet hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            No notifications will be sent during this window
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="flex items-center gap-4"
            data-testid="quiet-hours-section"
          >
            <div className="flex items-center gap-2">
              <Label htmlFor="quiet-start" className="text-sm whitespace-nowrap">
                From
              </Label>
              <Input
                id="quiet-start"
                type="time"
                value={prefs.quiet_hours_start}
                onChange={(e) =>
                  onQuietHoursChange(e.target.value, prefs.quiet_hours_end)
                }
                className="w-32"
                disabled={isLoading}
                data-testid="quiet-hours-start"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="quiet-end" className="text-sm whitespace-nowrap">
                To
              </Label>
              <Input
                id="quiet-end"
                type="time"
                value={prefs.quiet_hours_end}
                onChange={(e) =>
                  onQuietHoursChange(prefs.quiet_hours_start, e.target.value)
                }
                className="w-32"
                disabled={isLoading}
                data-testid="quiet-hours-end"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
