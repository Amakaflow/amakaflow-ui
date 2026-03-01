import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Watch, Bike, Wand2, ShieldCheck, Edit2, Check, Trash2, GripVertical, Plus, Layers, Move, ChevronDown, ChevronUp, Minimize2, Maximize2, Save, Code, Download, Send, Info, Clock, Copy, Settings2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WorkoutStructure, Exercise, Block, Superset, RestType, WorkoutSettings, WorkoutStructureType } from '../types/workout';
import { DeviceId, getDevicesByIds, getDeviceById, Device, getPrimaryExportDestinations } from '../lib/devices';
import { ExerciseSearch } from './ExerciseSearch';
import { Badge } from './ui/badge';
import { addIdsToWorkout, generateId, getStructureDisplayName, getBlockKeyMetric, getStructureDefaults, formatRestSecs } from '../lib/workout-utils';
import { BlockConfigRow } from './BlockConfigRow';
import { AddBlockTypePicker } from './AddBlockTypePicker';
import { WarmupSuggestionStrip, CooldownSuggestionStrip, DefaultRestStrip } from './WorkoutSuggestionStrips';
import { EditExerciseDialog } from './EditExerciseDialog';
import { EditBlockDialog, BlockUpdates } from './EditBlockDialog';
import { WorkoutSettingsDialog } from './WorkoutSettingsDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { DroppableSuperset } from './DroppableSuperset';

