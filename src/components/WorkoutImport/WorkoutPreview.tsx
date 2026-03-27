/**
 * WorkoutPreview — displays parsed workout in an editable structured view.
 *
 * AMA-1130: Shows blocks, exercises, sets/reps/duration/distance,
 * highlights ambiguous fields, and allows inline editing before save.
 */

import { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Clock,
  Footprints,
  Flame,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import type {
  ParsedWorkout,
  ParsedBlock,
  ParsedExercise,
  AmbiguousPart,
} from './hooks/useWorkoutParser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidenceBadge(confidence: number) {
  if (confidence >= 0.9) return <Badge variant="default" className="bg-green-600 text-white text-xs">High</Badge>;
  if (confidence >= 0.7) return <Badge variant="secondary" className="bg-yellow-500 text-white text-xs">Medium</Badge>;
  return <Badge variant="destructive" className="text-xs">Low</Badge>;
}

function formatDuration(sec: number): string {
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${m}min ${s}s` : `${m}min`;
  }
  return `${sec}s`;
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)}km`;
  return `${m}m`;
}

function structureLabel(s: string | null): string {
  if (!s) return 'Regular';
  const labels: Record<string, string> = {
    regular: 'Regular',
    superset: 'Superset',
    circuit: 'Circuit',
    tabata: 'Tabata',
    emom: 'EMOM',
    amrap: 'AMRAP',
    'for-time': 'For Time',
    rounds: 'Rounds',
    sets: 'Sets',
    warmup: 'Warm-up',
    cooldown: 'Cool-down',
  };
  return labels[s] || s;
}

// ---------------------------------------------------------------------------
// Exercise Row
// ---------------------------------------------------------------------------

interface ExerciseRowProps {
  exercise: ParsedExercise;
  isAmbiguous: boolean;
  onEdit: (updates: Partial<ParsedExercise>) => void;
}

