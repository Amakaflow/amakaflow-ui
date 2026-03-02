import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { GripVertical, Plus, Layers, ChevronDown, ChevronUp, Edit2, Trash2, Clock, Settings2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Block, WorkoutSettings, WorkoutStructureType } from '../../types/workout';
import { getBlockKeyMetric } from '../../lib/workout-utils';
import { BlockConfigRow } from '../BlockConfigRow';
import { ConfirmDialog } from '../ConfirmDialog';
import { DroppableSuperset } from '../DroppableSuperset';
import { SortableExercise } from './SortableExercise';

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

// ── @dnd-kit drag data shapes ─────────────────────────────────────────────────
type DraggableData =
  | { type: 'block'; blockIdx: number }
  | { type: 'exercise'; blockIdx: number; exerciseIdx: number; supersetIdx: null }
  | { type: 'superset-exercise'; blockIdx: number; supersetIdx: number; exerciseIdx: number };

// ── Sortable Block ────────────────────────────────────────────────────────────
export function SortableBlock({
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
