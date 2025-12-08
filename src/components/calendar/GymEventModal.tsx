import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { CalendarEvent, WorkoutType, EventStatus } from '../../types/calendar';
import { format } from 'date-fns';
import { Dumbbell, MapPin, User, Calendar, Clock, Repeat } from 'lucide-react';

interface GymEventModalProps {
  open: boolean;
  event: CalendarEvent | null;
  defaultData?: { date?: string; startTime?: string } | null;
  onSave: (event: Partial<CalendarEvent>) => void;
  onClose: () => void;
  userLocation?: {
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

// Gym locations in the area (can be customized based on user's location)
const GYM_LOCATIONS = [
  { id: 'equinox-fidi', name: 'Equinox FiDi', address: '14 Wall St, New York, NY' },
  { id: 'equinox-tribeca', name: 'Equinox Tribeca', address: '97 Greenwich St, New York, NY' },
  { id: 'lifetime-sky', name: 'Life Time Sky', address: '10 Hudson Yards, New York, NY' },
  { id: 'crunch-soho', name: 'Crunch Fitness SoHo', address: '54 E Houston St, New York, NY' },
  { id: 'orangetheory-fidi', name: 'Orangetheory FiDi', address: '180 Maiden Ln, New York, NY' },
  { id: 'barry\'s-tribeca', name: 'Barry\'s Bootcamp Tribeca', address: '53 Murray St, New York, NY' },
  { id: 'solidcore-soho', name: '[solidcore] SoHo', address: '411 W Broadway, New York, NY' },
  { id: 'rumble-noho', name: 'Rumble NoHo', address: '28 Bond St, New York, NY' },
  { id: 'tone-house', name: 'Tone House', address: '52 Wooster St, New York, NY' },
  { id: 'custom', name: 'Other Gym (Custom)', address: '' },
];

// Trainer options (can be expanded)
const TRAINERS = [
  { id: 'none', name: 'No Trainer' },
  { id: 'john-smith', name: 'John Smith (Strength)' },
  { id: 'sarah-jones', name: 'Sarah Jones (HIIT)' },
  { id: 'mike-chen', name: 'Mike Chen (Mobility)' },
  { id: 'emma-davis', name: 'Emma Davis (Pilates)' },
  { id: 'custom', name: 'Other Trainer (Custom)' },
];

// Class types
const CLASS_TYPES: { value: WorkoutType; label: string; description: string }[] = [
  { value: 'strength', label: 'Strength Training', description: 'Weights, resistance training' },
  { value: 'class', label: 'Fitness Class', description: 'Group fitness, HIIT, spin' },
  { value: 'mobility', label: 'Mobility/Stretching', description: 'Yoga, pilates, stretching' },
  { value: 'hyrox', label: 'HYROX Training', description: 'Race prep, functional fitness' },
  { value: 'recovery', label: 'Recovery', description: 'Light activity, foam rolling' },
];

// Recurrence options
const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Every weekday (Mon-Fri)' },
  { value: 'weekly', label: 'Weekly on this day' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom (select days)' },
];

// Days of week for custom recurrence
const DAYS_OF_WEEK = [
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
  { value: 'SU', label: 'Sun' },
];

export function GymEventModal({ open, event, defaultData, onSave, onClose, userLocation }: GymEventModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [classType, setClassType] = useState<WorkoutType>('class');
  const [gymLocation, setGymLocation] = useState('');
  const [customGym, setCustomGym] = useState('');
  const [trainer, setTrainer] = useState('none');
  const [customTrainer, setCustomTrainer] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isAnchor, setIsAnchor] = useState(false);
  const [notes, setNotes] = useState('');

  // Filter gyms based on user location
  // If no location is set, show all NYC gyms (default)
  // If location is set and is NYC, show NYC gyms
  // If location is set and is NOT NYC, only show custom gym option
  const hasLocation = userLocation && (userLocation.city || userLocation.state || userLocation.zipCode);
  const isUserInNYC = hasLocation &&
    userLocation.city?.toLowerCase().includes('new york') &&
    userLocation.state?.toUpperCase() === 'NY';

  let filteredGymLocations = !hasLocation || isUserInNYC
    ? GYM_LOCATIONS
    : [{ id: 'custom', name: 'Other Gym (Custom)', address: '' }];

  // If editing an existing event with a gym that's not in the filtered list, include it
  if (gymLocation && gymLocation !== 'custom' && !filteredGymLocations.find(g => g.id === gymLocation)) {
    const currentGym = GYM_LOCATIONS.find(g => g.id === gymLocation);
    if (currentGym) {
      filteredGymLocations = [currentGym, ...filteredGymLocations];
    }
  }

  useEffect(() => {
    if (open) {
      if (event) {
        setTitle(event.title);
        setDate(event.date);
        setStartTime(event.start_time?.substring(0, 5) || '09:00');
        setEndTime(event.end_time?.substring(0, 5) || '10:00');
        setClassType(event.type);
        setGymLocation(event.json_payload?.gym_location || '');
        setCustomGym(event.json_payload?.custom_gym || '');
        setTrainer(event.json_payload?.trainer || 'none');
        setCustomTrainer(event.json_payload?.custom_trainer || '');
        setIsAnchor(event.is_anchor || false);
        setNotes(event.json_payload?.notes || '');

        // Parse recurrence rule
        if (event.recurrence_rule) {
          const rule = event.recurrence_rule;
          if (rule.includes('DAILY')) {
            setRecurrence('daily');
          } else if (rule.includes('BYDAY=MO,TU,WE,TH,FR')) {
            setRecurrence('weekdays');
          } else if (rule.includes('WEEKLY')) {
            const match = rule.match(/BYDAY=([A-Z,]+)/);
            if (match) {
              const days = match[1].split(',');
              if (days.length > 1) {
                setRecurrence('custom');
                setSelectedDays(days);
              } else {
                setRecurrence('weekly');
              }
            } else {
              setRecurrence('weekly');
            }
          } else if (rule.includes('INTERVAL=2')) {
            setRecurrence('biweekly');
          } else if (rule.includes('MONTHLY')) {
            setRecurrence('monthly');
          }
        }
      } else {
        setTitle('');
        setDate(defaultData?.date || format(new Date(), 'yyyy-MM-dd'));
        setStartTime(defaultData?.startTime?.substring(0, 5) || '09:00');
        setEndTime('10:00');
        setClassType('class');
        setGymLocation('');
        setCustomGym('');
        setTrainer('none');
        setCustomTrainer('');
        setRecurrence('none');
        setSelectedDays([]);
        setIsAnchor(false);
        setNotes('');
      }
    }
  }, [open, event, defaultData]);

  const handleDayToggle = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const buildRecurrenceRule = (): string | undefined => {
    if (recurrence === 'none') return undefined;

    switch (recurrence) {
      case 'daily':
        return 'RRULE:FREQ=DAILY';
      case 'weekdays':
        return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
      case 'weekly':
        return 'RRULE:FREQ=WEEKLY';
      case 'biweekly':
        return 'RRULE:FREQ=WEEKLY;INTERVAL=2';
      case 'monthly':
        return 'RRULE:FREQ=MONTHLY';
      case 'custom':
        if (selectedDays.length === 0) return undefined;
        return `RRULE:FREQ=WEEKLY;BYDAY=${selectedDays.join(',')}`;
      default:
        return undefined;
    }
  };

  const handleSave = () => {
    const selectedGym = GYM_LOCATIONS.find(g => g.id === gymLocation);
    const selectedTrainerObj = TRAINERS.find(t => t.id === trainer);

    const eventData: Partial<CalendarEvent> = {
      title: title || `${selectedGym?.name || customGym || 'Gym'} - ${CLASS_TYPES.find(t => t.value === classType)?.label}`,
      date,
      start_time: startTime ? `${startTime}:00` : undefined,
      end_time: endTime ? `${endTime}:00` : undefined,
      type: classType,
      source: 'gym_manual_sync',
      status: 'planned' as EventStatus,
      is_anchor: isAnchor || trainer !== 'none',
      recurrence_rule: buildRecurrenceRule(),
      json_payload: {
        gym_location: gymLocation,
        gym_name: selectedGym?.name || customGym,
        gym_address: selectedGym?.address,
        custom_gym: gymLocation === 'custom' ? customGym : undefined,
        trainer: trainer,
        trainer_name: trainer === 'custom' ? customTrainer : selectedTrainerObj?.name,
        custom_trainer: trainer === 'custom' ? customTrainer : undefined,
        class_type: classType,
        notes: notes,
      },
    };

    onSave(eventData);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5" />
              {event ? 'Edit Gym Event' : 'Add Gym Event (Manual)'}
            </div>
          </DialogTitle>
          <DialogDescription>
            Add a gym class or training session with trainer, location, and recurring options.
          </DialogDescription>
        </DialogHeader>

        {/* User Location Display */}
        {hasLocation && (
          <div className="bg-muted/50 border border-border rounded-lg p-3 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Your Location</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {[userLocation.city, userLocation.state, userLocation.zipCode].filter(Boolean).join(', ')}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {isUserInNYC
                  ? 'Showing gyms in your area'
                  : 'We currently have gym listings for NYC only. Use "Other Gym" to add your local gym.'}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-5 py-4">
          {/* Class Type */}
          <div className="space-y-2">
            <Label>Class Type</Label>
            <Select value={classType} onValueChange={(value) => setClassType(value as WorkoutType)}>
              <SelectTrigger>
                <SelectValue>
                  {CLASS_TYPES.find(t => t.value === classType)?.label || 'Select class type...'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CLASS_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex flex-col gap-0.5 py-1">
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gym Location */}
          <div className="space-y-2">
            <Label htmlFor="gym-location">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Gym Location
              </div>
            </Label>
            <Select value={gymLocation} onValueChange={setGymLocation}>
              <SelectTrigger>
                <SelectValue>
                  {filteredGymLocations.find(g => g.id === gymLocation)?.name || 'Select a gym...'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {filteredGymLocations.map(gym => (
                  <SelectItem key={gym.id} value={gym.id}>
                    <div className="flex flex-col gap-0.5 py-1">
                      <div className="font-medium">{gym.name}</div>
                      {gym.address && <div className="text-xs text-muted-foreground">{gym.address}</div>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {gymLocation === 'custom' && (
              <Input
                placeholder="Enter gym name"
                value={customGym}
                onChange={(e) => setCustomGym(e.target.value)}
              />
            )}
          </div>

          {/* Trainer */}
          <div className="space-y-2">
            <Label htmlFor="trainer">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Trainer
              </div>
            </Label>
            <Select value={trainer} onValueChange={setTrainer}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRAINERS.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {trainer === 'custom' && (
              <Input
                placeholder="Enter trainer name"
                value={customTrainer}
                onChange={(e) => setCustomTrainer(e.target.value)}
              />
            )}
          </div>

          {/* Title (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Title (Optional)
              <span className="text-xs text-muted-foreground ml-2">
                Auto-generated if left blank
              </span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Upper Body with John, HIIT Class"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date
                </div>
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Start
                </div>
              </Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Recurrence */}
          <div className="space-y-2">
            <Label>
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                Repeat
              </div>
            </Label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {recurrence === 'custom' && (
              <div className="space-y-2 pt-2">
                <Label className="text-xs">Select days to repeat</Label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS_OF_WEEK.map(day => (
                    <Badge
                      key={day.value}
                      variant={selectedDays.includes(day.value) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => handleDayToggle(day.value)}
                    >
                      {day.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Anchor Workout */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-anchor"
              checked={isAnchor || trainer !== 'none'}
              onCheckedChange={(checked) => setIsAnchor(checked as boolean)}
              disabled={trainer !== 'none'}
            />
            <Label
              htmlFor="is-anchor"
              className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Mark as key workout (anchor)
              {trainer !== 'none' && (
                <span className="text-xs text-muted-foreground ml-2">
                  (Auto-enabled for trainer sessions)
                </span>
              )}
            </Label>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this session..."
              className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!gymLocation && !customGym}>
            {event ? 'Update' : 'Create'} Event
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
