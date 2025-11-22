import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Watch, Bike, Wand2, ShieldCheck, Edit2, Check, X, Trash2, GripVertical, Plus, Video, ExternalLink, Save } from 'lucide-react';
import { FollowAlongInstructions } from './FollowAlongInstructions';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WorkoutStructure, Exercise } from '../types/workout';
import { DeviceId, getDevicesByIds, getDeviceById } from '../lib/devices';
import { ExerciseSearch } from './ExerciseSearch';

type Props = {
  workout: WorkoutStructure;
  onWorkoutChange: (workout: WorkoutStructure) => void;
  onAutoMap: () => void;
  onValidate: () => void;
  onSave?: () => void | Promise<void>;
  isEditingFromHistory?: boolean;
  loading: boolean;
  selectedDevice: DeviceId;
  onDeviceChange: (device: DeviceId) => void;
  userSelectedDevices: DeviceId[];
};

type SortableExerciseProps = {
  exercise: Exercise;
  exerciseId: string;
  onEdit: () => void;
  onDelete: () => void;
};

function SortableExercise({ exercise, exerciseId, onEdit, onDelete }: SortableExerciseProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: exerciseId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getDisplayText = () => {
    const parts: string[] = [];
    if (exercise.sets) parts.push(`${exercise.sets} sets`);
    if (exercise.reps) parts.push(`${exercise.reps} reps`);
    if (exercise.reps_range) parts.push(`${exercise.reps_range} reps`);
    if (exercise.duration_sec) parts.push(`${exercise.duration_sec}s`);
    if (exercise.distance_m) parts.push(`${exercise.distance_m}m`);
    if (exercise.distance_range) parts.push(`${exercise.distance_range}`);
    if (exercise.rest_sec) parts.push(`Rest: ${exercise.rest_sec}s`);
    return parts.length > 0 ? parts.join(' • ') : 'No details';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50 hover:bg-muted"
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{exercise.name}</p>
          {exercise.followAlongUrl && (
            <a
              href={exercise.followAlongUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:text-primary/80"
              title="View follow-along video"
            >
              <Video className="w-4 h-4" />
            </a>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {getDisplayText()}
        </p>
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

export function StructureWorkout({
  workout,
  onWorkoutChange,
  onAutoMap,
  onValidate,
  onSave,
  isEditingFromHistory = false,
  loading,
  selectedDevice,
  onDeviceChange,
  userSelectedDevices
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(workout.title);
  const [editingExercise, setEditingExercise] = useState<{ blockIdx: number; supersetIdx: number; exerciseIdx: number } | null>(null);
  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [addingToBlock, setAddingToBlock] = useState<{ blockIdx: number; supersetIdx: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const availableDevices = getDevicesByIds(userSelectedDevices);

  const saveTitle = () => {
    onWorkoutChange({ ...workout, title: tempTitle });
    setEditingTitle(false);
  };

  const handleDragEnd = (event: DragEndEvent, blockIdx: number, supersetIdx: number) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const newWorkout = JSON.parse(JSON.stringify(workout));
      const exercises = newWorkout.blocks[blockIdx].supersets[supersetIdx].exercises;
      
      const oldIndex = exercises.findIndex((e: Exercise, idx: number) => `${blockIdx}-${supersetIdx}-${idx}` === active.id);
      const newIndex = exercises.findIndex((e: Exercise, idx: number) => `${blockIdx}-${supersetIdx}-${idx}` === over.id);
      
      newWorkout.blocks[blockIdx].supersets[supersetIdx].exercises = arrayMove(exercises, oldIndex, newIndex);
      onWorkoutChange(newWorkout);
    }
  };

  const deleteExercise = (blockIdx: number, supersetIdx: number, exerciseIdx: number) => {
    const newWorkout = JSON.parse(JSON.stringify(workout));
    newWorkout.blocks[blockIdx].supersets[supersetIdx].exercises.splice(exerciseIdx, 1);
    onWorkoutChange(newWorkout);
  };


  const updateExercise = (blockIdx: number, supersetIdx: number, exerciseIdx: number, updates: Partial<Exercise>) => {
    const newWorkout = JSON.parse(JSON.stringify(workout));
    const exercise = newWorkout.blocks[blockIdx].supersets[supersetIdx].exercises[exerciseIdx];
    newWorkout.blocks[blockIdx].supersets[supersetIdx].exercises[exerciseIdx] = {
      ...exercise,
      ...updates
    };
    onWorkoutChange(newWorkout);
    setEditingExercise(null);
  };

  const addExercise = (blockIdx: number, supersetIdx: number, exerciseName: string) => {
    const newWorkout = JSON.parse(JSON.stringify(workout));
    const newExercise: Exercise = {
      name: exerciseName,
      sets: 3,
      reps: 10,
      reps_range: null,
      duration_sec: null,
      rest_sec: 60,
      distance_m: null,
      distance_range: null,
      type: 'strength'
    };
    newWorkout.blocks[blockIdx].supersets[supersetIdx].exercises.push(newExercise);
    onWorkoutChange(newWorkout);
    setShowExerciseSearch(false);
    setAddingToBlock(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                    className="max-w-md"
                  />
                  <Button size="sm" onClick={saveTitle}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CardTitle>{workout.title}</CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setEditingTitle(true)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Target Device: {availableDevices.find(d => d.id === selectedDevice)?.name || getDeviceById(selectedDevice)?.name || selectedDevice}</Label>
            <div className="flex gap-2 mt-2">
              {availableDevices.map((device) => (
                <Button
                  key={device.id}
                  variant={selectedDevice === device.id ? 'default' : 'outline'}
                  onClick={() => onDeviceChange(device.id)}
                  className="gap-2"
                >
                  {device.id === 'garmin' && <Watch className="w-4 h-4" />}
                  {device.id === 'apple' && <Watch className="w-4 h-4" />}
                  {device.id === 'zwift' && <Bike className="w-4 h-4" />}
                  {device.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {isEditingFromHistory ? (
              <>
                {onSave && (
                  <Button onClick={onSave} disabled={loading} className="gap-2">
                    <Save className="w-4 h-4" />
                    Save Changes
                  </Button>
                )}
                <Button onClick={onAutoMap} disabled={loading} variant="outline" className="gap-2">
                  <Wand2 className="w-4 h-4" />
                  Re-Auto-Map & Export
                </Button>
                <Button onClick={onValidate} disabled={loading} variant="outline" className="gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Re-Validate & Review
                </Button>
              </>
            ) : (
              <>
                <Button onClick={onAutoMap} disabled={loading} className="gap-2">
                  <Wand2 className="w-4 h-4" />
                  Auto-Map & Export
                </Button>
                <Button onClick={onValidate} disabled={loading} variant="outline" className="gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Validate & Review
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <ScrollArea className="h-[600px]">
        <div className="space-y-4 pr-4">
          {workout.blocks.map((block, blockIdx) => (
            <Card key={blockIdx}>
              <CardHeader>
                <CardTitle className="text-lg">{block.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {block.supersets.map((superset, supersetIdx) => {
                  const exerciseIds = superset.exercises.map((_, idx) => `${blockIdx}-${supersetIdx}-${idx}`);
                  
                  return (
                    <div key={supersetIdx} className="space-y-2">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleDragEnd(event, blockIdx, supersetIdx)}
                      >
                        <SortableContext items={exerciseIds} strategy={verticalListSortingStrategy}>
                          {superset.exercises.map((exercise, exerciseIdx) => {
                            const exerciseId = `${blockIdx}-${supersetIdx}-${exerciseIdx}`;
                            
                            if (editingExercise?.blockIdx === blockIdx &&
                                editingExercise?.supersetIdx === supersetIdx &&
                                editingExercise?.exerciseIdx === exerciseIdx) {
                              return (
                                <Card key={exerciseId} className="p-3">
                                  <div className="space-y-3">
                                    <Input
                                      value={exercise.name}
                                      onChange={(e) => updateExercise(blockIdx, supersetIdx, exerciseIdx, { name: e.target.value })}
                                      placeholder="Exercise name"
                                    />
                                    <div className="flex gap-2">
                                      <Input
                                        value={exercise.sets || ''}
                                        onChange={(e) => updateExercise(blockIdx, supersetIdx, exerciseIdx, { sets: parseInt(e.target.value) || null })}
                                        placeholder="Sets"
                                        type="number"
                                        className="w-20"
                                      />
                                      <Input
                                        value={exercise.reps || ''}
                                        onChange={(e) => updateExercise(blockIdx, supersetIdx, exerciseIdx, { reps: e.target.value ? parseInt(e.target.value) : null })}
                                        placeholder="Reps"
                                        type="number"
                                        className="flex-1"
                                      />
                                      <Input
                                        value={exercise.rest_sec || ''}
                                        onChange={(e) => updateExercise(blockIdx, supersetIdx, exerciseIdx, { rest_sec: e.target.value ? parseInt(e.target.value) : null })}
                                        placeholder="Rest (sec)"
                                        type="number"
                                        className="w-24"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <Label className="text-sm flex items-center gap-2">
                                          <Video className="w-4 h-4" />
                                          Follow-Along Video URL
                                        </Label>
                                        <FollowAlongInstructions />
                                      </div>
                                      <Input
                                        value={exercise.followAlongUrl || ''}
                                        onChange={(e) => updateExercise(blockIdx, supersetIdx, exerciseIdx, { followAlongUrl: e.target.value || null })}
                                        placeholder="Instagram, TikTok, YouTube, or any video URL"
                                        type="url"
                                      />
                                      {exercise.followAlongUrl && (
                                        <a
                                          href={exercise.followAlongUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-primary hover:underline flex items-center gap-1"
                                        >
                                          Open link <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={() => setEditingExercise(null)}>
                                        Done
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => {
                                        updateExercise(blockIdx, supersetIdx, exerciseIdx, { followAlongUrl: null });
                                      }}>
                                        Clear Link
                                      </Button>
                                    </div>
                                  </div>
                                </Card>
                              );
                            }
                            
                            return (
                              <SortableExercise
                                key={exerciseId}
                                exercise={exercise}
                                exerciseId={exerciseId}
                                onEdit={() => setEditingExercise({ blockIdx, supersetIdx, exerciseIdx })}
                                onDelete={() => deleteExercise(blockIdx, supersetIdx, exerciseIdx)}
                              />
                            );
                          })}
                        </SortableContext>
                      </DndContext>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAddingToBlock({ blockIdx, supersetIdx });
                          setShowExerciseSearch(true);
                        }}
                        className="w-full gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Exercise
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Exercise Search Modal */}
      {showExerciseSearch && addingToBlock && (
        <ExerciseSearch
          onSelect={(exerciseName) => addExercise(addingToBlock.blockIdx, addingToBlock.supersetIdx, exerciseName)}
          onClose={() => {
            setShowExerciseSearch(false);
            setAddingToBlock(null);
          }}
          device={selectedDevice}
        />
      )}
    </div>
  );
}