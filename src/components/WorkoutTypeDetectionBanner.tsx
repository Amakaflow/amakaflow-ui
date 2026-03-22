/**
 * AMA-208: Smart workout type detection with user confirmation.
 *
 * Shows a banner: "This looks like a Strength workout. Is that right?"
 * with a type selector to override.
 */

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import type { WorkoutType } from '../types/workout';
import { WORKOUT_TYPE_LABELS } from '../lib/workoutTypeDefaults';
import type { WorkoutTypeDetectionResult } from '../lib/detectWorkoutType';
import { getDetectionConfirmationMessage } from '../lib/detectWorkoutType';

interface WorkoutTypeDetectionBannerProps {
  detection: WorkoutTypeDetectionResult;
  onConfirm: (type: WorkoutType) => void;
  onDismiss: () => void;
}

const ALL_WORKOUT_TYPES: WorkoutType[] = [
  'strength', 'circuit', 'hiit', 'cardio', 'running', 'yoga', 'follow_along', 'mixed',
];

export function WorkoutTypeDetectionBanner({
  detection,
  onConfirm,
  onDismiss,
}: WorkoutTypeDetectionBannerProps) {
  const [selectedType, setSelectedType] = useState<WorkoutType>(detection.detectedType);
  const message = getDetectionConfirmationMessage(detection);

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
      data-testid="workout-type-detection-banner"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100" data-testid="detection-message">
          {message}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Select
            value={selectedType}
            onValueChange={(value) => setSelectedType(value as WorkoutType)}
          >
            <SelectTrigger className="w-44 h-8 text-xs" data-testid="type-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_WORKOUT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {WORKOUT_TYPE_LABELS[type] || type}
                  {type === detection.detectedType && ' (detected)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-xs">
            {Math.round(detection.confidence * 100)}% confidence
          </Badge>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={onDismiss}
          title="Dismiss"
          data-testid="dismiss-detection"
        >
          <X className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          className="h-8 gap-1"
          onClick={() => onConfirm(selectedType)}
          data-testid="confirm-detection"
        >
          <Check className="w-4 h-4" />
          Confirm
        </Button>
      </div>
    </div>
  );
}
