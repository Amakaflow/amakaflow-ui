/**
 * CreateAIWorkout — Standalone page for generating workouts with AI.
 *
 * Users describe a workout, optionally set difficulty/duration/equipment,
 * then click Generate to see streaming pipeline progress and a workout preview.
 */

import { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Slider } from './ui/slider';
import { StreamingWorkflow } from './StreamingWorkflow';
import { useStreamingPipeline } from '../hooks/useStreamingPipeline';
import { toast } from 'sonner';
import { isDemoMode } from '../lib/demo-mode';
import type { WorkoutStructure } from '../types/workout';
import type { PipelinePreview } from '../types/pipeline';

const EQUIPMENT_OPTIONS = [
  'Barbell',
  'Dumbbells',
  'Kettlebell',
  'Resistance Bands',
  'Pull-up Bar',
  'Cable Machine',
  'Bodyweight',
  'Smith Machine',
  'TRX',
  'Medicine Ball',
];

const PRESET_PROMPTS = [
  'Push Day',
  'Pull Day',
  'Leg Day',
  'Full Body',
  '30-min HIIT',
  'Core & Abs',
];

interface CreateAIWorkoutProps {
  onNavigate?: (view: 'calendar') => void;
  onWorkoutGenerated?: (workout: WorkoutStructure) => void;
}

