/**
 * Standalone preview for WorkoutTypeDetectionBanner.
 * Served at /workout-type-detection-preview.html during dev.
 *
 * AMA-208: Shows the smart workout type detection banner with confirmation UI.
 */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import './index.css';
import { WorkoutTypeDetectionBanner } from './components/WorkoutTypeDetectionBanner';
import { WorkoutTypeConfirmDialog } from './components/WorkoutTypeConfirmDialog';
import { detectWorkoutTypeFromText } from './lib/detectWorkoutType';
import type { WorkoutType } from './types/workout';
import type { WorkoutTypeDetectionResult } from './lib/detectWorkoutType';

const SAMPLE_TEXTS: { label: string; text: string }[] = [
  {
    label: 'Strength Workout',
    text: '4x8 Bench Press @ RPE 8, 90s rest\n4x8 Barbell Row, 90s rest\n3x12 Lateral Raises\n3x12 Bicep Curls',
  },
  {
    label: 'HIIT Workout',
    text: 'Tabata: 20s work / 10s rest\nBurpees, Jump Squats, Mountain Climbers, High Knees\n8 rounds each',
  },
  {
    label: 'Running Plan',
    text: '5k tempo run at race pace\n4x800m intervals with 2min jog recovery\nCool down 10min easy jog',
  },
  {
    label: 'Yoga Flow',
    text: 'Sun Salutation A x5\nWarrior I, Warrior II, Triangle Pose\nDownward Dog, Pigeon Pose\nSavasana 5 min',
  },
];

function DetectionPreview() {
  const [detection, setDetection] = useState<WorkoutTypeDetectionResult | null>(null);
  const [confirmed, setConfirmed] = useState<WorkoutType | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const handleDetect = (text: string) => {
    const result = detectWorkoutTypeFromText(text);
    setDetection(result);
    setConfirmed(null);
  };

  return (
    <div className="dark bg-background text-foreground min-h-screen p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Workout Type Detection (AMA-208)</h1>
        <p className="text-muted-foreground">
          Click a sample to detect its workout type.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {SAMPLE_TEXTS.map((sample) => (
            <button
              key={sample.label}
              className="p-3 rounded-lg border text-left hover:bg-muted/50 transition-colors"
              onClick={() => handleDetect(sample.text)}
              data-testid={`sample-${sample.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <p className="font-medium text-sm">{sample.label}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{sample.text}</p>
            </button>
          ))}
        </div>

        {detection && !confirmed && (
          <WorkoutTypeDetectionBanner
            detection={detection}
            onConfirm={(type) => setConfirmed(type)}
            onDismiss={() => setDetection(null)}
          />
        )}

        {confirmed && (
          <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950/30" data-testid="confirmed-type">
            <p className="text-sm font-medium text-green-900 dark:text-green-100">
              Workout type confirmed: {confirmed}
            </p>
          </div>
        )}

        <div className="border-t pt-4">
          <h2 className="text-lg font-semibold mb-3">Dialog variant</h2>
          <button
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
            onClick={() => setShowDialog(true)}
            data-testid="open-type-dialog"
          >
            Open Type Confirm Dialog
          </button>
          <WorkoutTypeConfirmDialog
            open={showDialog}
            detectedType="strength"
            confidence={0.85}
            onConfirm={() => setShowDialog(false)}
            onSkip={() => setShowDialog(false)}
          />
        </div>
      </div>
    </div>
  );
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(<DetectionPreview />);
}
