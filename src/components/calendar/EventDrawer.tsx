import { 
  Sheet, 
  SheetContent, 
  SheetDescription,
  SheetHeader, 
  SheetTitle 
} from '../ui/sheet';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { CalendarEvent } from '../../types/calendar';
import { format, parseISO } from 'date-fns';
import { Clock, Calendar, Tag, Activity, AlertCircle, Edit, Trash } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { useState } from 'react';

interface EventDrawerProps {
  open: boolean;
  event: CalendarEvent | null;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
  onClose: () => void;
}

export function EventDrawer({ open, event, onEdit, onDelete, onClose }: EventDrawerProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (!event) return null;

  const handleDelete = () => {
    onDelete(event.id);
    setShowDeleteDialog(false);
  };

  const typeColors = {
    run: 'bg-blue-100 text-blue-900 border-blue-300',
    strength: 'bg-purple-100 text-purple-900 border-purple-300',
    hyrox: 'bg-red-100 text-red-900 border-red-300',
    class: 'bg-green-100 text-green-900 border-green-300',
    home_workout: 'bg-yellow-100 text-yellow-900 border-yellow-300',
    mobility: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    recovery: 'bg-gray-100 text-gray-900 border-gray-300',
  };

  const statusColors = {
    planned: 'bg-orange-100 text-orange-900',
    completed: 'bg-green-100 text-green-900',
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent className="sm:max-w-[440px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{event.title}</SheetTitle>
            <SheetDescription>
              Event Details
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(event)}
                className="flex-1"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="flex-1 text-destructive hover:text-destructive"
              >
                <Trash className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>

            {/* Date & Time */}
            <Card className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Date</div>
                  <div className="text-sm text-muted-foreground">
                    {format(parseISO(event.date), 'EEEE, MMMM d, yyyy')}
                  </div>
                </div>
              </div>

              {event.start_time && (
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Time</div>
                    <div className="text-sm text-muted-foreground">
                      {event.start_time.substring(0, 5)}
                      {event.end_time && ` - ${event.end_time.substring(0, 5)}`}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Type & Status */}
            <Card className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Tag className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium mb-2">Workout Type</div>
                  <Badge 
                    variant="outline" 
                    className={`capitalize ${typeColors[event.type]}`}
                  >
                    {event.type.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Activity className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium mb-2">Source</div>
                  <Badge variant="secondary" className="capitalize">
                    {event.source.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium mb-2">Status</div>
                  <Badge className={`capitalize ${statusColors[event.status]}`}>
                    {event.status}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Notes */}
            {event.json_payload?.notes && (
              <Card className="p-4">
                <div className="text-sm font-medium mb-2">Notes</div>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {event.json_payload.notes}
                </div>
              </Card>
            )}

            {/* JSON Payload (Debug) */}
            {event.json_payload && Object.keys(event.json_payload).length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  View JSON Payload
                </summary>
                <Card className="p-3 mt-2">
                  <pre className="whitespace-pre-wrap overflow-auto text-xs">
                    {JSON.stringify(event.json_payload, null, 2)}
                  </pre>
                </Card>
              </details>
            )}

            {/* Metadata */}
            {event.created_at && event.updated_at && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Created: {format(parseISO(event.created_at), 'MMM d, yyyy h:mm a')}</div>
                <div>Updated: {format(parseISO(event.updated_at), 'MMM d, yyyy h:mm a')}</div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{event.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
