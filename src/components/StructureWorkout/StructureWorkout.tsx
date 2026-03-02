import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical, Wand2, ShieldCheck, Edit2, Check, Move, Minimize2, Maximize2, Save, Download, Send, Info, Clock, Copy, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { ExerciseSearch } from '../ExerciseSearch';
import { EditExerciseDialog } from '../EditExerciseDialog';
import { EditBlockDialog } from '../EditBlockDialog';
import { WorkoutSettingsDialog } from '../WorkoutSettingsDialog';
import { AddBlockTypePicker } from '../AddBlockTypePicker';
import { WarmupSuggestionStrip, CooldownSuggestionStrip, DefaultRestStrip } from '../WorkoutSuggestionStrips';
import { DeviceId, getDevicesByIds, getDeviceById, getPrimaryExportDestinations } from '../../lib/devices';
import { WorkoutStructure, Block } from '../../types/workout';
import { generateId, getStructureDefaults, formatRestSecs } from '../../lib/workout-utils';
import { useStructureWorkout } from './hooks/useStructureWorkout';
import { SortableBlock } from './SortableBlock';

export interface StructureWorkoutProps {
  workout: WorkoutStructure;
  onWorkoutChange: (workout: WorkoutStructure) => void;
  onAutoMap: () => void;
  onValidate: () => void;
  onSave?: () => void | Promise<void>;
  isEditingFromHistory?: boolean;
  isCreatingFromScratch?: boolean;
  hideExport?: boolean;
  loading: boolean;
  selectedDevice: DeviceId;
  onDeviceChange: (device: DeviceId) => void;
  userSelectedDevices: DeviceId[];
  onNavigateToSettings?: () => void;
}

