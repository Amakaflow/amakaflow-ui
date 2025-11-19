import { TrainerDistribution } from './TrainerDistribution';
import { Switch } from './ui/switch';
import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  Download, 
  Copy, 
  Check, 
  Send, 
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Calendar,
  CalendarPlus,
  X,
  Trash2,
  Activity
} from 'lucide-react';
import { ExportFormats, ValidationResponse } from '../types/workout';
import { DeviceId } from '../lib/devices';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner@2.0.3';
import { Calendar as CalendarComponent } from './ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { isAccountConnectedSync } from '../lib/linked-accounts';

interface PublishExportProps {
  exports: ExportFormats;
  validation?: ValidationResponse;
  sources: string[];
  onStartNew?: () => void;
  selectedDevice?: DeviceId;
  userMode?: 'individual' | 'trainer';
}

export function PublishExport({ exports, validation, sources, onStartNew, selectedDevice = 'garmin', userMode = 'individual' }: PublishExportProps) {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [scheduledDates, setScheduledDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [recurringType, setRecurringType] = useState<'none' | 'daily' | 'weekly' | 'custom'>('none');
  const [recurringCount, setRecurringCount] = useState<number>(1);
  const [autoEnhanceStrava, setAutoEnhanceStrava] = useState(false);
  const stravaConnected = isAccountConnectedSync('strava');

  const copyToClipboard = async (text: string, format: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(format);
      toast.success(`${format.toUpperCase()} copied to clipboard`);
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const sendToDevice = (platform: string) => {
    toast.success(`Syncing to ${platform}...`, {
      description: 'This would connect to your device in production'
    });
  };

  // Add scheduled date
  const addScheduledDate = () => {
    if (!selectedDate) return;

    const newDates: Date[] = [selectedDate];

    // Handle recurring workouts
    if (recurringType === 'daily') {
      for (let i = 1; i < recurringCount; i++) {
        const nextDate = new Date(selectedDate);
        nextDate.setDate(nextDate.getDate() + i);
        newDates.push(nextDate);
      }
    } else if (recurringType === 'weekly') {
      for (let i = 1; i < recurringCount; i++) {
        const nextDate = new Date(selectedDate);
        nextDate.setDate(nextDate.getDate() + (i * 7));
        newDates.push(nextDate);
      }
    }

    setScheduledDates([...scheduledDates, ...newDates]);
    setSelectedDate(undefined);
    setRecurringType('none');
    setRecurringCount(1);
    
    toast.success(`Added ${newDates.length} workout${newDates.length > 1 ? 's' : ''} to calendar`);
  };

  // Remove scheduled date
  const removeScheduledDate = (index: number) => {
    const newDates = scheduledDates.filter((_, i) => i !== index);
    setScheduledDates(newDates);
    toast.success('Removed scheduled workout');
  };

  // Sync workouts with schedule
  const syncWithSchedule = () => {
    if (scheduledDates.length === 0) {
      toast.error('Please add at least one scheduled date');
      return;
    }
    
    toast.success(`Syncing ${scheduledDates.length} workout${scheduledDates.length > 1 ? 's' : ''} to ${deviceExport.deviceName}...`, {
      description: `Scheduled for ${scheduledDates.map(d => d.toLocaleDateString()).join(', ')}`
    });
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Check if device supports scheduling
  const supportsScheduling = selectedDevice === 'garmin' || selectedDevice === 'apple';

  // Get device-specific export data
  const getDeviceExport = () => {
    switch (selectedDevice) {
      case 'garmin':
        return {
          title: 'Garmin Connect Export',
          description: 'YAML format for Garmin watches (Fenix, Forerunner, etc.)',
          format: 'YAML',
          content: exports.yaml,
          filename: 'workout.yaml',
          deviceName: 'Garmin'
        };
      case 'apple':
        return {
          title: 'Apple Watch Export',
          description: 'PLIST format for Apple Watch and Fitness app',
          format: 'PLIST',
          content: exports.plist,
          filename: 'workout.plist',
          deviceName: 'Apple Watch'
        };
      case 'zwift':
        return {
          title: 'Zwift Export',
          description: 'ZWO format for Zwift cycling and running workouts',
          format: 'ZWO',
          content: exports.zwo,
          filename: 'workout.zwo',
          deviceName: 'Zwift'
        };
      default:
        // For all other devices, use a generic format
        return {
          title: `${selectedDevice.charAt(0).toUpperCase() + selectedDevice.slice(1)} Export`,
          description: `Workout export for ${selectedDevice}`,
          format: 'JSON',
          content: exports.yaml, // Default to YAML content
          filename: `workout.${selectedDevice}.txt`,
          deviceName: selectedDevice.charAt(0).toUpperCase() + selectedDevice.slice(1)
        };
    }
  };

  const deviceExport = getDeviceExport();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2">Publish & Export</h2>
        <p className="text-muted-foreground">
          Download or sync your workout to {deviceExport.deviceName}
        </p>
      </div>

      {/* Summary */}
      {validation && (
        <Card>
          <CardHeader>
            <CardTitle>Export Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-2xl">{validation.validated_exercises.length}</span>
                </div>
                <div className="text-sm text-muted-foreground">Validated</div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <span className="text-2xl">{validation.needs_review.length}</span>
                </div>
                <div className="text-sm text-muted-foreground">Needs Review</div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-2xl">{validation.unmapped_exercises.length}</span>
                </div>
                <div className="text-sm text-muted-foreground">Unmapped</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Formats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sync to {deviceExport.deviceName}</CardTitle>
              <CardDescription>
                Your workout is ready to be synced to your {deviceExport.deviceName} device
              </CardDescription>
            </div>
            <Badge variant="secondary">{deviceExport.format}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-enhance Strava toggle - Only show if Strava is connected */}
          {stravaConnected && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-orange-600" />
                  <Label className="cursor-pointer">Auto-enhance Strava when synced</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Automatically add structured workout description to your Strava activity after sync
                </p>
              </div>
              <Switch
                checked={autoEnhanceStrava}
                onCheckedChange={(checked) => {
                  setAutoEnhanceStrava(checked);
                  if (checked) {
                    toast.success('Auto-enhance enabled for Strava');
                  }
                }}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => copyToClipboard(deviceExport.content, deviceExport.format.toLowerCase())}
              className="flex-1"
            >
              {copiedFormat === deviceExport.format.toLowerCase() ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Copy className="w-4 h-4 mr-2" />
              )}
              Copy {deviceExport.format}
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadFile(deviceExport.content, deviceExport.filename)}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button
              onClick={() => sendToDevice(deviceExport.deviceName)}
              className="flex-1"
            >
              <Send className="w-4 h-4 mr-2" />
              Sync to {deviceExport.deviceName}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trainer Distribution - Only for trainers */}
      {userMode === 'trainer' && (
        <TrainerDistribution workoutTitle={sources[0]?.split(':')[1] || 'Workout'} />
      )}

      {/* Workout Scheduling - Only for Garmin and Apple */}
      {supportsScheduling && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Schedule Workout
                </CardTitle>
                <CardDescription>
                  Add this workout to your {deviceExport.deviceName} calendar
                  {selectedDevice === 'garmin' && ' or TrainingPeaks'}
                </CardDescription>
              </div>
              {scheduledDates.length > 0 && (
                <Badge variant="secondary">
                  {scheduledDates.length} scheduled
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Select Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      {selectedDate ? formatDate(selectedDate) : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Recurring</Label>
                <Select value={recurringType} onValueChange={(value: any) => setRecurringType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">One-time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Recurring Count */}
            {recurringType !== 'none' && (
              <div className="space-y-2">
                <Label>Number of occurrences</Label>
                <Select 
                  value={recurringCount.toString()} 
                  onValueChange={(value) => setRecurringCount(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6, 7, 8, 10, 12].map(num => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} times
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Add Button */}
            <Button
              onClick={addScheduledDate}
              disabled={!selectedDate}
              className="w-full"
              variant="outline"
            >
              <CalendarPlus className="w-4 h-4 mr-2" />
              Add to Schedule
            </Button>

            {/* Scheduled Dates List */}
            {scheduledDates.length > 0 && (
              <div className="space-y-2">
                <Label>Scheduled Dates ({scheduledDates.length})</Label>
                <ScrollArea className="h-32 w-full rounded-md border p-2">
                  <div className="space-y-2">
                    {scheduledDates
                      .sort((a, b) => a.getTime() - b.getTime())
                      .map((date, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                        >
                          <span>{formatDate(date)}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeScheduledDate(idx)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
                </ScrollArea>

                {/* Sync with Schedule Button */}
                <Button
                  onClick={syncWithSchedule}
                  className="w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Sync {scheduledDates.length} Workout{scheduledDates.length > 1 ? 's' : ''} to Calendar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Provenance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Workout Provenance
          </CardTitle>
          <CardDescription>
            Original sources used to create this workout
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sources.map((source, idx) => (
              <div key={idx} className="p-3 bg-muted rounded-lg text-sm break-all">
                {source}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Start New Workout */}
      {onStartNew && (
        <div className="flex justify-center pt-4 pb-8">
          <Button
            size="lg"
            variant="outline"
            onClick={onStartNew}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Start New Workout
          </Button>
        </div>
      )}
    </div>
  );
}