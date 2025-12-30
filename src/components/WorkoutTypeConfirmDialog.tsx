// AMA-213: Workout type confirmation dialog
// Shows detected workout type and allows user to confirm or change it

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dumbbell,
  Repeat,
  Zap,
  Heart,
  Play,
  Shuffle,
  Check,
  X,
} from 'lucide-react';
import { WorkoutType } from '../types/workout';
import {
  WORKOUT_TYPE_LABELS,
  WORKOUT_TYPE_DEFAULTS,
  getWorkoutTypeDefaultsDescription,
  getConfidenceDescription,
} from '../lib/workoutTypeDefaults';

interface WorkoutTypeConfirmDialogProps {
  open: boolean;
  detectedType: WorkoutType;
  confidence: number;
  onConfirm: (type: WorkoutType, applyDefaults: boolean) => void;
  onSkip: () => void;
}

// Map workout types to Lucide icons
const WORKOUT_TYPE_ICONS: Record<WorkoutType, React.ReactNode> = {
  strength: <Dumbbell className="w-5 h-5" />,
  circuit: <Repeat className="w-5 h-5" />,
  hiit: <Zap className="w-5 h-5" />,
  cardio: <Heart className="w-5 h-5" />,
  follow_along: <Play className="w-5 h-5" />,
  mixed: <Shuffle className="w-5 h-5" />,
};

// Confidence badge colors
function getConfidenceBadgeVariant(confidence: number): 'default' | 'secondary' | 'outline' {
  if (confidence >= 0.8) return 'default';
  if (confidence >= 0.6) return 'secondary';
  return 'outline';
}

export function WorkoutTypeConfirmDialog({
  open,
  detectedType,
  confidence,
  onConfirm,
  onSkip,
}: WorkoutTypeConfirmDialogProps) {
  const [selectedType, setSelectedType] = useState<WorkoutType>(detectedType);
  const [applyDefaults, setApplyDefaults] = useState(true);

  // Get defaults description for selected type
  const defaultsDescription = getWorkoutTypeDefaultsDescription(selectedType);
  const defaults = WORKOUT_TYPE_DEFAULTS[selectedType];

  const handleConfirm = () => {
    onConfirm(selectedType, applyDefaults);
  };

  // All available workout types
  const allWorkoutTypes: WorkoutType[] = [
    'strength',
    'circuit',
    'hiit',
    'cardio',
    'follow_along',
    'mixed',
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onSkip()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Workout Type Detected
          </DialogTitle>
          <DialogDescription>
            Based on the workout content, we detected the workout type. You can confirm or change it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Detected type with confidence */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                {WORKOUT_TYPE_ICONS[detectedType]}
              </div>
              <div>
                <p className="font-medium">{WORKOUT_TYPE_LABELS[detectedType]}</p>
                <p className="text-xs text-muted-foreground">Detected workout type</p>
              </div>
            </div>
            <Badge variant={getConfidenceBadgeVariant(confidence)}>
              {Math.round(confidence * 100)}% {getConfidenceDescription(confidence)}
            </Badge>
          </div>

          {/* Type selector (if user wants to change) */}
          <div className="space-y-2">
            <Label>Workout Type</Label>
            <Select
              value={selectedType}
              onValueChange={(value: WorkoutType) => setSelectedType(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allWorkoutTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      {WORKOUT_TYPE_ICONS[type]}
                      <span>{WORKOUT_TYPE_LABELS[type]}</span>
                      {type === detectedType && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Detected
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recommended settings preview */}
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-3 bg-muted/30">
              <div className="flex items-center gap-3">
                <Switch
                  id="apply-defaults"
                  checked={applyDefaults}
                  onCheckedChange={setApplyDefaults}
                />
                <Label htmlFor="apply-defaults" className="text-sm font-medium cursor-pointer">
                  Apply recommended settings
                </Label>
              </div>
            </div>

            {applyDefaults && defaultsDescription.length > 0 && (
              <div className="p-3 space-y-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">
                  These settings will be applied to your workout:
                </p>
                <ul className="space-y-1">
                  {defaultsDescription.map((desc, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500" />
                      {desc}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!applyDefaults && (
              <div className="p-3 border-t">
                <p className="text-sm text-muted-foreground">
                  No settings will be applied. You can configure warm-up and rest manually.
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onSkip} className="flex-1">
              <X className="w-4 h-4 mr-2" />
              Skip
            </Button>
            <Button onClick={handleConfirm} className="flex-1">
              <Check className="w-4 h-4 mr-2" />
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