export function StructureWorkout(props: StructureWorkoutProps) {
  const {
    workout, onWorkoutChange, onAutoMap, onValidate, onSave,
    isEditingFromHistory = false, isCreatingFromScratch = false, hideExport = false,
    loading, selectedDevice, onDeviceChange, userSelectedDevices,
  } = props;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _availableDevices = getDevicesByIds(userSelectedDevices);

  const {
    workoutWithIds,
    showWorkoutSettings, setShowWorkoutSettings,
    editingExercise, setEditingExercise,
    editingBlockIdx, setEditingBlockIdx,
    showExerciseSearch, setShowExerciseSearch,
    addingToBlock, setAddingToBlock,
    addingToSuperset, setAddingToSuperset,
    collapseSignal, setCollapseSignal,
    jsonCopied, setJsonCopied,
    showAddBlockPicker, setShowAddBlockPicker,
    skippedWarmup, setSkippedWarmup,
    skippedCooldown, setSkippedCooldown,
    skippedRest, setSkippedRest,
    activeDragItem,
    handleDragStart,
    handleDragEnd,
    updateExercise,
    deleteExercise,
    addExercise,
    addSuperset,
    deleteSuperset,
    addBlock,
    updateBlock,
    deleteBlock,
    handleWorkoutSettingsSave,
    handleBlockSave,
  } = useStructureWorkout({ workout, onWorkoutChange });

  const hasWarmupBlock = (workoutWithIds.blocks || []).some(b => b.structure === 'warmup');
  const hasCooldownBlock = (workoutWithIds.blocks || []).some(b => b.structure === 'cooldown');
  const hasDefaultRest = !!workoutWithIds.settings?.defaultRestSec;
  const hasAnyBlock = (workoutWithIds.blocks || []).length > 0;

  const showWarmupStrip = hasAnyBlock && !hasWarmupBlock && !skippedWarmup;
  const showCooldownStrip = hasAnyBlock && !hasCooldownBlock && !skippedCooldown;
  const showRestStrip = hasAnyBlock && !hasDefaultRest && !skippedRest;

  const blockIds = (workoutWithIds.blocks || []).map(b => b.id);

  return (
    <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
            <Button onClick={() => setCollapseSignal({ action: 'collapse', timestamp: Date.now() })} variant="outline" size="sm" className="gap-2">
              <Minimize2 className="w-4 h-4" />Collapse All
            </Button>
            <Button onClick={() => setCollapseSignal({ action: 'expand', timestamp: Date.now() })} variant="outline" size="sm" className="gap-2">
              <Maximize2 className="w-4 h-4" />Expand All
            </Button>
          </div>
        </div>

        {showWarmupStrip && (
          <WarmupSuggestionStrip
            onAdd={() => {
              const w = { ...workoutWithIds, blocks: [...(workoutWithIds.blocks || [])] };
              const warmupBlock: Block = { id: generateId(), label: 'Warm-up', structure: 'warmup', exercises: [], warmup_enabled: true, ...getStructureDefaults('warmup') };
              w.blocks.unshift(warmupBlock);
              onWorkoutChange(w);
            }}
            onSkip={() => setSkippedWarmup(true)}
          />
        )}
        {showRestStrip && (
          <DefaultRestStrip onSet={() => setShowWorkoutSettings(true)} onSkip={() => setSkippedRest(true)} />
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
                    onAddExercise={() => { setAddingToBlock(blockIdx); setAddingToSuperset(null); setShowExerciseSearch(true); }}
                    onAddExerciseToSuperset={(supersetIdx) => { setAddingToBlock(blockIdx); setAddingToSuperset({ blockIdx, supersetIdx }); setShowExerciseSearch(true); }}
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

        {showCooldownStrip && (
          <CooldownSuggestionStrip
            onAdd={() => {
              const w = { ...workoutWithIds, blocks: [...(workoutWithIds.blocks || [])] };
              const cooldownBlock: Block = { id: generateId(), label: 'Cool-down', structure: 'cooldown', exercises: [], warmup_enabled: true, ...getStructureDefaults('cooldown') };
              w.blocks.push(cooldownBlock);
              onWorkoutChange(w);
            }}
            onSkip={() => setSkippedCooldown(true)}
          />
        )}

        {showAddBlockPicker ? (
          <AddBlockTypePicker onSelect={(structure) => addBlock(structure)} onCancel={() => setShowAddBlockPicker(false)} />
        ) : (
          <Button onClick={() => setShowAddBlockPicker(true)} variant="outline" className="gap-2" aria-label="Add Block">
            <Plus className="w-4 h-4" />Add Block
          </Button>
        )}

        {!hideExport && <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-3">
              <Label>Export Destination</Label>
              <Select value={selectedDevice} onValueChange={(value) => onDeviceChange(value as DeviceId)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select destination" /></SelectTrigger>
                <SelectContent>
                  {getPrimaryExportDestinations().map((device) => (
                    <SelectItem key={device.id} value={device.id} disabled={device.exportMethod === 'coming_soon'}>
                      <div className="flex items-center gap-2">
                        <span>{device.icon}</span><span>{device.name}</span>
                        {device.exportMethod === 'coming_soon' && <span className="text-xs text-muted-foreground ml-2">(Coming Soon)</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(() => {
                const device = getDeviceById(selectedDevice);
                if (!device) return null;
                return (
                  <Alert className="bg-muted/50">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {device.requiresMapping ? (<><strong>Requires exercise mapping.</strong> Your exercises will be matched to {device.name}'s exercise database for proper tracking on your device.</>) : (<><strong>Direct export.</strong> Your workout will be exported directly without exercise mapping.</>)}
                      {device.setupInstructions && <span className="block mt-1 text-muted-foreground">{device.setupInstructions}</span>}
                    </AlertDescription>
                  </Alert>
                );
              })()}
            </div>
            <div className="flex gap-2 flex-wrap">
              {(() => {
                const device = getDeviceById(selectedDevice);
                const needsMapping = device?.requiresMapping ?? true;
                const isAvailable = device?.exportMethod !== 'coming_soon';
                if (!isAvailable) {
                  return (<>{onSave && <Button onClick={onSave} disabled={loading} className="gap-2"><Save className="w-4 h-4" />Save to Library</Button>}<Button disabled className="gap-2 opacity-50"><Clock className="w-4 h-4" />{device?.name} Coming Soon</Button></>);
                }
                if (isEditingFromHistory || isCreatingFromScratch) {
                  return (<>{onSave && <Button onClick={onSave} disabled={loading} className="gap-2"><Save className="w-4 h-4" />{isCreatingFromScratch ? 'Save Workout' : 'Save Changes'}</Button>}{isEditingFromHistory && needsMapping && (<><Button onClick={onAutoMap} disabled={loading} variant="outline" className="gap-2"><Wand2 className="w-4 h-4" />Re-Map & Export</Button><Button onClick={onValidate} disabled={loading} variant="outline" className="gap-2"><ShieldCheck className="w-4 h-4" />Validate & Review</Button></>)}{isEditingFromHistory && !needsMapping && (<Button onClick={onAutoMap} disabled={loading} variant="outline" className="gap-2">{device?.exportMethod === 'file_download' ? <Download className="w-4 h-4" /> : <Send className="w-4 h-4" />}Export to {device?.name}</Button>)}</>);
                }
                if (needsMapping) {
                  return (<><Button onClick={onAutoMap} disabled={loading} className="gap-2"><Wand2 className="w-4 h-4" />Auto-Map & Export</Button><Button onClick={onValidate} disabled={loading} variant="outline" className="gap-2"><ShieldCheck className="w-4 h-4" />Validate & Review</Button>{onSave && <Button onClick={onSave} disabled={loading} variant="ghost" className="gap-2"><Save className="w-4 h-4" />Save Draft</Button>}</>);
                }
                return (<><Button onClick={onAutoMap} disabled={loading} className="gap-2">{device?.exportMethod === 'file_download' ? <Download className="w-4 h-4" /> : <Send className="w-4 h-4" />}Export to {device?.name}</Button>{onSave && <Button onClick={onSave} disabled={loading} variant="ghost" className="gap-2"><Save className="w-4 h-4" />Save Draft</Button>}</>);
              })()}
              {import.meta.env.DEV && (
                <Button onClick={() => { navigator.clipboard.writeText(JSON.stringify(workoutWithIds, null, 2)); setJsonCopied(true); setTimeout(() => setJsonCopied(false), 2000); }} variant="outline" className="gap-2">
                  {jsonCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{jsonCopied ? 'Copied!' : 'Copy JSON'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>}

        {showExerciseSearch && addingToBlock !== null && (
          <ExerciseSearch
            onSelect={(exerciseName) => addExercise(addingToBlock, exerciseName, addingToSuperset?.supersetIdx)}
            onClose={() => { setShowExerciseSearch(false); setAddingToBlock(null); setAddingToSuperset(null); }}
            device={selectedDevice}
          />
        )}

        {editingExercise && (() => {
          const { blockIdx, exerciseIdx, supersetIdx } = editingExercise;
          const currentExercise = supersetIdx !== undefined
            ? workoutWithIds.blocks[blockIdx]?.supersets?.[supersetIdx]?.exercises?.[exerciseIdx]
            : workoutWithIds.blocks[blockIdx]?.exercises[exerciseIdx];
          if (!currentExercise) { setEditingExercise(null); return null; }
          return (
            <EditExerciseDialog
              key={`${blockIdx}-${exerciseIdx}-${supersetIdx ?? 'block'}`}
              open={!!editingExercise}
              exercise={currentExercise}
              onSave={(updates) => updateExercise(blockIdx, exerciseIdx, updates, supersetIdx)}
              onClose={() => setEditingExercise(null)}
            />
          );
        })()}

        {editingBlockIdx !== null && (
          <EditBlockDialog
            open={editingBlockIdx !== null}
            block={workoutWithIds.blocks[editingBlockIdx]}
            workoutSettings={workoutWithIds.settings}
            onSave={(updates) => handleBlockSave(editingBlockIdx!, updates)}
            onClose={() => setEditingBlockIdx(null)}
          />
        )}

        <WorkoutSettingsDialog
          open={showWorkoutSettings}
          title={workoutWithIds.title}
          settings={workoutWithIds.settings}
          onSave={handleWorkoutSettingsSave}
          onClose={() => setShowWorkoutSettings(false)}
        />
      </div>

      <DragOverlay>
        {activeDragItem?.type === 'block' && (
          <div className="opacity-90 shadow-xl rotate-1 scale-95">
            <Card className="p-3"><div className="flex items-center gap-2"><GripVertical className="w-5 h-5 text-muted-foreground" /><span className="font-medium text-sm">{activeDragItem.label}</span></div></Card>
          </div>
        )}
        {(activeDragItem?.type === 'exercise' || activeDragItem?.type === 'superset-exercise') && (
          <div className="opacity-90 shadow-lg">
            <div className="flex items-center gap-2 p-3 border rounded-lg bg-background"><GripVertical className="w-4 h-4 text-muted-foreground" /><span className="font-medium text-sm">{activeDragItem.label}</span></div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
