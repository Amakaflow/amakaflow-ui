/**
 * Standalone preview entry point for CreateAIWorkout.
 * Served at /create-ai-preview.html during dev.
 *
 * AMA-914/915/916: Renders the Create with AI page in demo mode for Playwright screenshots.
 */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import './index.css';
import { CreateAIWorkout } from './components/CreateAIWorkout';
import type { WorkoutStructure } from './types/workout';

function CreateAIPreview() {
  const [generatedWorkout, setGeneratedWorkout] = useState<WorkoutStructure | null>(null);

  return (
    <div className="dark bg-background text-foreground min-h-screen p-6">
      {!generatedWorkout ? (
        <CreateAIWorkout
          onWorkoutGenerated={(workout) => setGeneratedWorkout(workout)}
        />
      ) : (
        <div className="max-w-2xl mx-auto space-y-4" data-testid="generated-workout-view">
          <h2 className="text-xl font-semibold">Generated Workout</h2>
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="font-medium" data-testid="generated-title">{generatedWorkout.title}</p>
            <p className="text-sm text-muted-foreground">
              {generatedWorkout.blocks?.length || 0} blocks
            </p>
            {generatedWorkout.blocks?.map((block, i) => (
              <div key={i} className="pl-4 border-l-2 border-muted py-1">
                <p className="text-sm font-medium">{block.label}</p>
                <p className="text-xs text-muted-foreground">
                  {block.structure} - {block.exercises?.length || 0} exercises
                </p>
              </div>
            ))}
          </div>
          <button
            className="text-sm text-primary underline"
            onClick={() => setGeneratedWorkout(null)}
            data-testid="back-to-create"
          >
            Back to Create
          </button>
        </div>
      )}
    </div>
  );
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(<CreateAIPreview />);
}