// ── Block type visual system ──────────────────────────────────────────────────
const STRUCTURE_STYLES: Record<string, { border: string; badge: string }> = {
  circuit:    { border: 'border-l-4 border-l-green-500',   badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  rounds:     { border: 'border-l-4 border-l-green-400',   badge: 'bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300' },
  emom:       { border: 'border-l-4 border-l-blue-500',    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  amrap:      { border: 'border-l-4 border-l-orange-500',  badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  tabata:     { border: 'border-l-4 border-l-red-500',     badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  'for-time': { border: 'border-l-4 border-l-purple-500',  badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  sets:       { border: 'border-l-4 border-l-neutral-400', badge: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' },
  regular:    { border: 'border-l-4 border-l-neutral-400', badge: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' },
  superset:   { border: 'border-l-4 border-l-amber-500',   badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  warmup:     { border: 'border-l-4 border-l-slate-300',   badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  cooldown:   { border: 'border-l-4 border-l-slate-300',   badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  default:    { border: 'border-l-4 border-l-neutral-300', badge: 'bg-neutral-100 text-neutral-600' },
};

// Structure types for the dropdown selector
const STRUCTURE_TYPE_OPTIONS: { value: WorkoutStructureType; label: string }[] = [
  { value: 'superset', label: 'Superset' },
  { value: 'circuit', label: 'Circuit' },
  { value: 'tabata', label: 'Tabata' },
  { value: 'emom', label: 'EMOM' },
  { value: 'amrap', label: 'AMRAP' },
  { value: 'for-time', label: 'For Time' },
  { value: 'rounds', label: 'Rounds' },
  { value: 'sets', label: 'Sets' },
  { value: 'regular', label: 'Regular' },
  { value: 'warmup', label: 'Warm-up' },
  { value: 'cooldown', label: 'Cool-down' },
];

// ============================================================================
// Immutable helpers for Workout cloning (Industry-standard: avoid JSON.parse(JSON.stringify))
// ============================================================================
function cloneExercise(ex: Exercise): Exercise {
  return { ...ex };
}

function cloneSuperset(s: Superset): Superset {
  return {
    ...s,
    exercises: (s.exercises || []).map(cloneExercise),
  };
}

function cloneBlock(b: Block): Block {
  return {
    ...b,
    exercises: (b.exercises || []).map(cloneExercise),
    supersets: b.supersets ? b.supersets.map(cloneSuperset) : undefined,
  };
}

function cloneWorkout(w: WorkoutStructure): WorkoutStructure {
  return {
    ...w,
    blocks: (w.blocks || []).map(cloneBlock),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type Props = {
  workout: WorkoutStructure;
  onWorkoutChange: (workout: WorkoutStructure) => void;
  onAutoMap: () => void;
  onValidate: () => void;
  onSave?: () => void | Promise<void>;
  isEditingFromHistory?: boolean;
  isCreatingFromScratch?: boolean;
  loading: boolean;
  selectedDevice: DeviceId;
  onDeviceChange: (device: DeviceId) => void;
  userSelectedDevices: DeviceId[];
  onNavigateToSettings?: () => void;
};

// ── @dnd-kit drag data shapes ─────────────────────────────────────────────────
type DraggableData =
  | { type: 'block'; blockIdx: number }
  | { type: 'exercise'; blockIdx: number; exerciseIdx: number; supersetIdx: null }
  | { type: 'superset-exercise'; blockIdx: number; supersetIdx: number; exerciseIdx: number };

// ── Sortable Exercise ─────────────────────────────────────────────────────────
function SortableExercise({
  exercise,
  blockIdx,
  exerciseIdx,
  supersetIdx,
  onEdit,
  onDelete,
  effectiveRestType,
  effectiveRestSec,
  isInSuperset = false,
}: {
  exercise: Exercise;
  blockIdx: number;
  exerciseIdx: number;
  supersetIdx?: number;
  onEdit: () => void;
  onDelete: () => void;
  effectiveRestType?: string;
  effectiveRestSec?: number;
  isInSuperset?: boolean;
}) {
  const draggableData: DraggableData = supersetIdx !== undefined
    ? { type: 'superset-exercise', blockIdx, supersetIdx, exerciseIdx }
    : { type: 'exercise', blockIdx, exerciseIdx, supersetIdx: null };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id, data: draggableData });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const getDisplayName = () => {
    return exercise.name || '';
  };

  const getDisplayText = () => {
    const parts: string[] = [];
    if (exercise.warmup_sets && exercise.warmup_sets > 0 && exercise.warmup_reps && exercise.warmup_reps > 0) {
      parts.push(`🔥 ${exercise.warmup_sets}×${exercise.warmup_reps} warmup`);
    }
    if (exercise.sets) parts.push(`${exercise.sets} sets`);
    if (exercise.reps) parts.push(`${exercise.reps} reps`);
    if (exercise.reps_range) parts.push(`${exercise.reps_range} reps`);
    if (exercise.duration_sec) {
      const minutes = Math.floor(exercise.duration_sec / 60);
      const seconds = exercise.duration_sec % 60;
      if (minutes > 0) {
        parts.push(seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`);
      } else {
        parts.push(`${seconds}s`);
      }
    }
    if (exercise.calories) parts.push(`${exercise.calories} cal`);
    if (exercise.distance_m) parts.push(`${exercise.distance_m}m`);
    if (exercise.distance_range) parts.push(`${exercise.distance_range}`);
    if (exercise.time_cap_sec && exercise.time_cap_sec > 0) {
      const mins = Math.floor(exercise.time_cap_sec / 60);
      const secs = exercise.time_cap_sec % 60;
      parts.push(secs > 0 ? `⏱ ${mins}m ${secs}s cap` : `⏱ ${mins}m cap`);
    }
    return parts.length > 0 ? parts.join(' • ') : null;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50 hover:bg-muted"
    >
      {/* Drag handle — only this element initiates drag */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="flex-1">
        <p className="font-medium">{getDisplayName()}</p>
        {getDisplayText() && (
          <p className="text-sm text-muted-foreground">
            {getDisplayText()}
          </p>
        )}
      </div>

      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

// ── Sortable Block ────────────────────────────────────────────────────────────
function SortableBlock({
  block,
  blockIdx,
  workoutSettings,
  onEditExercise,
  onDeleteExercise,
  onAddExercise,
  onAddExerciseToSuperset,
  onAddSuperset,
  onDeleteSuperset,
  onUpdateBlock,
  onEditBlock,
  onDeleteBlock,
  collapseSignal,
}: {
  block: Block;
  blockIdx: number;
  workoutSettings?: WorkoutSettings;
  onEditExercise: (exerciseIdx: number, supersetIdx?: number) => void;
  onDeleteExercise: (exerciseIdx: number, supersetIdx?: number) => void;
  onAddExercise: () => void;
  onAddExerciseToSuperset: (supersetIdx: number) => void;
  onAddSuperset: () => void;
  onDeleteSuperset: (supersetIdx: number) => void;
  onUpdateBlock: (updates: Partial<Block>) => void;
  onEditBlock: () => void;
  onDeleteBlock: () => void;
  collapseSignal?: { action: 'collapse' | 'expand'; timestamp: number };
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id, data: { type: 'block', blockIdx } as DraggableData });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showConfig, setShowConfig] = useState(true);
  // Track collapsed state per superset (keyed by superset index)
  const [collapsedSupersets, setCollapsedSupersets] = useState<Record<number, boolean>>({});
  // AMA-731: Block deletion confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const toggleSupersetCollapse = (supersetIdx: number) => {
    setCollapsedSupersets(prev => ({
      ...prev,
      [supersetIdx]: !prev[supersetIdx]
    }));
  };

  // Keep a ref to block.supersets so the collapseSignal effect can read the
  // current value without depending on the object reference (which changes on
  // every @dnd-kit internal re-render, causing the effect to re-run and
  // inadvertently reset the user's manual collapse state).
  const blockSupersetsRef = useRef(block.supersets);
  blockSupersetsRef.current = block.supersets;

  // React to collapse/expand all signal
  useEffect(() => {
    if (collapseSignal) {
      if (collapseSignal.action === 'collapse') {
        setIsCollapsed(true);
        // Collapse all supersets
        const allCollapsed: Record<number, boolean> = {};
        (blockSupersetsRef.current || []).forEach((_, idx) => {
          allCollapsed[idx] = true;
        });
        setCollapsedSupersets(allCollapsed);
      } else if (collapseSignal.action === 'expand') {
        setIsCollapsed(false);
        // Expand all supersets
        setCollapsedSupersets({});
      }
    }
  }, [collapseSignal]); // intentionally omit block.supersets — read via ref above

  // Count total exercises in block (including supersets)
  const blockExercises = block.exercises?.length || 0;
  const supersetExercises = (block.supersets || []).reduce(
    (sum, ss) => sum + (ss.exercises?.length || 0),
    0
  );
  const totalExerciseCount = blockExercises + supersetExercises;

  // Calculate effective rest settings (block override > workout default)
  const effectiveRestType = block.restOverride?.enabled
    ? block.restOverride.restType
    : workoutSettings?.defaultRestType;
  const effectiveRestSec = block.restOverride?.enabled
    ? block.restOverride.restSec
    : workoutSettings?.defaultRestSec;

  const hasSupersets = (block.supersets || []).length > 0;

  // Compute "before supersets" and "after supersets" exercise slices
  // block.exercises[0] is shown before supersets when supersets exist
  // block.exercises[1+] are shown after supersets
  const beforeExercises = hasSupersets ? (block.exercises || []).slice(0, 1) : [];
  const afterExercises = hasSupersets
    ? (block.exercises || []).slice(1).filter(ex => ex != null)
    : (block.exercises || []).filter(ex => ex != null);

  return (
    <div ref={setNodeRef} style={style}>
      {/* Extra wrapper div to preserve DOM depth from the original react-dnd
          implementation (which had two wrapper divs: drop ref + dragPreview ref).
          This ensures the test's 5-level ancestor traversal stays within the
          block and does not bleed into sibling blocks. */}
      <div>
      <Card
        className={`transition-all ${isDragging ? 'opacity-40 rotate-1 scale-95' : 'opacity-100'}`}
      >
        {(() => {
          const styles = STRUCTURE_STYLES[block.structure ?? ''] ?? STRUCTURE_STYLES.default;
          return (
            <>
              <CardHeader className={`${styles.border} pl-4 bg-muted/20`}>
                <div className="flex items-center gap-2 min-w-0">
                  {/* Drag handle — only this triggers block drag */}
                  <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 touch-none"
                  >
                    <GripVertical className="w-5 h-5" />
                  </div>

                  {/* Collapse exercises toggle */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-0 h-auto hover:bg-transparent shrink-0"
                    title={isCollapsed ? 'Expand exercises' : 'Collapse exercises'}
                  >
                    {isCollapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
                  </Button>

                  {/* AMA-731: Block type selector */}
                  <Select
                    value={block.structure ?? ''}
                    onValueChange={(value) => {
                      const newStructure = value as WorkoutStructureType;
                      onUpdateBlock({ structure: newStructure });
                    }}
                  >
                    <SelectTrigger className={`shrink-0 w-auto h-7 text-xs gap-1 ${styles.badge} border-0`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STRUCTURE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Block name */}
                  <span className="font-medium text-sm truncate flex-1">{block.label}</span>

                  {/* Exercise count badge */}
                  <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                    {totalExerciseCount} exercises
                  </Badge>
                  {/* Config summary — only when expanded and configured */}
                  {!isCollapsed && block.structure && (() => {
                    const metric = getBlockKeyMetric(block);
                    return metric && metric !== 'Configure →'
                      ? <span className="text-xs text-muted-foreground shrink-0">{metric}</span>
                      : null;
                  })()}

                  {/* Configure button */}
                  {block.structure && (
                    <Button
                      size="sm"
                      variant={showConfig ? 'secondary' : 'ghost'}
                      onClick={() => setShowConfig(!showConfig)}
                      className="shrink-0 gap-1 text-xs h-7"
                      aria-label="configure"
                    >
                      <Settings2 className="w-3 h-3" />
                      Configure
                    </Button>
                  )}

                  {/* Edit block name button */}
                  <Button size="sm" variant="ghost" onClick={onEditBlock} title="Edit block name" className="shrink-0 p-1 h-7">
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>

                  {/* AMA-731: Delete block button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(true)}
                    title="Delete block"
                    className="shrink-0 p-1 h-7 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>

              {/* AMA-731: Delete block confirmation dialog */}
              <ConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                title="Delete Block"
                description={`Are you sure you want to delete "${block.label}" and all its exercises? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="destructive"
                onConfirm={onDeleteBlock}
              />

              {/* Config row — only visible when block is expanded */}
              {showConfig && !isCollapsed && (
                <BlockConfigRow
                  block={block}
                  onUpdate={(updates) => onUpdateBlock(updates)}
                />
              )}
            </>
          );
        })()}
        {!isCollapsed && (
          <CardContent className="space-y-4">
            {/* Exercises before supersets (index 0 when supersets exist) */}
            {hasSupersets && (
              <div>
                {beforeExercises.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Layers className="w-4 h-4" />
                      <span>Exercises</span>
                    </div>
                    <SortableContext items={beforeExercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {beforeExercises.map((exercise, relIdx) => (
                          <SortableExercise
                            key={exercise.id}
                            exercise={exercise}
                            blockIdx={blockIdx}
                            exerciseIdx={relIdx}
                            onEdit={() => onEditExercise(relIdx)}
                            onDelete={() => onDeleteExercise(relIdx)}
                            effectiveRestType={effectiveRestType}
                            effectiveRestSec={effectiveRestSec}
                            isInSuperset={false}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </>
                )}
                {beforeExercises.length === 0 && (
                  <div className="min-h-[40px] rounded-lg border-2 border-dashed border-transparent" />
                )}
              </div>
            )}

            {/* Supersets */}
            {hasSupersets && (
              <div className="space-y-3">
                {(block.supersets || []).map((superset, supersetIdx) => {
                  const isSupersetCollapsed = collapsedSupersets[supersetIdx] ?? false;
                  const exerciseCount = superset.exercises?.length || 0;

                  const getSupersetSummary = () => {
                    const parts: string[] = [];
                    parts.push(`${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`);
                    if (superset.rounds && superset.rounds > 1) {
                      parts.push(`${superset.rounds} rounds`);
                    }
                    if (superset.rest_type === 'button') {
                      parts.push('Lap Button');
                    } else if (superset.rest_between_sec) {
                      const mins = Math.floor(superset.rest_between_sec / 60);
                      const secs = superset.rest_between_sec % 60;
                      if (mins > 0 && secs > 0) parts.push(`${mins}m ${secs}s rest`);
                      else if (mins > 0) parts.push(`${mins}m rest`);
                      else parts.push(`${secs}s rest`);
                    }
                    return parts.join(' • ');
                  };

                  return (
                    <div key={superset.id || supersetIdx} className="border-l-4 border-primary pl-4 space-y-2">
                      <div
                        className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -ml-4 pl-4 py-1 rounded-r transition-colors"
                        onClick={() => toggleSupersetCollapse(supersetIdx)}
                      >
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="p-0 h-auto hover:bg-transparent"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSupersetCollapse(supersetIdx);
                            }}
                          >
                            {isSupersetCollapsed ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Badge variant="outline" className="text-xs">
                            Superset {supersetIdx + 1}
                          </Badge>
                          {isSupersetCollapsed && (
                            <span className="text-xs text-muted-foreground">
                              {getSupersetSummary()}
                            </span>
                          )}
                          {!isSupersetCollapsed && (superset.rest_between_sec || superset.rest_type) && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Clock className="w-3 h-3" />
                              {superset.rest_type === 'button'
                                ? 'Lap Button'
                                : superset.rest_between_sec
                                  ? (() => {
                                      const mins = Math.floor(superset.rest_between_sec / 60);
                                      const secs = superset.rest_between_sec % 60;
                                      if (mins > 0 && secs > 0) return `${mins}m ${secs}s`;
                                      if (mins > 0) return `${mins}m`;
                                      return `${secs}s`;
                                    })()
                                  : 'Lap Button'}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSuperset(supersetIdx);
                          }}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Exercises inside superset — only when expanded */}
                      {!isSupersetCollapsed && (
                        <>
                          <DroppableSuperset
                            id={superset.id || `superset-${supersetIdx}`}
                            exerciseIds={(superset.exercises || []).map(e => e.id)}
                            isEmpty={(superset.exercises || []).length === 0}
                          >
                            {(superset.exercises || []).map((exercise, exerciseIdx) => (
                              <SortableExercise
                                key={exercise.id}
                                exercise={exercise}
                                blockIdx={blockIdx}
                                exerciseIdx={exerciseIdx}
                                supersetIdx={supersetIdx}
                                onEdit={() => onEditExercise(exerciseIdx, supersetIdx)}
                                onDelete={() => onDeleteExercise(exerciseIdx, supersetIdx)}
                                effectiveRestType={effectiveRestType}
                                effectiveRestSec={effectiveRestSec}
                                isInSuperset={true}
                              />
                            ))}
                          </DroppableSuperset>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onAddExerciseToSuperset(supersetIdx)}
                            className="w-full gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Add Exercise to Superset
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Block-level exercises (all when no supersets; index 1+ when supersets exist) */}
            <div>
              {afterExercises.length > 0 && hasSupersets && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Layers className="w-4 h-4" />
                  <span>Exercises</span>
                </div>
              )}
              <SortableContext
                items={afterExercises.map(e => e.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className={`space-y-2 min-h-[50px] rounded-lg ${afterExercises.length === 0 ? 'border-2 border-dashed border-transparent' : ''}`}>
                  {afterExercises.length === 0 && !hasSupersets && (
                    <div className="text-center text-sm text-muted-foreground py-4">
                      Drop exercise here or click Add Exercise
                    </div>
                  )}
                  {afterExercises.map((exercise, relIdx) => {
                    // Map relative index back to actual index in block.exercises
                    const actualIdx = hasSupersets ? relIdx + 1 : relIdx;
                    return (
                      <SortableExercise
                        key={exercise.id}
                        exercise={exercise}
                        blockIdx={blockIdx}
                        exerciseIdx={actualIdx}
                        onEdit={() => onEditExercise(actualIdx)}
                        onDelete={() => onDeleteExercise(actualIdx)}
                        effectiveRestType={effectiveRestType}
                        effectiveRestSec={effectiveRestSec}
                        isInSuperset={false}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={onAddExercise}
                className="flex-1 gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Exercise
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onAddSuperset}
                className="flex-1 gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Superset
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
      </div>
    </div>
  );
}

export function StructureWorkout({
  workout,
  onWorkoutChange,
  onAutoMap,
  onValidate,
  onSave,
  isEditingFromHistory = false,
  isCreatingFromScratch = false,
  loading,
  selectedDevice,
  onDeviceChange,
  userSelectedDevices,
  onNavigateToSettings
}: Props) {
  // Ensure workout has IDs - use a stable check to avoid infinite loops
  const workoutWithIds = useMemo(() => {
    // Guard against undefined/null workout or blocks
    if (!workout || !workout.blocks || !Array.isArray(workout.blocks)) {
      return {
        title: workout?.title || '',
        source: workout?.source || '',
        settings: workout?.settings,
        blocks: []
      };
    }

    const hasAllIds = workout.blocks.every(b => {
      if (!b || !b.id) return false;
      const exercisesHaveIds = b.exercises && Array.isArray(b.exercises) && b.exercises.every(ex => ex && ex.id);
      const supersetsHaveIds = !b.supersets || (Array.isArray(b.supersets) && b.supersets.every(ss =>
        ss && ss.id && ss.exercises && Array.isArray(ss.exercises) && ss.exercises.every(ex => ex && ex.id)
      ));
      return exercisesHaveIds && supersetsHaveIds;
    });
    if (hasAllIds) {
      return workout;
    }
    return addIdsToWorkout(workout);
  }, [
    // Use stable dependencies - only re-compute if structure actually changes
    workout?.blocks?.length || 0,
    workout?.title || '',
    workout?.source || '',
    // Include settings to detect workout-level changes (AMA-96)
    JSON.stringify(workout?.settings || {}),
    // Include block labels to detect changes
    workout?.blocks?.map(b => b?.label || '').join('|') || '',
    // Stringify block IDs to detect actual changes (with null checks)
    workout?.blocks?.map(b => b?.id || '').join(',') || '',
    workout?.blocks?.map(b => b?.exercises?.map(e => e?.id || '').join(',') || '').join('|') || '',
    workout?.blocks?.map(b => b?.supersets?.map(ss => ss?.id || '').join(',') || '').join('|') || '',
    workout?.blocks?.map(b => b?.supersets?.map(ss => ss?.exercises?.map(e => e?.id || '').join(',') || '').join('|') || '').join('||') || '',
    // Include block structural config fields (rounds, rest, time caps, etc.)
    workout?.blocks?.map(b =>
      `${b?.structure ?? ''}|${b?.rounds ?? ''}|${b?.rest_between_rounds_sec ?? ''}|${b?.rest_between_sets_sec ?? ''}|${b?.time_cap_sec ?? ''}|${b?.time_work_sec ?? ''}|${b?.time_rest_sec ?? ''}|${b?.sets ?? ''}|${b?.warmup_duration_sec ?? ''}|${b?.warmup_activity ?? ''}`
    ).join('^^') ?? '',
    // Include exercise names to detect when new exercises are added
    workout?.blocks?.map(b => b?.exercises?.map(e => e?.name || '').join(',') || '').join('|') || '',
    workout?.blocks?.map(b => b?.supersets?.map(ss => ss?.exercises?.map(e => e?.name || '').join(',') || '').join('|') || '').join('||') || '',
    // Include exercise properties to detect changes to distance, duration, reps, warmup, rest, etc.
    workout?.blocks?.map(b =>
      b?.exercises?.map(e =>
        `${e?.name || ''}|${e?.sets || ''}|${e?.reps || ''}|${e?.reps_range || ''}|${e?.duration_sec || ''}|${e?.distance_m || ''}|${e?.distance_range || ''}|${e?.rest_sec || ''}|${e?.rest_type || ''}|${e?.notes || ''}|${e?.warmup_sets || ''}|${e?.warmup_reps || ''}`
      ).join('||') || ''
    ).join('|||') || '',
    workout?.blocks?.map(b =>
      b?.supersets?.map(ss =>
        ss?.exercises?.map(e =>
          `${e?.name || ''}|${e?.sets || ''}|${e?.reps || ''}|${e?.reps_range || ''}|${e?.duration_sec || ''}|${e?.distance_m || ''}|${e?.distance_range || ''}|${e?.rest_sec || ''}|${e?.rest_type || ''}|${e?.notes || ''}|${e?.warmup_sets || ''}|${e?.warmup_reps || ''}`
        ).join('||') || ''
      ).join('|||') || ''
    ).join('||||') || ''
  ]);

  const [showWorkoutSettings, setShowWorkoutSettings] = useState(false);
  const [editingExercise, setEditingExercise] = useState<{ blockIdx: number; exerciseIdx: number; supersetIdx?: number } | null>(null);
  const [editingBlockIdx, setEditingBlockIdx] = useState<number | null>(null);
  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [addingToBlock, setAddingToBlock] = useState<number | null>(null);
  const [addingToSuperset, setAddingToSuperset] = useState<{ blockIdx: number; supersetIdx: number } | null>(null);
  const [collapseSignal, setCollapseSignal] = useState<{ action: 'collapse' | 'expand'; timestamp: number } | undefined>(undefined);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [showAddBlockPicker, setShowAddBlockPicker] = useState(false);
  const [skippedWarmup, setSkippedWarmup] = useState(false);
  const [skippedCooldown, setSkippedCooldown] = useState(false);
  const [skippedRest, setSkippedRest] = useState(false);

  // Active drag item for DragOverlay ghost preview
  const [activeDragItem, setActiveDragItem] = useState<{
    type: 'block' | 'exercise' | 'superset-exercise';
    label: string;
  } | null>(null);

  const availableDevices = getDevicesByIds(userSelectedDevices);

  // ── Drag start: record active item for DragOverlay ───────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DraggableData | undefined;
    if (!data) return;

    if (data.type === 'block') {
      const block = workoutWithIds.blocks[data.blockIdx];
      setActiveDragItem({ type: 'block', label: block?.label ?? 'Block' });
    } else if (data.type === 'exercise') {
      const exercise = workoutWithIds.blocks[data.blockIdx]?.exercises?.[data.exerciseIdx];
      setActiveDragItem({ type: 'exercise', label: exercise?.name ?? 'Exercise' });
    } else if (data.type === 'superset-exercise') {
      const exercise = workoutWithIds.blocks[data.blockIdx]?.supersets?.[data.supersetIdx]?.exercises?.[data.exerciseIdx];
      setActiveDragItem({ type: 'superset-exercise', label: exercise?.name ?? 'Exercise' });
    }
  };

  // ── Drag end: single unified handler for blocks and exercises ─────────────
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current as DraggableData | undefined;
    if (!activeData) return;

    const newWorkout = cloneWorkout(workoutWithIds);

    if (activeData.type === 'block') {
      const oldIdx = newWorkout.blocks.findIndex(b => b.id === String(active.id));
      const newIdx = newWorkout.blocks.findIndex(b => b.id === String(over.id));
      if (oldIdx !== -1 && newIdx !== -1) {
        newWorkout.blocks = arrayMove(newWorkout.blocks, oldIdx, newIdx);
        onWorkoutChange(newWorkout);
      }
      return;
    }

    if (activeData.type === 'exercise') {
      const block = newWorkout.blocks[activeData.blockIdx];
      if (!block?.exercises) return;
      const oldIdx = block.exercises.findIndex(e => e?.id === String(active.id));
      const newIdx = block.exercises.findIndex(e => e?.id === String(over.id));
      if (oldIdx !== -1 && newIdx !== -1) {
        block.exercises = arrayMove(block.exercises, oldIdx, newIdx);
        onWorkoutChange(newWorkout);
      }
      return;
    }

    if (activeData.type === 'superset-exercise') {
      const superset = newWorkout.blocks[activeData.blockIdx]?.supersets?.[activeData.supersetIdx];
      if (!superset?.exercises) return;
      const oldIdx = superset.exercises.findIndex(e => e?.id === String(active.id));
      const newIdx = superset.exercises.findIndex(e => e?.id === String(over.id));
      if (oldIdx !== -1 && newIdx !== -1) {
        superset.exercises = arrayMove(superset.exercises, oldIdx, newIdx);
        onWorkoutChange(newWorkout);
      }
      return;
    }
  };

  const updateExercise = (blockIdx: number, exerciseIdx: number, updates: Partial<Exercise>, supersetIdx?: number) => {
    // DEBUG: Log incoming updates
    console.log('[StructureWorkout] updateExercise:', {
      blockIdx,
      exerciseIdx,
      supersetIdx,
      warmup_sets: updates.warmup_sets,
      warmup_reps: updates.warmup_reps,
    });

    const newWorkout = cloneWorkout(workoutWithIds);

    if (supersetIdx !== undefined) {
      // Update exercise in superset
      const exercise = newWorkout.blocks[blockIdx].supersets?.[supersetIdx]?.exercises?.[exerciseIdx];
      if (exercise) {
        newWorkout.blocks[blockIdx].supersets[supersetIdx].exercises[exerciseIdx] = { ...exercise, ...updates };
      }
    } else {
      // Update exercise in block
      const exercise = newWorkout.blocks[blockIdx].exercises[exerciseIdx];
      if (exercise) {
        newWorkout.blocks[blockIdx].exercises[exerciseIdx] = { ...exercise, ...updates };
      }
    }

    onWorkoutChange(newWorkout);
    // Note: Don't close dialog here - let EditExerciseDialog manage its own state
  };

  const deleteExercise = (blockIdx: number, exerciseIdx: number, supersetIdx?: number) => {
    const newWorkout = cloneWorkout(workoutWithIds);

    if (supersetIdx !== undefined) {
      // Delete exercise from superset
      if (newWorkout.blocks[blockIdx].supersets?.[supersetIdx]?.exercises) {
        newWorkout.blocks[blockIdx].supersets[supersetIdx].exercises.splice(exerciseIdx, 1);
      }
    } else {
      // Delete exercise from block
      if (newWorkout.blocks[blockIdx].exercises) {
        newWorkout.blocks[blockIdx].exercises.splice(exerciseIdx, 1);
      }
    }

    onWorkoutChange(newWorkout);
  };

  // Industry-standard: Use cloneWorkout for immutability
  // Ensure new exercises always have an id and (optionally) addedAt for any upstream sorting
  // Let the array order define what the UI shows; don't override it inside the drop zone
  const addExercise = (blockIdx: number, exerciseName: string, supersetIdx?: number) => {
    const baseWorkout: WorkoutStructure | undefined = workoutWithIds || workout;
    if (!baseWorkout) return;

    const newWorkout = cloneWorkout(baseWorkout);

    const newExercise: Exercise = {
      id: generateId(),
      name: exerciseName,
      sets: 3,
      reps: 10,
      reps_range: null,
      duration_sec: null,
      rest_sec: 60,
      distance_m: null,
      distance_range: null,
      type: 'strength',
      notes: null,
      addedAt: Date.now(), // optional metadata; actual order is defined by array position
    };

    const block = newWorkout.blocks[blockIdx];
    if (!block) {
      console.warn('addExercise: invalid blockIdx', { blockIdx });
      return;
    }

    if (supersetIdx !== undefined && supersetIdx !== null) {
      if (!block.supersets) {
        block.supersets = [];
      }
      if (!block.supersets[supersetIdx]) {
        block.supersets[supersetIdx] = {
          id: generateId(),
          exercises: [],
          rest_between_sec: 60,
        };
      }
      if (!block.supersets[supersetIdx].exercises) {
        block.supersets[supersetIdx].exercises = [];
      }
      block.supersets[supersetIdx].exercises.push(newExercise);
    } else {
      if (!block.exercises) {
        block.exercises = [];
      }
      // When adding to block-level exercises:
      // - If there are supersets, we want the exercise to go AFTER supersets
      //   - Index 0 is shown before supersets (if it exists)
      //   - Index 1+ are shown after supersets
      //   - So if this is the first exercise with supersets, insert at index 1
      //   - Otherwise, append to end (will be at index 1+)
      // - If no supersets, append normally
      const hasSupersets = (block.supersets || []).length > 0;
      if (hasSupersets && block.exercises.length === 0) {
        // First exercise with supersets - insert at index 1 (after supersets)
        // This creates a sparse array, but that's okay - index 0 will be undefined
        block.exercises[1] = newExercise;
      } else {
        // Not the first exercise, or no supersets - append normally
        block.exercises.push(newExercise);
      }
    }

    onWorkoutChange(newWorkout);
    setShowExerciseSearch(false);
    setAddingToBlock(null);
    setAddingToSuperset(null);
  };

  const addSuperset = (blockIdx: number) => {
    const newWorkout = cloneWorkout(workoutWithIds);
    if (!newWorkout.blocks[blockIdx].supersets) {
      newWorkout.blocks[blockIdx].supersets = [];
    }
    const newSuperset: Superset = {
      id: generateId(),
      exercises: [],
      rest_between_sec: 60,
    };
    newWorkout.blocks[blockIdx].supersets.push(newSuperset);
    onWorkoutChange(newWorkout);
  };

  const deleteSuperset = (blockIdx: number, supersetIdx: number) => {
    const newWorkout = cloneWorkout(workoutWithIds);
    if (newWorkout.blocks[blockIdx].supersets) {
      newWorkout.blocks[blockIdx].supersets.splice(supersetIdx, 1);
    }
    onWorkoutChange(newWorkout);
  };

  const addBlock = (structure?: WorkoutStructureType) => {
    const newWorkout = cloneWorkout(workoutWithIds);
    const defaults = structure ? getStructureDefaults(structure) : {};
    const displayName = structure ? getStructureDisplayName(structure) : null;
    const label = displayName
      ? displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase()
      : `Block ${(workoutWithIds.blocks || []).length + 1}`;
    const newBlock: Block = {
      id: generateId(),
      label,
      structure: structure ?? null,
      exercises: [],
      ...defaults,
    };
    newWorkout.blocks.push(newBlock);
    onWorkoutChange(newWorkout);
    setShowAddBlockPicker(false);
  };

  const updateBlock = (blockIdx: number, updates: Partial<Block>) => {
    const newWorkout = cloneWorkout(workoutWithIds);
    newWorkout.blocks[blockIdx] = { ...newWorkout.blocks[blockIdx], ...updates };
    onWorkoutChange(newWorkout);
  };

  // AMA-731: Delete a block from the workout
  const deleteBlock = (blockIdx: number) => {
    const newWorkout = cloneWorkout(workoutWithIds);
    if (newWorkout.blocks[blockIdx]) {
      newWorkout.blocks.splice(blockIdx, 1);
    }
    onWorkoutChange(newWorkout);
  };

  // Handle workout-level settings changes (AMA-96)
  const handleWorkoutSettingsSave = (title: string, settings: WorkoutSettings) => {
    const newWorkout = cloneWorkout(workoutWithIds);
    newWorkout.title = title;
    newWorkout.settings = settings;
    onWorkoutChange(newWorkout);
  };

  const hasWarmupBlock = (workoutWithIds.blocks || []).some(b => b.structure === 'warmup');
  const hasCooldownBlock = (workoutWithIds.blocks || []).some(b => b.structure === 'cooldown');
  const hasDefaultRest = !!workoutWithIds.settings?.defaultRestSec;
  const hasAnyBlock = (workoutWithIds.blocks || []).length > 0;

  const showWarmupStrip = hasAnyBlock && !hasWarmupBlock && !skippedWarmup;
  const showCooldownStrip = hasAnyBlock && !hasCooldownBlock && !skippedCooldown;
  const showRestStrip = hasAnyBlock && !hasDefaultRest && !skippedRest;

  const blockIds = (workoutWithIds.blocks || []).map(b => b.id);

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle>{workoutWithIds.title || 'Untitled Workout'}</CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setShowWorkoutSettings(true)} title="Workout Settings">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
                {/* Default rest indicator */}
                {hasDefaultRest && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Default rest: {formatRestSecs(workoutWithIds.settings!.defaultRestSec!)} · applied to all blocks unless overridden
                    <button className="ml-2 underline" onClick={() => setShowWorkoutSettings(true)}>Edit</button>
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Move className="w-4 h-4" />
            <span>Drag blocks and exercises to reorder</span>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setCollapseSignal({ action: 'collapse', timestamp: Date.now() })}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Minimize2 className="w-4 h-4" />
              Collapse All
            </Button>
            <Button
              onClick={() => setCollapseSignal({ action: 'expand', timestamp: Date.now() })}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Maximize2 className="w-4 h-4" />
              Expand All
            </Button>
          </div>
        </div>

        {/* Suggestion strips */}
        {showWarmupStrip && (
          <WarmupSuggestionStrip
            onAdd={() => {
              const newWorkout = cloneWorkout(workoutWithIds);
              const warmupBlock: Block = {
                id: generateId(),
                label: 'Warm-up',
                structure: 'warmup',
                exercises: [],
                warmup_enabled: true,
                ...getStructureDefaults('warmup'),
              };
              newWorkout.blocks.unshift(warmupBlock);
              onWorkoutChange(newWorkout);
            }}
            onSkip={() => setSkippedWarmup(true)}
          />
        )}
        {showRestStrip && (
          <DefaultRestStrip
            onSet={() => setShowWorkoutSettings(true)}
            onSkip={() => setSkippedRest(true)}
          />
        )}

        <div>
          <div className="space-y-4 pb-4">
            {(!workoutWithIds.blocks || workoutWithIds.blocks.length === 0) ? (
              <div className="text-center text-muted-foreground py-8">
                <p className="mb-2">No blocks yet. Click "Add Block" to get started.</p>
              </div>
            ) : (
              <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
                {workoutWithIds.blocks.map((block, blockIdx) => (
                  <SortableBlock
                    key={block.id || blockIdx}
                    block={block}
                    blockIdx={blockIdx}
                    workoutSettings={workoutWithIds.settings}
                    onEditExercise={(exerciseIdx, supersetIdx) => setEditingExercise({ blockIdx, exerciseIdx, supersetIdx })}
                    onDeleteExercise={(exerciseIdx, supersetIdx) => deleteExercise(blockIdx, exerciseIdx, supersetIdx)}
                    onAddExercise={() => {
                      setAddingToBlock(blockIdx);
                      setAddingToSuperset(null);
                      setShowExerciseSearch(true);
                    }}
                    onAddExerciseToSuperset={(supersetIdx) => {
                      setAddingToBlock(blockIdx);
                      setAddingToSuperset({ blockIdx, supersetIdx });
                      setShowExerciseSearch(true);
                    }}
                    onAddSuperset={() => addSuperset(blockIdx)}
                    onDeleteSuperset={(supersetIdx) => deleteSuperset(blockIdx, supersetIdx)}
                    onUpdateBlock={(updates) => updateBlock(blockIdx, updates)}
                    onEditBlock={() => setEditingBlockIdx(blockIdx)}
                    onDeleteBlock={() => deleteBlock(blockIdx)}
                    collapseSignal={collapseSignal}
                  />
                ))}
              </SortableContext>
            )}
          </div>
        </div>

        {/* Cooldown strip at bottom */}
        {showCooldownStrip && (
          <CooldownSuggestionStrip
            onAdd={() => {
              const newWorkout = cloneWorkout(workoutWithIds);
              const cooldownBlock: Block = {
                id: generateId(),
                label: 'Cool-down',
                structure: 'cooldown',
                exercises: [],
                warmup_enabled: true,
                ...getStructureDefaults('cooldown'),
              };
              newWorkout.blocks.push(cooldownBlock);
              onWorkoutChange(newWorkout);
            }}
            onSkip={() => setSkippedCooldown(true)}
          />
        )}

        {/* Add Block — type picker */}
        {showAddBlockPicker ? (
          <AddBlockTypePicker
            onSelect={(structure) => addBlock(structure)}
            onCancel={() => setShowAddBlockPicker(false)}
          />
        ) : (
          <Button onClick={() => setShowAddBlockPicker(true)} variant="outline" className="gap-2" aria-label="Add Block">
            <Plus className="w-4 h-4" />
            Add Block
          </Button>
        )}

        {/* Export Destination — at bottom of workout builder */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            {/* Export Destination Selector */}
            <div className="space-y-3">
              <Label>Export Destination</Label>
              <Select value={selectedDevice} onValueChange={(value) => onDeviceChange(value as DeviceId)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {getPrimaryExportDestinations().map((device) => (
                    <SelectItem
                      key={device.id}
                      value={device.id}
                      disabled={device.exportMethod === 'coming_soon'}
                    >
                      <div className="flex items-center gap-2">
                        <span>{device.icon}</span>
                        <span>{device.name}</span>
                        {device.exportMethod === 'coming_soon' && (
                          <span className="text-xs text-muted-foreground ml-2">(Coming Soon)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Destination Info */}
              {(() => {
                const device = getDeviceById(selectedDevice);
                if (!device) return null;

                return (
                  <Alert className="bg-muted/50">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {device.requiresMapping ? (
                        <>
                          <strong>Requires exercise mapping.</strong> Your exercises will be matched to {device.name}'s exercise database for proper tracking on your device.
                        </>
                      ) : (
                        <>
                          <strong>Direct export.</strong> Your workout will be exported directly without exercise mapping.
                        </>
                      )}
                      {device.setupInstructions && (
                        <span className="block mt-1 text-muted-foreground">{device.setupInstructions}</span>
                      )}
                    </AlertDescription>
                  </Alert>
                );
              })()}
            </div>

            {/* Action Buttons - Dynamic based on destination */}
            <div className="flex gap-2 flex-wrap">
              {(() => {
                const device = getDeviceById(selectedDevice);
                const needsMapping = device?.requiresMapping ?? true;
                const isAvailable = device?.exportMethod !== 'coming_soon';

                if (!isAvailable) {
                  return (
                    <>
                      {onSave && (
                        <Button onClick={onSave} disabled={loading} className="gap-2">
                          <Save className="w-4 h-4" />
                          Save to Library
                        </Button>
                      )}
                      <Button disabled className="gap-2 opacity-50">
                        <Clock className="w-4 h-4" />
                        {device?.name} Coming Soon
                      </Button>
                    </>
                  );
                }

                if (isEditingFromHistory || isCreatingFromScratch) {
                  return (
                    <>
                      {onSave && (
                        <Button onClick={onSave} disabled={loading} className="gap-2">
                          <Save className="w-4 h-4" />
                          {isCreatingFromScratch ? 'Save Workout' : 'Save Changes'}
                        </Button>
                      )}
                      {isEditingFromHistory && needsMapping && (
                        <>
                          <Button onClick={onAutoMap} disabled={loading} variant="outline" className="gap-2">
                            <Wand2 className="w-4 h-4" />
                            Re-Map & Export
                          </Button>
                          <Button onClick={onValidate} disabled={loading} variant="outline" className="gap-2">
                            <ShieldCheck className="w-4 h-4" />
                            Validate & Review
                          </Button>
                        </>
                      )}
                      {isEditingFromHistory && !needsMapping && (
                        <Button onClick={onAutoMap} disabled={loading} variant="outline" className="gap-2">
                          {device?.exportMethod === 'file_download' ? (
                            <Download className="w-4 h-4" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          Export to {device?.name}
                        </Button>
                      )}
                    </>
                  );
                }

                // Normal flow (not editing)
                if (needsMapping) {
                  return (
                    <>
                      <Button onClick={onAutoMap} disabled={loading} className="gap-2">
                        <Wand2 className="w-4 h-4" />
                        Auto-Map & Export
                      </Button>
                      <Button onClick={onValidate} disabled={loading} variant="outline" className="gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        Validate & Review
                      </Button>
                      {onSave && (
                        <Button onClick={onSave} disabled={loading} variant="ghost" className="gap-2">
                          <Save className="w-4 h-4" />
                          Save Draft
                        </Button>
                      )}
                    </>
                  );
                } else {
                  // Direct export (no mapping)
                  return (
                    <>
                      <Button onClick={onAutoMap} disabled={loading} className="gap-2">
                        {device?.exportMethod === 'file_download' ? (
                          <Download className="w-4 h-4" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Export to {device?.name}
                      </Button>
                      {onSave && (
                        <Button onClick={onSave} disabled={loading} variant="ghost" className="gap-2">
                          <Save className="w-4 h-4" />
                          Save Draft
                        </Button>
                      )}
                    </>
                  );
                }
              })()}
              {import.meta.env.DEV && (
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(workoutWithIds, null, 2));
                    setJsonCopied(true);
                    setTimeout(() => setJsonCopied(false), 2000);
                  }}
                  variant="outline"
                  className="gap-2"
                >
                  {jsonCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {jsonCopied ? 'Copied!' : 'Copy JSON'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Exercise Search Modal */}
        {showExerciseSearch && addingToBlock !== null && (
          <ExerciseSearch
            onSelect={(exerciseName) => {
              const supersetIdx = addingToSuperset?.supersetIdx;
              addExercise(addingToBlock, exerciseName, supersetIdx);
            }}
            onClose={() => {
              setShowExerciseSearch(false);
              setAddingToBlock(null);
              setAddingToSuperset(null);
            }}
            device={selectedDevice}
          />
        )}

        {/* Edit Exercise Dialog */}
        {editingExercise && (() => {
          const { blockIdx, exerciseIdx, supersetIdx } = editingExercise;
          // Always read from current workout state to ensure updates are reflected
          const currentExercise = supersetIdx !== undefined
            ? workoutWithIds.blocks[blockIdx]?.supersets?.[supersetIdx]?.exercises?.[exerciseIdx]
            : workoutWithIds.blocks[blockIdx]?.exercises[exerciseIdx];

          if (!currentExercise) {
            // Exercise was deleted, close dialog
            setEditingExercise(null);
            return null;
          }

          return (
            <EditExerciseDialog
              key={`${blockIdx}-${exerciseIdx}-${supersetIdx ?? 'block'}`}
              open={!!editingExercise}
              exercise={currentExercise}
              onSave={(updates) => {
                // Live updates: onSave is called on every change, don't close dialog here
                updateExercise(blockIdx, exerciseIdx, updates, supersetIdx);
              }}
              onClose={() => {
                setEditingExercise(null);
              }}
            />
          );
        })()}

        {/* Edit Block Dialog */}
        {editingBlockIdx !== null && (
          <EditBlockDialog
            open={editingBlockIdx !== null}
            block={workoutWithIds.blocks[editingBlockIdx]}
            workoutSettings={workoutWithIds.settings}
            onSave={(updates: BlockUpdates) => {
              const newWorkout = cloneWorkout(workoutWithIds);
              const block = newWorkout.blocks[editingBlockIdx];

              // Update block label
              if (updates.label !== undefined) {
                block.label = updates.label;
              }

              // Helper to update all exercises in block
              const updateAllExercises = (updateFn: (ex: Exercise) => void) => {
                // Update block-level exercises
                if (block.exercises) {
                  block.exercises.forEach(ex => {
                    if (ex) updateFn(ex);
                  });
                }
                // Update superset exercises
                if (block.supersets) {
                  block.supersets.forEach(ss => {
                    if (ss.exercises) {
                      ss.exercises.forEach(ex => {
                        if (ex) updateFn(ex);
                      });
                    }
                  });
                }
              };

              // Rest override (AMA-96)
              // Store rest override settings at block level
              if (updates.restOverrideEnabled !== undefined) {
                if (updates.restOverrideEnabled) {
                  block.restOverride = {
                    enabled: true,
                    restType: updates.restType,
                    restSec: updates.restSec,
                  };
                  // Also apply to exercises for backward compatibility
                  updateAllExercises(ex => {
                    if (updates.restType !== undefined) {
                      ex.rest_type = updates.restType;
                    }
                    if (updates.restSec !== undefined) {
                      ex.rest_sec = updates.restSec;
                    }
                  });
                } else {
                  // Clear override - exercises will use workout defaults
                  block.restOverride = undefined;
                }
              }

              // Sets: Always apply to all exercises (common bulk operation)
              if (updates.sets !== undefined && updates.sets !== null) {
                updateAllExercises(ex => {
                  ex.sets = updates.sets!;
                });
              }

              // Reps: Only apply if toggle was explicitly enabled
              if (updates.applyReps && updates.reps !== null) {
                updateAllExercises(ex => {
                  ex.reps = updates.reps;
                  // Clear rep range when setting explicit reps
                  ex.reps_range = null;
                });
              }

              // Rep Range: Only apply if toggle was explicitly enabled
              if (updates.applyRepsRange && updates.repsRange !== null) {
                updateAllExercises(ex => {
                  ex.reps_range = updates.repsRange || null;
                  // Clear explicit reps when setting range
                  if (updates.repsRange) {
                    ex.reps = null;
                  }
                });
              }

              onWorkoutChange(newWorkout);
              setEditingBlockIdx(null);
            }}
            onClose={() => setEditingBlockIdx(null)}
          />
        )}

        {/* Workout Settings Dialog (AMA-96) */}
        <WorkoutSettingsDialog
          open={showWorkoutSettings}
          title={workoutWithIds.title}
          settings={workoutWithIds.settings}
          onSave={handleWorkoutSettingsSave}
          onClose={() => setShowWorkoutSettings(false)}
        />

      </div>

      {/* DragOverlay — renders outside SortableContexts for clean ghost preview */}
      <DragOverlay>
        {activeDragItem?.type === 'block' && (
          <div className="opacity-90 shadow-xl rotate-1 scale-95">
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <GripVertical className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium text-sm">{activeDragItem.label}</span>
              </div>
            </Card>
          </div>
        )}
        {(activeDragItem?.type === 'exercise' || activeDragItem?.type === 'superset-exercise') && (
          <div className="opacity-90 shadow-lg">
            <div className="flex items-center gap-2 p-3 border rounded-lg bg-background">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">{activeDragItem.label}</span>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
