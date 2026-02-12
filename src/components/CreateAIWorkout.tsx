/**
 * CreateAIWorkout — Standalone page for generating workouts with AI.
 *
 * Users describe a workout, optionally set difficulty/duration/equipment,
 * then click Generate to see streaming pipeline progress and a workout preview.
 */

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
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

export function CreateAIWorkout() {
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  const pipeline = useStreamingPipeline();

  const handleGenerate = () => {
    const trimmed = description.trim();
    if (!trimmed) {
      toast.error('Please describe the workout you want to create.');
      return;
    }

    const body: Record<string, unknown> = { description: trimmed };
    if (difficulty) body.difficulty = difficulty;
    if (durationMinutes) body.duration_minutes = durationMinutes;
    if (selectedEquipment.length > 0) body.equipment = selectedEquipment;

    pipeline.start('/api/workouts/generate/stream', body);
  };

  const handleRetry = () => {
    handleGenerate();
  };

  const handleSave = () => {
    // Phase B.2: Wire to save endpoint
    toast.info('Save coming soon — workout save endpoint is part of Phase B.2');
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
        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="workout-description">Workout Description</Label>
          <Textarea
            id="workout-description"
            placeholder="e.g., Push day focusing on chest and shoulders, 4 exercises, intermediate level..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={pipeline.isStreaming}
          />
        </div>

        {/* Difficulty */}
        <div className="space-y-2">
          <Label>Difficulty</Label>
          <Select
            value={difficulty}
            onValueChange={setDifficulty}
            disabled={pipeline.isStreaming}
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
            disabled={pipeline.isStreaming}
          />
        </div>

        {/* Equipment multi-select */}
        <div className="space-y-2">
          <Label>Equipment (optional)</Label>
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT_OPTIONS.map((item) => (
              <Badge
                key={item}
                variant={selectedEquipment.includes(item) ? 'default' : 'outline'}
                className="cursor-pointer select-none"
                onClick={() => !pipeline.isStreaming && toggleEquipment(item)}
              >
                {item}
              </Badge>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={pipeline.isStreaming || !description.trim()}
          className="w-full gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {pipeline.isStreaming ? 'Generating...' : 'Generate Workout'}
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
