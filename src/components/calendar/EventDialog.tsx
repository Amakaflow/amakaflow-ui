import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { CalendarEvent, WorkoutType, WorkoutSource, EventStatus } from '../../types/calendar';
import { format } from 'date-fns';

interface EventDialogProps {
  open: boolean;
  event: CalendarEvent | null;
  defaultData?: { date?: string; startTime?: string } | null;
  onSave: (event: Partial<CalendarEvent>) => void;
  onClose: () => void;
}

export function EventDialog({ open, event, defaultData, onSave, onClose }: EventDialogProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [type, setType] = useState<WorkoutType>('run');
  const [source, setSource] = useState<WorkoutSource>('manual');
  const [status, setStatus] = useState<EventStatus>('planned');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      if (event) {
        // Edit mode
        setTitle(event.title);
        setDate(event.date);
        setStartTime(event.start_time?.substring(0, 5) || '');
        setEndTime(event.end_time?.substring(0, 5) || '');
        setType(event.type);
        setSource(event.source);
        setStatus(event.status);
        setNotes(event.json_payload?.notes || '');
      } else {
        // Create mode
        setTitle('');
        setDate(defaultData?.date || format(new Date(), 'yyyy-MM-dd'));
        setStartTime(defaultData?.startTime?.substring(0, 5) || '09:00');
        setEndTime('10:00');
        setType('run');
        setSource('manual');
        setStatus('planned');
        setNotes('');
      }
    }
  }, [open, event, defaultData]);

  const handleSave = () => {
    const eventData: Partial<CalendarEvent> = {
      title,
      date,
      start_time: startTime ? `${startTime}:00` : undefined,
      end_time: endTime ? `${endTime}:00` : undefined,
      type,
      source,
      status,
      json_payload: notes ? { notes } : undefined,
    };

    onSave(eventData);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'New Event'}</DialogTitle>
          <DialogDescription>
            {event ? 'Update event details' : 'Create a new calendar event'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Morning Run"
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Workout Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Workout Type *</Label>
            <Select value={type} onValueChange={(value) => setType(value as WorkoutType)}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="run">Run</SelectItem>
                <SelectItem value="strength">Strength</SelectItem>
                <SelectItem value="hyrox">Hyrox</SelectItem>
                <SelectItem value="class">Class</SelectItem>
                <SelectItem value="home_workout">Home Workout</SelectItem>
                <SelectItem value="mobility">Mobility</SelectItem>
                <SelectItem value="recovery">Recovery</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Select value={source} onValueChange={(value) => setSource(value as WorkoutSource)}>
              <SelectTrigger id="source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="runna">Runna</SelectItem>
                <SelectItem value="gym_class">Gym Class</SelectItem>
                <SelectItem value="amaka">Amaka</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="garmin">Garmin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as EventStatus)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title || !date}>
            {event ? 'Update' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
