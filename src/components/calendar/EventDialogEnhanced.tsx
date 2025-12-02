import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { CalendarEvent, WorkoutType, WorkoutSource, EventStatus } from '../../types/calendar';
import { format } from 'date-fns';

interface EventDialogEnhancedProps {
  open: boolean;
  event: CalendarEvent | null;
  defaultData?: { date?: string; startTime?: string; source?: WorkoutSource } | null;
  onSave: (event: Partial<CalendarEvent>) => void;
  onClose: () => void;
}

export function EventDialogEnhanced({ open, event, defaultData, onSave, onClose }: EventDialogEnhancedProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (open) {
      if (event) {
        setTitle(event.title);
        setDate(event.date);
        setStartTime(event.start_time?.substring(0, 5) || '09:00');
        setEndTime(event.end_time?.substring(0, 5) || '10:00');
      } else {
        setTitle('');
        setDate(defaultData?.date || format(new Date(), 'yyyy-MM-dd'));
        setStartTime(defaultData?.startTime?.substring(0, 5) || '09:00');
        setEndTime('10:00');
      }
    } else {
      // Reset form when dialog closes
      setTitle('');
      setDate('');
      setStartTime('');
      setEndTime('');
    }
  }, [open, event, defaultData]);

  const handleSave = () => {
    const eventData: Partial<CalendarEvent> = {
      title,
      date,
      start_time: startTime ? `${startTime}:00` : undefined,
      end_time: endTime ? `${endTime}:00` : undefined,
      type: 'run' as WorkoutType,
      source: 'manual' as WorkoutSource,
      status: 'planned' as EventStatus,
    };
    onSave(eventData);
    onClose(); // Ensure dialog closes after save
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'New Event'}</DialogTitle>
          <DialogDescription>
            {event ? 'Modify the details of your workout event.' : 'Create a new workout event for your calendar.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Workout title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

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
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {event ? 'Update' : 'Create'} Event
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
