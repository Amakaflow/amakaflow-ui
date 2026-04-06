import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Bell } from 'lucide-react';

interface Notification {
  id: string;
  type: 'approval' | 'reminder' | 'sync' | 'info';
  title: string;
  message: string;
  time: string;
  read: boolean;
  actionRequired?: boolean;
}

// Demo notifications for now — will be replaced with real orchestrator events
const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'approval',
    title: 'Rebalance Proposal',
    message: 'Your Thursday strength session was moved to Friday due to missed Wednesday workout.',
    time: '2 hours ago',
    read: false,
    actionRequired: true,
  },
  {
    id: '2',
    type: 'sync',
    title: 'Garmin Synced',
    message: 'Upper Body Strength pushed to your Garmin Fenix 8.',
    time: '4 hours ago',
    read: true,
  },
  {
    id: '3',
    type: 'reminder',
    title: 'Workout Time',
    message: 'Easy Run 5km is scheduled for now. Ready to start?',
    time: 'Just now',
    read: false,
  },
  {
    id: '4',
    type: 'info',
    title: 'Weekly Summary',
    message: 'You completed 4/5 sessions this week. Adherence: 80%.',
    time: 'Yesterday',
    read: true,
  },
];

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications] = useState(DEMO_NOTIFICATIONS);
  const unreadCount = notifications.filter(n => !n.read).length;

  const typeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'approval': return '\uD83D\uDD04';
      case 'reminder': return '\uD83D\uDD14';
      case 'sync': return '\u231A';
      case 'info': return '\uD83D\uDCCA';
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className="relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <Card className="absolute right-0 top-12 w-80 z-50 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Notifications</CardTitle>
              <Badge variant="secondary" className="text-xs">{unreadCount} new</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 border-b last:border-0 ${!n.read ? 'bg-primary/5' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm mt-0.5">{typeIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium truncate">{n.title}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{n.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    {n.actionRequired && (
                      <div className="flex gap-1.5 mt-2">
                        <Button size="sm" className="h-6 text-[10px] px-2">Approve</Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2">Dismiss</Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
