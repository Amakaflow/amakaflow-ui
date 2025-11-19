import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { 
  Search, 
  Watch, 
  Bike, 
  Dumbbell, 
  CheckCircle2, 
  Clock,
  Loader2,
  X
} from 'lucide-react';
import { getWorkoutsFromAPI, SavedWorkout } from '../lib/workout-api';
import { useClerkUser } from '../lib/clerk-auth';
import { DeviceId } from '../lib/devices';
import { toast } from 'sonner@2.0.3';

interface WorkoutSelectorProps {
  selectedDevice: DeviceId;
  onSelectWorkout: (workout: SavedWorkout) => void;
  onClose?: () => void;
}

export function WorkoutSelector({ selectedDevice, onSelectWorkout, onClose }: WorkoutSelectorProps) {
  const { user: clerkUser } = useClerkUser();
  const profileId = clerkUser?.id || '';
  
  const [workouts, setWorkouts] = useState<SavedWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterExported, setFilterExported] = useState<boolean | null>(null);
  const [filterDevice, setFilterDevice] = useState<DeviceId | 'all'>(selectedDevice);

  useEffect(() => {
    loadWorkouts();
  }, [profileId, filterDevice, filterExported]);

  const loadWorkouts = async () => {
    if (!profileId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const fetchedWorkouts = await getWorkoutsFromAPI({
        profile_id: profileId,
        device: filterDevice !== 'all' ? filterDevice : undefined,
        is_exported: filterExported !== null ? filterExported : undefined,
        limit: 100,
      });
      setWorkouts(fetchedWorkouts);
    } catch (error: any) {
      console.error('Failed to load workouts:', error);
      toast.error(`Failed to load workouts: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkouts = workouts.filter(workout => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const title = workout.title?.toLowerCase() || '';
      const description = workout.description?.toLowerCase() || '';
      if (!title.includes(query) && !description.includes(query)) {
        return false;
      }
    }
    return true;
  });

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown date';
    }
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'garmin':
      case 'apple':
        return <Watch className="w-4 h-4" />;
      case 'zwift':
        return <Bike className="w-4 h-4" />;
      default:
        return <Dumbbell className="w-4 h-4" />;
    }
  };

  const getDeviceName = (device: string) => {
    const names: Record<string, string> = {
      garmin: 'Garmin',
      apple: 'Apple Watch',
      zwift: 'Zwift',
    };
    return names[device] || device;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Select Saved Workout</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a saved workout to sync to {getDeviceName(selectedDevice)}
            </p>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search workouts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Device</Label>
            <Select value={filterDevice} onValueChange={(value: any) => setFilterDevice(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                <SelectItem value="garmin">Garmin</SelectItem>
                <SelectItem value="apple">Apple Watch</SelectItem>
                <SelectItem value="zwift">Zwift</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Export Status</Label>
            <Select 
              value={filterExported === null ? 'all' : filterExported ? 'exported' : 'not-exported'} 
              onValueChange={(value) => {
                if (value === 'all') setFilterExported(null);
                else setFilterExported(value === 'exported');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="not-exported">Not Exported</SelectItem>
                <SelectItem value="exported">Exported</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Workouts List */}
        {filteredWorkouts.length === 0 ? (
          <div className="text-center py-12">
            <Dumbbell className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
            <h3 className="text-lg mb-2">No workouts found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery || filterExported !== null || filterDevice !== 'all'
                ? 'Try adjusting your filters'
                : 'Save a workout first to see it here'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-3 pr-4">
              {filteredWorkouts.map((workout) => (
                <div
                  key={workout.id}
                  className="p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => onSelectWorkout(workout)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">
                          {workout.title || `Workout ${new Date(workout.created_at).toLocaleDateString()}`}
                        </h4>
                        <Badge variant="secondary" className="text-xs">
                          {getDeviceIcon(workout.device)}
                          <span className="ml-1">{getDeviceName(workout.device)}</span>
                        </Badge>
                        {workout.is_exported && (
                          <Badge variant="outline" className="text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Exported
                          </Badge>
                        )}
                      </div>
                      {workout.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {workout.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(workout.created_at)}
                        </div>
                        {workout.exported_at && (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Exported {formatDate(workout.exported_at)}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectWorkout(workout);
                      }}
                    >
                      Select
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

