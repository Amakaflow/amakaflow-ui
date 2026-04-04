import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { ScrollArea } from '../ui/scroll-area';
import {
  Calendar,
  Link2,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Settings,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { ConnectedCalendar } from '../../types/calendar';
import { toast } from 'sonner';

interface ConnectedCalendarsModalProps {
  open: boolean;
  onClose: () => void;
  onSelectCalendar?: (calendar: ConnectedCalendar) => void;
  calendars: ConnectedCalendar[];
  onCreateCalendar: (calendar: { name: string; type: string; integration_type: string; is_workout_calendar: boolean; ics_url: string; color?: string }) => Promise<any>;
  onDeleteCalendar: (calendarId: string) => Promise<void>;
  onSyncCalendar: (calendarId: string) => Promise<any>;
}

type AddFlowType = 'runna' | 'ics_custom' | 'apple' | 'google' | 'outlook' | null;

export function ConnectedCalendarsModal({
  open,
  onClose,
  onSelectCalendar,
  calendars,
  onCreateCalendar,
  onDeleteCalendar,
  onSyncCalendar
}: ConnectedCalendarsModalProps) {
  const [showAddFlow, setShowAddFlow] = useState<AddFlowType>(null);
  const [icsFormData, setIcsFormData] = useState({
    name: '',
    icsUrl: '',
    isWorkoutCalendar: true
  });
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  const handleViewEvents = (calendar: ConnectedCalendar) => {
    if (onSelectCalendar) {
      onSelectCalendar(calendar);
      onClose();
    }
  };

  const handleAddCalendar = (type: AddFlowType) => {
    setShowAddFlow(type);
    if (type === 'runna') {
      setIcsFormData({
        name: 'Runna',
        icsUrl: '',
        isWorkoutCalendar: true
      });
    } else if (type === 'ics_custom') {
      setIcsFormData({
        name: '',
        icsUrl: '',
        isWorkoutCalendar: true
      });
    }
  };

  const handleConnectIcs = async () => {
    try {
      const calendarType = showAddFlow === 'runna' ? 'runna' : 'ics_custom';
      await onCreateCalendar({
        name: icsFormData.name,
        type: calendarType,
        integration_type: 'ics_url',
        is_workout_calendar: icsFormData.isWorkoutCalendar,
        ics_url: icsFormData.icsUrl,
        color: calendarType === 'runna' ? '#FF6B6B' : undefined
      });
      toast.success('Calendar connected successfully');
      setShowAddFlow(null);
      setIcsFormData({ name: '', icsUrl: '', isWorkoutCalendar: true });
    } catch (error) {
      console.error('Error connecting calendar:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to connect calendar');
    }
  };

  const handleSyncCalendar = async (calendarId: string) => {
    try {
      setIsSyncing(calendarId);
      const result = await onSyncCalendar(calendarId);
      toast.success(`Synced ${result.events_created} new events, updated ${result.events_updated}`);
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sync calendar');
    } finally {
      setIsSyncing(null);
    }
  };

  const handleOAuthConnect = (provider: 'google' | 'outlook' | 'apple') => {
    const label = provider === 'google' ? 'Google' : provider === 'outlook' ? 'Outlook' : 'Apple';
    toast.info(`${label} Calendar OAuth is not available yet. Use the ICS URL option to connect your calendar.`);
  };

  const getCalendarIcon = (type: ConnectedCalendar['type']) => {
    return <Calendar className="w-5 h-5" />;
  };

  const getIntegrationLabel = (type: ConnectedCalendar['integration_type']) => {
    switch (type) {
      case 'ics_url':
        return 'Connected via ICS URL';
      case 'oauth':
        return 'Connected via OAuth';
      case 'os_integration':
        return 'OS-level integration';
    }
  };

  const getSyncLabel = (calendar: ConnectedCalendar) => {
    if (calendar.integration_type === 'os_integration') {
      return 'Real-time (read-only)';
    }
    if (calendar.last_sync) {
      const now = new Date();
      const lastSync = new Date(calendar.last_sync);
      const diffMs = now.getTime() - lastSync.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      return `${Math.floor(diffHours / 24)} day${diffHours >= 48 ? 's' : ''} ago`;
    }
    return 'Never synced';
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Connected Calendars</DialogTitle>
          <DialogDescription>
            Choose from your subscribed calendars or add a new one.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 py-4 pr-4">
            {/* Section A - Your Calendars */}
            {calendars.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Your Calendars</h3>
                {calendars.map((calendar) => (
                  <Card key={calendar.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          {getCalendarIcon(calendar.type)}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{calendar.name}</span>
                            {calendar.is_workout_calendar && (
                              <Badge variant="secondary" className="text-xs">
                                Workout Calendar
                              </Badge>
                            )}
                            {calendar.sync_status === 'active' ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <div>{getIntegrationLabel(calendar.integration_type)}</div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Last sync: {getSyncLabel(calendar)}
                            </div>
                            {calendar.workouts_this_week !== undefined && (
                              <div>Workouts this week: {calendar.workouts_this_week}</div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSyncCalendar(calendar.id)}
                          disabled={isSyncing === calendar.id || !calendar.ics_url}
                          className="gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${isSyncing === calendar.id ? 'animate-spin' : ''}`} />
                          {isSyncing === calendar.id ? 'Syncing...' : 'Sync'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 gap-1"
                          onClick={() => handleViewEvents(calendar)}
                        >
                          View Events
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No connected calendars yet.</p>
              </div>
            )}

            {/* Section B - Add New Calendar */}
            {!showAddFlow ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Add a New Calendar</h3>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="outline"
                    className="justify-start gap-2 h-auto py-3"
                    onClick={() => handleAddCalendar('runna')}
                  >
                    <Calendar className="w-4 h-4" />
                    Add Runna Calendar
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-2 h-auto py-3"
                    onClick={() => handleAddCalendar('ics_custom')}
                  >
                    <Link2 className="w-4 h-4" />
                    Add via ICS Link
                    <span className="text-xs text-muted-foreground ml-auto">
                      TrainingPeaks, FinalSurge, Strava, custom
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-2 h-auto py-3 opacity-60"
                    aria-disabled="true"
                    onClick={() => handleOAuthConnect('apple')}
                  >
                    <Calendar className="w-4 h-4" />
                    Add Apple Calendar
                    <span className="text-xs text-muted-foreground ml-auto">Not available yet</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-2 h-auto py-3 opacity-60"
                    aria-disabled="true"
                    onClick={() => handleOAuthConnect('google')}
                  >
                    <Calendar className="w-4 h-4" />
                    Add Google Calendar
                    <span className="text-xs text-muted-foreground ml-auto">Not available yet</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-2 h-auto py-3 opacity-60"
                    aria-disabled="true"
                    onClick={() => handleOAuthConnect('outlook')}
                  >
                    <Calendar className="w-4 h-4" />
                    Add Outlook Calendar
                    <span className="text-xs text-muted-foreground ml-auto">Not available yet</span>
                  </Button>
                </div>
              </div>
            ) : (
              /* ICS Add Flow */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    {showAddFlow === 'runna' ? 'Add Runna Calendar' : 'Add Calendar via ICS Link'}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddFlow(null)}
                  >
                    Cancel
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="calendar-name">Calendar Name</Label>
                    <Input
                      id="calendar-name"
                      value={icsFormData.name}
                      onChange={(e) => setIcsFormData({ ...icsFormData, name: e.target.value })}
                      placeholder={showAddFlow === 'runna' ? 'Runna' : 'My Training Calendar'}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ics-url">ICS URL</Label>
                    <Input
                      id="ics-url"
                      value={icsFormData.icsUrl}
                      onChange={(e) => setIcsFormData({ ...icsFormData, icsUrl: e.target.value })}
                      placeholder="https://example.com/calendar.ics"
                    />
                    {showAddFlow === 'runna' && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        Find your ICS URL in Runna Settings → Calendar Export
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-0.5">
                      <Label htmlFor="workout-calendar">Mark as workout calendar</Label>
                      <p className="text-xs text-muted-foreground">
                        Only workout calendars appear in Workout Sources list
                      </p>
                    </div>
                    <Switch
                      id="workout-calendar"
                      checked={icsFormData.isWorkoutCalendar}
                      onCheckedChange={(checked) => 
                        setIcsFormData({ ...icsFormData, isWorkoutCalendar: checked })
                      }
                    />
                  </div>

                  <Button 
                    onClick={handleConnectIcs}
                    className="w-full"
                    disabled={!icsFormData.name || !icsFormData.icsUrl}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Connect Calendar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
