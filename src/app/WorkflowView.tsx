import { ChevronRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AddSources } from '../components/AddSources';
import { StructureWorkout } from '../components/StructureWorkout/StructureWorkout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { WorkoutTypeConfirmDialog } from '../components/WorkoutTypeConfirmDialog';
import { PinterestBulkImportModal } from '../components/PinterestBulkImportModal';
import { StravaEnhance } from './router';
import type { View } from './router';
import type { AppUser } from './useAppAuth';
import type { DeviceId } from '../lib/devices';
import { getPrimaryExportDestinations } from '../lib/devices';
import { useWorkflowState } from './useWorkflowState';

export interface WorkflowViewProps {
  user: AppUser;
  selectedDevice: DeviceId;
  setSelectedDevice: (d: DeviceId) => void;
  workoutHistoryList: any[];
  refreshHistory: () => Promise<void>;
  onNavigate: (view: View) => void;
  currentView: View;
  setCurrentView: (v: View) => void;
  stravaConnected: boolean;
}

export function WorkflowView({
  user,
  selectedDevice,
  setSelectedDevice,
  workoutHistoryList: _workoutHistoryList,
  refreshHistory,
  onNavigate: _onNavigate,
  currentView,
  setCurrentView,
  stravaConnected: _stravaConnected,
}: WorkflowViewProps) {
  const {
    workout, setWorkout, workoutSaved, setWorkoutSaved,
    currentStep, currentStepIndex, steps,
    exports, validation,
    confirmDialog, setConfirmDialog, workoutTypeDialog,
    sources, loading, generationProgress,
    showStravaEnhance, pinterestBulkModal,
    isEditingFromHistory, isCreatingFromScratch, isEditingFromImport,
    editingImportQueueId,
    handleGenerateStructure, handleCancelGeneration,
    handleLoadTemplate, handleCreateNew,
    handlePinterestBulkImport, handlePinterestEditSingle, handlePinterestBulkClose,
    handleSaveFromStructure, handleBackToImport,
    handleWorkoutTypeConfirm, handleWorkoutTypeSkip,
    handleBack, resetEditingFlags,
    handleOpenExportPage,
  } = useWorkflowState({
    user,
    selectedDevice,
    setSelectedDevice,
    refreshHistory,
    currentView,
    setCurrentView,
  });

  return (
    <>
      {/* Workflow Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-2xl">
              {isEditingFromImport
                ? editingImportQueueId === 'ai-generated'
                  ? 'AI Generated Workout'
                  : 'Review Imported Workout'
                : isEditingFromHistory
                ? 'Edit Workout'
                : 'Create Workout'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditingFromImport
                ? editingImportQueueId === 'ai-generated'
                  ? 'Review and adjust your generated workout before saving'
                  : 'Review and adjust your imported workout before saving'
                : isEditingFromHistory
                ? 'Edit your workout directly or re-validate if needed'
                : 'Ingest \u2192 Structure \u2192 Export'}
            </p>
          </div>
          {!isEditingFromHistory && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {steps.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        currentStep === step.id
                          ? 'bg-primary text-primary-foreground'
                          : currentStepIndex > idx
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {step.number}
                    </div>
                    <div
                      className={`text-sm ${
                        currentStep === step.id
                          ? ''
                          : currentStepIndex > idx
                          ? 'text-primary'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </div>
                  </div>
                  {idx < steps.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground mx-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div
        id="main-content"
        data-assistant-target="main-content"
        className={`container mx-auto px-4 py-8 ${workout ? 'pb-32' : ''}`}
      >
        {/* Back button (non-editing) */}
        {currentStepIndex > 0 && !isEditingFromHistory && (
          <Button variant="ghost" onClick={handleBack} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}

        {/* Back button (editing from history or import) */}
        {isEditingFromHistory && !(workoutSaved && isEditingFromImport) && (
          <Button
            variant="ghost"
            onClick={() => {
              if (isEditingFromImport) {
                handleBackToImport(workout);
                return;
              }
              if (workout && !workoutSaved) {
                setConfirmDialog({
                  open: true,
                  title: 'Unsaved Changes',
                  description:
                    'Are you sure you want to go back? Any unsaved changes will be lost.',
                  onConfirm: () => {
                    setCurrentView('workouts');
                    resetEditingFlags();
                  },
                });
                return;
              }
              setCurrentView('workouts');
              resetEditingFlags();
            }}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {isEditingFromImport
              ? editingImportQueueId === 'ai-generated'
                ? 'Back to Create'
                : 'Back to Import'
              : 'Back to History'}
          </Button>
        )}

        {/* Step: add-sources */}
        {currentStep === 'add-sources' && (
          <AddSources
            onGenerate={handleGenerateStructure}
            progress={generationProgress}
            onCancel={handleCancelGeneration}
            onLoadTemplate={handleLoadTemplate}
            onCreateNew={handleCreateNew}
            loading={loading}
          />
        )}

        {/* Step: structure */}
        {currentStep === 'structure' && workout && (
          <div data-assistant-target="workout-log">
            {workoutSaved && isEditingFromImport ? (
              <div className="max-w-md mx-auto text-center py-16 space-y-6">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Workout Saved!</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    &ldquo;{workout.title}&rdquo; has been added to your library.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={() => {
                      setCurrentView('workouts');
                      resetEditingFlags();
                    }}
                  >
                    View in Library
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentView(editingImportQueueId === 'ai-generated' ? 'create-ai' : 'import');
                      resetEditingFlags();
                    }}
                  >
                    {editingImportQueueId === 'ai-generated' ? 'Generate Another' : 'Import Another'}
                  </Button>
                </div>
              </div>
            ) : (
              <StructureWorkout
                workout={workout}
                onWorkoutChange={updatedWorkout => {
                  setWorkout(updatedWorkout);
                  setWorkoutSaved(false);
                }}
                onExport={!isEditingFromImport ? (w) => {
                  const devices = getPrimaryExportDestinations();
                  const preferred = user.selectedDevices?.[0]
                    ? devices.find(d => d.id === user.selectedDevices[0])
                    : devices[0];
                  handleOpenExportPage(w, preferred ?? devices[0]);
                } : undefined}
                onSave={
                  isEditingFromHistory || isCreatingFromScratch
                    ? () => handleSaveFromStructure(exports, sources, validation)
                    : undefined
                }
                isEditingFromHistory={isEditingFromHistory}
                isCreatingFromScratch={isCreatingFromScratch}
                hideExport={isEditingFromImport}
                loading={loading}
              />
            )}
          </div>
        )}

        {showStravaEnhance && (
          <StravaEnhance onClose={() => setCurrentView('workflow')} />
        )}
      </div>

      {/* Footer Stats */}
      {workout && (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <Badge variant="outline">{workout.title}</Badge>
                <span className="text-muted-foreground">{workout.blocks.length} block(s)</span>
                <span className="text-muted-foreground">
                  {workout.blocks.reduce(
                    (sum, block) =>
                      sum +
                      (block.exercises?.length || 0) +
                      (block.supersets?.reduce(
                        (s, ss) => s + (ss.exercises?.length || 0),
                        0
                      ) || 0),
                    0
                  )}{' '}
                  exercise(s)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={open => setConfirmDialog({ ...confirmDialog, open })}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        confirmText="Continue"
        cancelText="Cancel"
      />

      <WorkoutTypeConfirmDialog
        open={workoutTypeDialog.open}
        detectedType={workoutTypeDialog.detectedType}
        confidence={workoutTypeDialog.confidence}
        onConfirm={handleWorkoutTypeConfirm}
        onSkip={handleWorkoutTypeSkip}
      />

      <PinterestBulkImportModal
        open={pinterestBulkModal.open}
        onClose={handlePinterestBulkClose}
        workouts={pinterestBulkModal.workouts}
        originalTitle={pinterestBulkModal.originalTitle}
        sourceUrl={pinterestBulkModal.sourceUrl}
        onImportSelected={handlePinterestBulkImport}
        onEditSingle={handlePinterestEditSingle}
      />
    </>
  );
}