export function CreateAIWorkout({ onNavigate, onWorkoutGenerated }: CreateAIWorkoutProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [isDemoGenerating, setIsDemoGenerating] = useState(false);

  const pipeline = useStreamingPipeline();
  const isDisabled = pipeline.isStreaming || isDemoGenerating;
  
  // Track previous streaming state to detect completion
  const wasStreamingRef = useRef(false);
  
  // When streaming completes and we have a preview, open the editor with the generated workout
  useEffect(() => {
    // Detect transition from streaming to not streaming
    if (wasStreamingRef.current && !pipeline.isStreaming && pipeline.preview && onWorkoutGenerated) {
      const workout = convertPreviewToWorkoutStructure(pipeline.preview, difficulty, durationMinutes);
      onWorkoutGenerated(workout);
    }
    wasStreamingRef.current = pipeline.isStreaming;
  }, [pipeline.isStreaming, pipeline.preview, onWorkoutGenerated, difficulty, durationMinutes]);

  const handleGenerate = () => {
    const trimmed = description.trim();
    if (!trimmed) {
      toast.error('Please describe the workout you want to create.');
      return;
    }

    if (isDemoMode && onWorkoutGenerated) {
      setIsDemoGenerating(true);
      setTimeout(() => {
        setIsDemoGenerating(false);
        onWorkoutGenerated(buildMockWorkout(title.trim() || trimmed, difficulty, durationMinutes, selectedEquipment));
      }, 1500);
      return;
    }

    const body: Record<string, unknown> = { description: trimmed };
    if (title.trim()) body.title = title.trim();
    if (difficulty) body.difficulty = difficulty;
    if (durationMinutes) body.duration_minutes = durationMinutes;
    if (selectedEquipment.length > 0) body.equipment = selectedEquipment;

    pipeline.start('/api/workouts/generate/stream', body);
  };

  const handleRetry = () => {
    handleGenerate();
  };

  const handleSave = () => {
    // Instead of showing success screen, open the workout in the editor
    if (pipeline.preview && onWorkoutGenerated) {
      const workout = convertPreviewToWorkoutStructure(pipeline.preview, difficulty, durationMinutes);
      onWorkoutGenerated(workout);
    }
  };

  const toggleEquipment = (item: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item],
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          Create with AI
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Describe the workout you want and AI will generate it for you.
        </p>
      </div>

      {/* Input form */}
      <div className="space-y-4 rounded-lg border bg-card p-4">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="workout-title">Workout Title <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="workout-title"
            placeholder="e.g., Monday Push Day"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isDisabled}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="workout-description">Describe Your Workout</Label>
          {/* Preset prompts */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PRESET_PROMPTS.map((preset) => (
              <Badge
                key={preset}
                variant={description === preset ? 'default' : 'outline'}
                className="cursor-pointer select-none"
                onClick={() => !isDisabled && setDescription(preset)}
              >
                {preset}
              </Badge>
            ))}
          </div>
          <Textarea
            id="workout-description"
            placeholder="e.g., Push day focusing on chest and shoulders, 4 exercises, intermediate level..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={isDisabled}
          />
        </div>

        {/* Difficulty */}
        <div className="space-y-2">
          <Label>Difficulty</Label>
          <Select
            value={difficulty}
            onValueChange={setDifficulty}
            disabled={isDisabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Duration slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Duration</Label>
            <span className="text-sm text-muted-foreground">{durationMinutes} min</span>
          </div>
          <Slider
            value={[durationMinutes]}
            onValueChange={([val]) => setDurationMinutes(val)}
            min={10}
            max={120}
            step={5}
            disabled={isDisabled}
          />
        </div>

        {/* Equipment multi-select */}
        <div className="space-y-2">
          <Label>Equipment <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT_OPTIONS.map((item) => (
              <Badge
                key={item}
                variant={selectedEquipment.includes(item) ? 'default' : 'outline'}
                className="cursor-pointer select-none"
                onClick={() => !isDisabled && toggleEquipment(item)}
              >
                {item}
              </Badge>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={isDisabled || !description.trim()}
          className="w-full gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {isDisabled ? 'Generating...' : 'Generate Workout'}
        </Button>
      </div>

      {/* Streaming progress + preview */}
      <StreamingWorkflow
        currentStage={pipeline.currentStage}
        completedStages={pipeline.completedStages}
        preview={pipeline.preview}
        isStreaming={pipeline.isStreaming}
        error={pipeline.error}
        onSave={pipeline.preview ? handleSave : undefined}
        onRetry={handleRetry}
      />
    </div>
  );
}

function buildMockWorkout(
  titleOrDescription: string,
  difficulty: string,
  durationMinutes: number,
  equipment: string[],
): WorkoutStructure {
  const title = titleOrDescription.length > 50
    ? titleOrDescription.slice(0, 50).trim() + '…'
    : titleOrDescription;

  const numSets = difficulty === 'beginner' ? 3 : difficulty === 'advanced' ? 5 : 4;
  const restSec = difficulty === 'beginner' ? 90 : difficulty === 'advanced' ? 60 : 75;
  const eq = equipment.length > 0 ? equipment : ['Bodyweight'];

  const makeExercise = (name: string, reps_range: string) => ({
    id: `mock-${Math.random().toString(36).slice(2)}`,
    name,
    sets: numSets,
    reps: null,
    reps_range,
    duration_sec: null,
    rest_sec: null,
    distance_m: null,
    distance_range: null,
    type: 'strength' as const,
  });

  const exercises = [
    makeExercise(`${eq[0]} Squat`, '10-12'),
    makeExercise(`${eq[0]} Press`, '8-10'),
    makeExercise('Plank', `${durationMinutes > 45 ? 60 : 30}s`),
    makeExercise(`${eq[eq.length - 1]} Row`, '10-12'),
  ];

  return {
    title,
    source: 'ai-generated',
    blocks: [
      {
        label: 'Main Block',
        structure: 'sets',
        sets: numSets,
        rest_between_sets_sec: restSec,
        exercises,
      },
    ],
  };
}

/**
 * Convert PipelinePreview to WorkoutStructure for editing in StructureWorkout editor.
 */
function convertPreviewToWorkoutStructure(
  preview: PipelinePreview,
  difficulty: string,
  durationMinutes: number
): WorkoutStructure {
  const title = preview.workout.name || 'AI Generated Workout';
  
  // Determine sets based on difficulty
  const numSets = difficulty === 'beginner' ? 3 : difficulty === 'advanced' ? 5 : 4;
  const restSec = difficulty === 'beginner' ? 90 : difficulty === 'advanced' ? 60 : 75;
  
  // Convert PipelineExercise to Exercise format
  const exercises = (preview.workout.exercises || []).map((exercise, idx) => ({
    id: `ai-${idx}-${Date.now()}`,
    name: exercise.name,
    sets: exercise.sets ?? numSets,
    reps: typeof exercise.reps === 'string' ? null : exercise.reps ?? null,
    reps_range: typeof exercise.reps === 'string' ? exercise.reps : null,
    duration_sec: null,
    rest_sec: null,
    distance_m: null,
    distance_range: null,
    type: ((exercise as any).type || 'strength') as any,
    notes: exercise.notes || undefined,
  }));
  
  return {
    title,
    source: 'ai-generated',
    blocks: [
      {
        label: 'Main Block',
        structure: 'sets',
        sets: numSets,
        rest_between_sets_sec: restSec,
        exercises,
      },
    ],
  };
}
