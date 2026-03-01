import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';

const INTEGRATIONS = [
  { name: 'Notion', description: 'Import workouts from Notion databases', icon: '📓' },
  { name: 'Strava', description: 'Pull activities from your Strava account', icon: '🚴' },
  { name: 'Garmin Connect', description: 'Import from Garmin workout library', icon: '⌚' },
  { name: 'FIT / TCX files', description: 'Upload Garmin or device export files', icon: '📁' },
  { name: 'Browser Clip Queue', description: 'URLs clipped via browser extension appear here', icon: '🔗' },
];

export function IntegrationsTab() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Connect external tools and services. Imported workouts flow into the same results screen.
      </p>
      {INTEGRATIONS.map(integration => (
        <Card key={integration.name} className="opacity-60 cursor-not-allowed">
          <CardContent className="flex items-center gap-4 p-4">
            <span className="text-2xl" role="img" aria-label={integration.name}>
              {integration.icon}
            </span>
            <div className="flex-1">
              <p className="font-medium text-sm">{integration.name}</p>
              <p className="text-xs text-muted-foreground">{integration.description}</p>
            </div>
            <Badge variant="secondary">Coming soon</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
