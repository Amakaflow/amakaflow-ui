import { useEffect } from 'react';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AddSources } from '../components/AddSources';
import { StructureWorkout } from '../components/StructureWorkout';
import { ValidateMap } from '../components/ValidateMap';
import { PublishExport } from '../components/PublishExport';
import { TeamSharing } from '../components/TeamSharing';
import { WelcomeGuide } from '../components/WelcomeGuide';
import { HomeScreen } from '../components/Home/HomeScreen';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { WorkoutTypeConfirmDialog } from '../components/WorkoutTypeConfirmDialog';
import { PinterestBulkImportModal } from '../components/PinterestBulkImportModal';
import {
  Analytics,
  UserSettings,
  StravaEnhance,
  Calendar,
  UnifiedWorkouts,
  MobileCompanion,
  ImportScreen,
  HelpPage,
  ExerciseHistory,
  VolumeAnalytics,
  ProgramDetail,
  ProgramsList,
  CreateAIWorkout,
} from './router';
import type { View } from './router';
import type { AppUser } from './useAppAuth';
import type { DeviceId } from '../lib/devices';
import { isDemoMode } from '../lib/demo-mode';
import { setCurrentProfileId } from '../lib/workout-history';
import { normalizeWorkoutStructure } from '../lib/api';
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
  workoutHistoryList,
  refreshHistory,
  onNavigate,
  currentView,
  setCurrentView,
  stravaConnected,
}: WorkflowViewProps) {
  const {
    workout, setWorkout, workoutSaved, setWorkoutSaved,
    currentStep, currentStepIndex, steps,
    validation, exports, importProcessedItems, setImportProcessedItems,
    confirmDialog, setConfirmDialog, workoutTypeDialog,
    sources, loading, generationProgress,
    showStravaEnhance, pinterestBulkModal, welcomeDismissed, buildTimestamp,
    isEditingFromHistory, isCreatingFromScratch, isEditingFromImport,
    editingImportQueueId, selectedProgramId, setSelectedProgramId,
    handleGenerateStructure, handleCancelGeneration,
    handleLoadTemplate, handleCreateNew, handleStartNew, handleWelcomeDismiss,
    handlePinterestBulkImport, handlePinterestEditSingle, handlePinterestBulkClose,
    handleAutoMap, handleValidate, handleReValidate, handleProcess,
    handleLoadFromHistory, handleEditFromHistory,
    handleSaveFromStructure, handleEditFromImport, handleBackToImport,
    handleWorkoutTypeConfirm, handleWorkoutTypeSkip,
    handleBack, checkUnsavedChanges, clearWorkflowState,
    resetEditingFlags,
  } = useWorkflowState({
    user,
    selectedDevice,
    setSelectedDevice,
    refreshHistory,
    onNavigate,
    currentView,
    setCurrentView,
    stravaConnected,
  });

  // Sync selectedDevice when user.selectedDevices changes
  useEffect(() => {
    if (user?.selectedDevices?.length > 0 && !user.selectedDevices.includes(selectedDevice)) {
      setSelectedDevice(user.selectedDevices[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.selectedDevices]);

  return (
    <>
      {/* Workflow Header */}
      {currentView === 'workflow' && (
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-6">
            <div className="mb-6">
              <h1 className="text-2xl">
                {isEditingFromImport
                  ? 'Review Imported Workout'
                  : isEditingFromHistory
                  ? 'Edit Workout'
                  : 'Create Workout'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isEditingFromImport
                  ? 'Review and adjust your imported workout before saving'
                  : isEditingFromHistory
                  ? 'Edit your workout directly or re-validate if needed'
                  : 'Ingest \u2192 Structure \u2192 Validate \u2192 Export'}
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
        {currentView === 'workflow' && isEditingFromHistory && (
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
            {isEditingFromImport ? 'Back to Import' : 'Back to History'}
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
            <StructureWorkout
              workout={workout}
              onWorkoutChange={updatedWorkout => {
                setWorkout(updatedWorkout);
                setWorkoutSaved(false);
              }}
              onAutoMap={handleAutoMap}
              onValidate={handleValidate}
              onSave={
                isEditingFromHistory || isCreatingFromScratch
                  ? () => handleSaveFromStructure(exports, sources, validation)
                  : undefined
              }
              isEditingFromHistory={isEditingFromHistory}
              isCreatingFromScratch={isCreatingFromScratch}
              hideExport={isEditingFromImport}
              loading={loading}
              selectedDevice={selectedDevice}
              onDeviceChange={setSelectedDevice}
              userSelectedDevices={user.selectedDevices}
              onNavigateToSettings={() => {
                checkUnsavedChanges(() => {
                  clearWorkflowState();
                  setCurrentView('settings');
                });
              }}
            />
          </div>
        )}

        {/* Step: validate */}
        {currentView === 'workflow' && currentStep === 'validate' && validation && workout && (
          <ValidateMap
            validation={validation}
            workout={workout}
            onReValidate={handleReValidate}
            onProcess={handleProcess}
            loading={loading}
            selectedDevice={selectedDevice}
          />
        )}

        {/* Step: export */}
        {currentView === 'workflow' && currentStep === 'export' && exports && (
          <PublishExport
            exports={exports}
            validation={validation || undefined}
            sources={sources.map(s => `${s.type}:${s.content}`)}
            onStartNew={handleStartNew}
            selectedDevice={selectedDevice}
            userMode={user.mode}
            workout={workout}
          />
        )}

        {currentView === 'workflow' && showStravaEnhance && (
          <StravaEnhance onClose={() => setCurrentView('workflow')} />
        )}

        {currentView === 'analytics' &&
          (user ? (
            <Analytics user={user} history={workoutHistoryList} />
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Please sign in to view analytics</p>
            </div>
          ))}

        {currentView === 'exercise-history' && user && (
          <div data-assistant-target="workout-history">
            <ExerciseHistory user={user} />
          </div>
        )}

        {currentView === 'volume-analytics' && user && <VolumeAnalytics user={user} />}

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
            <UnifiedWorkouts
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
            />
          </div>
        )}

        {currentView === 'programs' && (
          <div data-assistant-target="workout-plan">
            <ProgramsList
              userId={user.id}
              onViewProgram={programId => {
                setSelectedProgramId(programId);
                setCurrentView('program-detail');
              }}
            />
          </div>
        )}

        {currentView === 'create-ai' && (
          <div data-assistant-target="workout-preview">
            <CreateAIWorkout />
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
              {validation && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-green-600">
                    &#x2713; {validation.validated_exercises.length} validated
                  </span>
                  <span className="text-orange-600">
                    &#x26A0; {validation.needs_review.length} review
                  </span>
                  <span className="text-red-600">
                    &#x2717; {validation.unmapped_exercises.length} unmapped
                  </span>
                </div>
              )}
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
