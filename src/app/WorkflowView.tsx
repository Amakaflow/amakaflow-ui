import React from 'react';
import { ChevronRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AddSources } from '../components/AddSources';
import { StructureWorkout } from '../components/StructureWorkout/StructureWorkout';
import { TeamSharing } from '../components/TeamSharing';
import { WelcomeGuide } from '../components/WelcomeGuide';
import { HomeScreen } from '../components/Home/HomeScreen';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { WorkoutTypeConfirmDialog } from '../components/WorkoutTypeConfirmDialog';
import { PinterestBulkImportModal } from '../components/PinterestBulkImportModal';
import { ExportPage } from '../components/Export';
import {
  AnalyticsHub,
  UserSettings,
  StravaEnhance,
  Calendar,
  WorkoutList,
  MobileCompanion,
  ImportScreen,
  HelpPage,
  ProgramDetail,
  ProgramsList,
  CreateAIWorkout,
} from './router';
import type { View } from './router';
import type { AppUser } from './useAppAuth';
import type { DeviceId, DeviceConfig } from '../lib/devices';
import { getPrimaryExportDestinations } from '../lib/devices';
import { isDemoMode } from '../lib/demo-mode';
import { setCurrentProfileId } from '../lib/workout-history';
import { normalizeWorkoutStructure } from '../lib/api';
import { useWorkflowState } from './useWorkflowState';
import type { WorkoutStructure } from '../types/workout';

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
  workoutHistoryList,
  refreshHistory,
  onNavigate: _onNavigate,
  currentView,
  setCurrentView,
  stravaConnected: _stravaConnected,
}: WorkflowViewProps) {
  const {
    workout, setWorkout, workoutSaved, setWorkoutSaved,
    currentStep, currentStepIndex, steps,
    exports, validation, importProcessedItems, setImportProcessedItems,
    confirmDialog, setConfirmDialog, workoutTypeDialog,
    sources, loading, generationProgress,
    showStravaEnhance, pinterestBulkModal, welcomeDismissed, buildTimestamp,
    isEditingFromHistory, isCreatingFromScratch, isEditingFromImport,
    editingImportQueueId, selectedProgramId, setSelectedProgramId,
    handleGenerateStructure, handleCancelGeneration,
    handleLoadTemplate, handleCreateNew, handleStartNew, handleWelcomeDismiss,
    handlePinterestBulkImport, handlePinterestEditSingle, handlePinterestBulkClose,
    handleLoadFromHistory, handleEditFromHistory,
    handleSaveFromStructure, handleEditFromImport, handleBackToImport,
    handleWorkoutTypeConfirm, handleWorkoutTypeSkip,
    handleBack, checkUnsavedChanges, clearWorkflowState,
    resetEditingFlags,
    // Export state from validation hook
    exportingWorkout, exportingWorkouts, exportingDevice,
    handleOpenExportPage, handleInlineExport,
    setExportingWorkout, setExportingWorkouts, setExportingDevice,
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
      {currentView === 'workflow' && (
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
      )}

      {/* Main Content */}
      <div
        id="main-content"
        role="main"
        data-assistant-target="main-content"
        className={`container mx-auto px-4 py-8 ${
          currentView === 'workflow' && workout ? 'pb-32' : ''
        }`}
      >
        {/* Home view */}
        {currentView === 'home' && (
          welcomeDismissed ? (
            <HomeScreen
              user={user}
              recentWorkouts={workoutHistoryList}
              onNavigate={setCurrentView}
            />
          ) : (
            <>
              <WelcomeGuide
                onGetStarted={() => {
                  handleWelcomeDismiss();
                  setCurrentView('workflow');
                }}
                onDismiss={handleWelcomeDismiss}
              />
              {!isDemoMode && (
                <div className="mt-8 text-center">
                  <p className="text-xs text-muted-foreground">
                    Build: {new Date(buildTimestamp).toLocaleString()}
                  </p>
                </div>
              )}
            </>
          )
        )}

        {/* Back button (non-editing) */}
        {currentView === 'workflow' && currentStepIndex > 0 && !isEditingFromHistory && (
          <Button variant="ghost" onClick={handleBack} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}

        {/* Back button (editing from history or import) */}
        {currentView === 'workflow' && isEditingFromHistory && !(workoutSaved && isEditingFromImport) && (
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
        {currentView === 'workflow' && currentStep === 'add-sources' && (
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
        {currentView === 'workflow' && currentStep === 'structure' && workout && (
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

        {currentView === 'workflow' && showStravaEnhance && (
          <StravaEnhance onClose={() => setCurrentView('workflow')} />
        )}

        {currentView === 'analytics' && user && (
          <AnalyticsHub user={user} history={workoutHistoryList} />
        )}

        {currentView === 'team' && (
          <TeamSharing user={user} currentWorkout={workout} />
        )}

        {currentView === 'settings' && (
          <div data-assistant-target="preferences-panel">
            <UserSettings
              user={user}
              onBack={() => setCurrentView('workflow')}
              onAccountsChange={async () => {}}
              onAccountDeleted={() => {
                setCurrentProfileId(null);
                setCurrentView('home');
              }}
              onUserUpdate={updates => {
                if (
                  updates.selectedDevices &&
                  updates.selectedDevices.length > 0 &&
                  !updates.selectedDevices.includes(selectedDevice)
                ) {
                  setSelectedDevice(updates.selectedDevices[0]);
                }
              }}
              onNavigateToMobileCompanion={() => setCurrentView('mobile-companion')}
            />
          </div>
        )}

        {currentView === 'help' && <HelpPage onBack={() => setCurrentView('home')} />}

        {currentView === 'strava-enhance' && (
          <StravaEnhance onClose={() => setCurrentView('workflow')} />
        )}

        {currentView === 'calendar' && (
          <div data-assistant-target="calendar-section">
            <Calendar
              userId={user.id}
              userLocation={{
                address: user.address,
                city: user.city,
                state: user.state,
                zipCode: user.zipCode,
              }}
            />
          </div>
        )}

        {currentView === 'workouts' && (
          <div data-assistant-target="workout-list">
            <WorkoutList
              profileId={user.id}
              onEditWorkout={item => {
                handleEditFromHistory({
                  ...item,
                  workout: normalizeWorkoutStructure(item.workout),
                });
              }}
              onLoadWorkout={item => {
                handleLoadFromHistory({
                  ...item,
                  workout: normalizeWorkoutStructure(item.workout),
                });
              }}
              onDeleteWorkout={id => {
                console.log('Workout deleted:', id);
              }}
              onViewProgram={programId => {
                setSelectedProgramId(programId);
                setCurrentView('program-detail');
              }}
              onExportWorkout={(item, device) => {
                const workout = normalizeWorkoutStructure(item.workout);
                if (device.requiresMapping) {
                  handleOpenExportPage(workout, device);
                } else {
                  handleInlineExport(workout, device);
                }
              }}
              onBatchExport={(items) => {
                const workouts = items.map(item => normalizeWorkoutStructure(item.workout));
                setExportingWorkouts(workouts);
                setExportingWorkout(null);
                setExportingDevice(null);
                setCurrentView('export-page');
              }}
              onMergeWorkouts={(merged) => {
                const fakeHistoryItem = {
                  id: 'merge-' + Date.now(),
                  workout: { title: merged.title, blocks: merged.blocks },
                  sources: [],
                  device: user.selectedDevices?.[0] ?? selectedDevice,
                  validation: null,
                  exports: null,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                handleLoadFromHistory({
                  ...fakeHistoryItem,
                  workout: normalizeWorkoutStructure(fakeHistoryItem.workout as any),
                } as any);
              }}
              onNavigate={setCurrentView}
              onAddToCalendar={() => setCurrentView('calendar')}
            />
          </div>
        )}

        {currentView === 'export-page' && (exportingWorkout || exportingWorkouts.length > 0) && (
          <ExportPage
            initialWorkout={exportingWorkout ?? undefined}
            initialWorkouts={exportingWorkouts.length > 0 ? exportingWorkouts : undefined}
            initialDevice={exportingDevice ?? undefined}
            devices={getPrimaryExportDestinations()}
            onBack={() => {
              setCurrentView('workouts');
              setExportingWorkout(null);
              setExportingWorkouts([]);
              setExportingDevice(null);
            }}
          />
        )}

        {currentView === 'programs' && (
          <div data-assistant-target="workout-plan">
            <ProgramsList
              userId={user.id}
              onViewProgram={programId => {
                setSelectedProgramId(programId);
                setCurrentView('program-detail');
              }}
              onAddToCalendar={() => setCurrentView('calendar')}
            />
          </div>
        )}

        {currentView === 'create-ai' && (
          <div data-assistant-target="workout-preview">
            <CreateAIWorkout
              onNavigate={(view) => setCurrentView(view)}
              onWorkoutGenerated={(workout) =>
                handleEditFromImport('ai-generated', workout as unknown as Record<string, unknown>)
              }
            />
          </div>
        )}

        {currentView === 'mobile-companion' && (
          <MobileCompanion userId={user.id} onBack={() => setCurrentView('settings')} />
        )}

        {currentView === 'import' && (
          <ImportScreen
            userId={user.id}
            onDone={() => setCurrentView('workouts')}
            initialProcessedItems={importProcessedItems.length > 0 ? importProcessedItems : undefined}
            onUpdateProcessedItems={setImportProcessedItems}
            onEditWorkout={handleEditFromImport}
            onNavigate={(view: View) => setCurrentView(view)}
          />
        )}

        {currentView === 'program-detail' && selectedProgramId && (
          <ProgramDetail
            programId={selectedProgramId}
            userId={user.id}
            onBack={() => {
              setSelectedProgramId(null);
              setCurrentView('workouts');
            }}
            onDeleted={() => {
              setSelectedProgramId(null);
              setCurrentView('workouts');
            }}
          />
        )}
      </div>

      {/* Footer Stats */}
      {currentView === 'workflow' && workout && (
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