function ExerciseRow({ exercise, isAmbiguous, onEdit }: ExerciseRowProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(exercise.name);
  const [editSets, setEditSets] = useState(String(exercise.sets ?? ''));
  const [editReps, setEditReps] = useState(String(exercise.reps ?? exercise.reps_range ?? ''));

  const handleSave = () => {
    onEdit({
      name: editName,
      sets: editSets ? parseInt(editSets) || null : null,
      reps: editReps ? parseInt(editReps) || null : null,
      reps_range: editReps && isNaN(Number(editReps)) ? editReps : null,
    });
    setEditing(false);
  };

  const metrics: string[] = [];
  if (exercise.sets) metrics.push(`${exercise.sets} sets`);
  if (exercise.reps) metrics.push(`${exercise.reps} reps`);
  else if (exercise.reps_range) metrics.push(`${exercise.reps_range} reps`);
  if (exercise.duration_sec) metrics.push(formatDuration(exercise.duration_sec));
  if (exercise.distance_m) metrics.push(formatDistance(exercise.distance_m));
  if (exercise.calories) metrics.push(`${exercise.calories} cal`);
  if (exercise.rest_sec) metrics.push(`${formatDuration(exercise.rest_sec)} rest`);

  return (
    <div
      className={`flex items-center gap-3 py-2 px-3 rounded-md border ${
        isAmbiguous
          ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20'
          : 'border-border'
      }`}
    >
      {/* Icon */}
      <div className="shrink-0">
        {exercise.type === 'strength' ? (
          <Dumbbell className="h-4 w-4 text-muted-foreground" />
        ) : exercise.type === 'cardio' ? (
          <Footprints className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Flame className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex flex-wrap gap-2 items-center">
            <input
              className="border rounded px-2 py-1 text-sm w-40 bg-background"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Exercise name"
            />
            <input
              className="border rounded px-2 py-1 text-sm w-16 bg-background"
              value={editSets}
              onChange={(e) => setEditSets(e.target.value)}
              placeholder="Sets"
            />
            <span className="text-xs text-muted-foreground">x</span>
            <input
              className="border rounded px-2 py-1 text-sm w-20 bg-background"
              value={editReps}
              onChange={(e) => setEditReps(e.target.value)}
              placeholder="Reps"
            />
            <Button size="sm" variant="ghost" onClick={handleSave}>
              <Check className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{exercise.name}</span>
              {isAmbiguous && <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {metrics.map((m, i) => (
                <span key={i} className="text-xs text-muted-foreground">
                  {m}
                  {i < metrics.length - 1 && <span className="ml-1.5">|</span>}
                </span>
              ))}
            </div>
            {exercise.notes && (
              <p className="text-xs text-muted-foreground mt-0.5 italic">{exercise.notes}</p>
            )}
          </>
        )}
      </div>

      {/* Confidence + Edit */}
      <div className="flex items-center gap-2 shrink-0">
        {confidenceBadge(exercise.confidence)}
        {!editing && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block Section
// ---------------------------------------------------------------------------

interface BlockSectionProps {
  block: ParsedBlock;
  blockIdx: number;
  ambiguousExerciseNames: Set<string>;
  onEditExercise: (exIdx: number, updates: Partial<ParsedExercise>) => void;
}

function BlockSection({ block, blockIdx, ambiguousExerciseNames, onEditExercise }: BlockSectionProps) {
  const [expanded, setExpanded] = useState(true);

  const blockMeta: string[] = [];
  if (block.rounds) blockMeta.push(`${block.rounds} rounds`);
  if (block.time_cap_sec) blockMeta.push(`${formatDuration(block.time_cap_sec)} cap`);
  if (block.rest_between_rounds_sec) blockMeta.push(`${formatDuration(block.rest_between_rounds_sec)} rest`);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Block header */}
      <button
        className="flex items-center gap-2 w-full px-4 py-2.5 bg-muted/50 hover:bg-muted transition text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="font-semibold text-sm flex-1">{block.label}</span>
        <Badge variant="outline" className="text-xs">
          {structureLabel(block.structure)}
        </Badge>
        {confidenceBadge(block.confidence)}
      </button>

      {/* Block meta */}
      {expanded && blockMeta.length > 0 && (
        <div className="px-4 py-1.5 bg-muted/30 border-b text-xs text-muted-foreground flex gap-3">
          {blockMeta.map((m, i) => (
            <span key={i} className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {m}
            </span>
          ))}
        </div>
      )}

      {/* Exercises */}
      {expanded && (
        <div className="p-3 space-y-2">
          {block.exercises.map((ex, exIdx) => (
            <ExerciseRow
              key={exIdx}
              exercise={ex}
              isAmbiguous={ambiguousExerciseNames.has(ex.name.toLowerCase())}
              onEdit={(updates) => onEditExercise(exIdx, updates)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ambiguous Parts Banner
// ---------------------------------------------------------------------------

function AmbiguousPartsBanner({ parts }: { parts: AmbiguousPart[] }) {
  if (parts.length === 0) return null;

  return (
    <div className="rounded-lg border border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 p-4 space-y-2">
      <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
        <AlertTriangle className="h-4 w-4" />
        <span className="font-medium text-sm">
          {parts.length} ambiguous {parts.length === 1 ? 'part' : 'parts'} detected
        </span>
      </div>
      {parts.map((part, i) => (
        <div key={i} className="ml-6 text-sm">
          <p className="text-foreground">
            <span className="font-medium">"{part.text}"</span> — {part.issue}
          </p>
          <p className="text-muted-foreground text-xs mt-0.5">{part.suggestion}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface WorkoutPreviewProps {
  workout: ParsedWorkout;
  onSave: () => void;
  onReset: () => void;
  onEditExercise: (blockIdx: number, exIdx: number, updates: Partial<ParsedExercise>) => void;
  onEditTitle: (title: string) => void;
}

export function WorkoutPreview({
  workout,
  onSave,
  onReset,
  onEditExercise,
  onEditTitle,
}: WorkoutPreviewProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(workout.title);

  // Build set of ambiguous exercise names for highlighting
  const ambiguousNames = new Set(
    workout.ambiguous_parts.map((p) => p.text.toLowerCase()),
  );

  const totalExercises = workout.blocks.reduce((sum, b) => sum + b.exercises.length, 0);

  return (
    <div className="space-y-4" data-testid="workout-preview">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                className="text-lg font-bold border rounded px-2 py-1 bg-background w-full"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  onEditTitle(titleDraft);
                  setEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onEditTitle(titleDraft);
                    setEditingTitle(false);
                  }
                }}
                autoFocus
              />
            </div>
          ) : (
            <button
              className="text-lg font-bold flex items-center gap-2 hover:text-primary transition"
              onClick={() => setEditingTitle(true)}
            >
              {workout.title}
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
            <Badge variant="outline">{workout.workout_type}</Badge>
            {workout.estimated_duration_min && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                ~{workout.estimated_duration_min} min
              </span>
            )}
            <span>
              {workout.blocks.length} {workout.blocks.length === 1 ? 'block' : 'blocks'} |{' '}
              {totalExercises} {totalExercises === 1 ? 'exercise' : 'exercises'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">Overall:</span>
          {confidenceBadge(workout.overall_confidence)}
        </div>
      </div>

      {/* Ambiguous parts */}
      <AmbiguousPartsBanner parts={workout.ambiguous_parts} />

      {/* Blocks */}
      <div className="space-y-3">
        {workout.blocks.map((block, blockIdx) => (
          <BlockSection
            key={blockIdx}
            block={block}
            blockIdx={blockIdx}
            ambiguousExerciseNames={ambiguousNames}
            onEditExercise={(exIdx, updates) => onEditExercise(blockIdx, exIdx, updates)}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Start Over
        </Button>
        <Button onClick={onSave}>
          <Check className="h-4 w-4 mr-1.5" />
          Save to Calendar
        </Button>
      </div>
    </div>
  );
}
