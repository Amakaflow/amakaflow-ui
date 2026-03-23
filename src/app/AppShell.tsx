import { useState, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { SignInButton, SignUpButton } from '@clerk/clerk-react';
import { Button } from '../components/ui/button';
import { ChatProvider } from '../context/ChatContext';
import { ProgressProvider } from '../components/ProgressView';
import { ChatAwareLayout } from '../components/ChatAwareLayout';
import { ProfileCompletion } from '../components/ProfileCompletion';
import { BuildBadge } from '../components/BuildBadge';
import { DevSystemStatus } from '../components/DevSystemStatus';
import { ChatPanel } from '../components/ChatPanel';
import { DemoNav } from '../components/DemoNav';
import { BottomNav } from '../components/BottomNav';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ModalOutlet } from '../components/ModalOutlet';
import { useAppAuth } from './useAppAuth';
import { useWorkoutHistory } from './useWorkoutHistory';
import { NavBar } from './NavBar';
import { WorkflowView } from './WorkflowView';
import type { View } from './router';
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
  ConnectionsPage,
  CoachChat,
  SyncDashboardPage,
  TrainingPreferencesPage,
} from './router';
import { TeamSharing } from '../components/TeamSharing';
import { HomeScreen } from '../components/Home/HomeScreen';
import { WelcomeGuide } from '../components/WelcomeGuide';
import { ExportPage } from '../components/Export';
import { DeviceId } from '../lib/devices';
import { VIEW_TO_PATH, pathToView } from '../hooks/useUrlSync';
import { useWorkflowState } from './useWorkflowState';
import { getPrimaryExportDestinations } from '../lib/devices';
import { normalizeWorkoutStructure } from '../lib/api';
import { isDemoMode } from '../lib/demo-mode';
import { setCurrentProfileId } from '../lib/workout-history';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

export function AppShell() {
  const { user, authLoading, stravaConnected, hasClerk, clerkLoaded, needsProfileCompletion, handleProfileComplete } = useAppAuth();
  const { workoutHistoryList, refreshHistory } = useWorkoutHistory(user);
  const [selectedDevice, setSelectedDevice] = useState<DeviceId>('garmin');

  // Use react-router for navigation
  const nav = useNavigate();
  const location = useLocation();

  // Phase 4: background location for modal routes
  const state = location.state as { backgroundLocation?: Location } | null;
  const backgroundLocation = state?.backgroundLocation;
  const displayLocation = backgroundLocation || location;

  const currentView: View = pathToView(displayLocation.pathname);

  // Provide a setCurrentView that navigates via react-router
  const setCurrentView = (view: View) => {
    const path = VIEW_TO_PATH[view] || '/';
    nav(path);
  };
  const navigate = setCurrentView;

  // Workflow state (still needs setCurrentView for internal hooks)
  const workflowState = useWorkflowState({
    user: user!,
    selectedDevice,
    setSelectedDevice,
    refreshHistory,
    currentView,
    setCurrentView,
  });

  if ((hasClerk && !clerkLoaded) || authLoading) return <Spinner />;

  if (hasClerk && !user) {
    return (
      <>
        <Toaster position="top-center" />
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-primary/10">
          <div className="w-full max-w-md space-y-4 text-center">
            <div className="flex justify-center">
              <img src="/logo.png" alt="AmakaFlow" className="w-24 h-24 rounded-xl object-contain" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">AmakaFlow</h1>
              <p className="mt-2 text-muted-foreground">Transform workout content into structured training for your devices</p>
            </div>
            <div className="space-y-2">
              <SignInButton mode="modal"><Button className="w-full">Sign In</Button></SignInButton>
              <SignUpButton mode="modal"><Button variant="outline" className="w-full">Sign Up</Button></SignUpButton>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (user && needsProfileCompletion(user)) {
    return (
      <>
        <Toaster position="top-center" />
        <ProfileCompletion user={user} onComplete={handleProfileComplete} />
      </>
    );
  }

  if (!user) return <Spinner />;

  return (
    <ProgressProvider demo>
    <ChatProvider>
      <ChatAwareLayout>
        <Toaster position="top-center" />
        <NavBar
          user={user}
          currentView={currentView}
          stravaConnected={stravaConnected}
          hasClerk={hasClerk}
          onNavigate={navigate}
        />
        <div className="pb-16 md:pb-0">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes location={displayLocation}>
              {/* Home */}
              <Route
                path="/"
                element={
                  <HomeRoute
                    user={user}
                    workoutHistoryList={workoutHistoryList}
                    navigate={navigate}
                    workflowState={workflowState}
                  />
                }
              />

              {/* Workflow */}
              <Route
                path="/workflow"
                element={
                  <WorkflowView
                    user={user}
                    selectedDevice={selectedDevice}
                    setSelectedDevice={setSelectedDevice}
                    workoutHistoryList={workoutHistoryList}
                    refreshHistory={refreshHistory}
                    onNavigate={navigate}
                    currentView="workflow"
                    setCurrentView={setCurrentView}
                    stravaConnected={stravaConnected}
                  />
                }
              />

              {/* Dashboard */}
              <Route path="/dashboard" element={<SyncDashboardPage />} />

              {/* Import */}
              <Route
                path="/import"
                element={
                  <ImportScreen
                    userId={user.id}
                    onDone={() => navigate('workouts')}
                    initialProcessedItems={workflowState.importProcessedItems.length > 0 ? workflowState.importProcessedItems : undefined}
                    onUpdateProcessedItems={workflowState.setImportProcessedItems}
                    onEditWorkout={workflowState.handleEditFromImport}
                    onNavigate={(view: View) => navigate(view)}
                  />
                }
              />

              {/* Create AI */}
              <Route
                path="/create-ai"
                element={
                  <div data-assistant-target="workout-preview">
                    <CreateAIWorkout
                      onNavigate={(view) => navigate(view as View)}
                      onWorkoutGenerated={(w) =>
                        workflowState.handleEditFromImport('ai-generated', w as unknown as Record<string, unknown>)
                      }
                    />
                  </div>
                }
              />

              {/* Calendar */}
              <Route
                path="/calendar"
                element={
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
                }
              />

              {/* Workouts */}
              <Route
                path="/workouts"
                element={
                  <WorkoutsRoute
                    user={user}
                    selectedDevice={selectedDevice}
                    workflowState={workflowState}
                    navigate={navigate}
                  />
                }
              />

              {/* Programs */}
              <Route
                path="/programs"
                element={
                  <div data-assistant-target="workout-plan">
                    <ProgramsList
                      userId={user.id}
                      onViewProgram={programId => {
                        workflowState.setSelectedProgramId(programId);
                        navigate('program-detail');
                      }}
                      onAddToCalendar={() => navigate('calendar')}
                    />
                  </div>
                }
              />

              {/* Program Detail */}
              <Route
                path="/programs/detail"
                element={
                  workflowState.selectedProgramId ? (
                    <ProgramDetail
                      programId={workflowState.selectedProgramId}
                      userId={user.id}
                      onBack={() => {
                        workflowState.setSelectedProgramId(null);
                        navigate('workouts');
                      }}
                      onDeleted={() => {
                        workflowState.setSelectedProgramId(null);
                        navigate('workouts');
                      }}
                    />
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">No program selected</div>
                  )
                }
              />

              {/* Analytics */}
              <Route
                path="/analytics"
                element={<AnalyticsHub user={user} history={workoutHistoryList} />}
              />

              {/* Team */}
              <Route
                path="/team"
                element={<TeamSharing user={user} currentWorkout={workflowState.workout} />}
              />

              {/* Settings */}
              <Route
                path="/settings"
                element={
                  <div data-assistant-target="preferences-panel">
                    <UserSettings
                      user={user}
                      onBack={() => navigate('workflow')}
                      onAccountsChange={async () => {}}
                      onAccountDeleted={() => {
                        setCurrentProfileId(null);
                        navigate('home');
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
                      onNavigateToMobileCompanion={() => navigate('mobile-companion')}
                      onNavigateToConnections={() => navigate('connections')}
                      onNavigateToCoach={() => navigate('coach')}
                    />
                  </div>
                }
              />

              {/* Settings sub-routes */}
              <Route path="/settings/connections" element={<ConnectionsPage onBack={() => navigate('settings')} />} />
              <Route path="/settings/preferences" element={<TrainingPreferencesPage />} />

              {/* Strava Enhance */}
              <Route path="/strava-enhance" element={<StravaEnhance onClose={() => navigate('workflow')} />} />

              {/* Coach */}
              <Route
                path="/coach"
                element={
                  <div className="h-[calc(100vh-4rem)]">
                    <CoachChat />
                  </div>
                }
              />

              {/* Help */}
              <Route path="/help" element={<HelpPage onBack={() => navigate('home')} />} />

              {/* Mobile Companion */}
              <Route path="/mobile-companion" element={<MobileCompanion userId={user.id} onBack={() => navigate('settings')} />} />

              {/* Export */}
              <Route
                path="/export"
                element={
                  (workflowState.exportingWorkout || workflowState.exportingWorkouts.length > 0) ? (
                    <ExportPage
                      initialWorkout={workflowState.exportingWorkout ?? undefined}
                      initialWorkouts={workflowState.exportingWorkouts.length > 0 ? workflowState.exportingWorkouts : undefined}
                      initialDevice={workflowState.exportingDevice ?? undefined}
                      devices={getPrimaryExportDestinations()}
                      onBack={workflowState.handleExportBack}
                    />
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">No workout to export</div>
                  )
                }
              />

              {/* Profile (placeholder) */}
              <Route path="/profile" element={<div className="p-8 text-center">Profile</div>} />

              {/* Catch-all: redirect to home */}
              <Route
                path="*"
                element={
                  <HomeRoute
                    user={user}
                    workoutHistoryList={workoutHistoryList}
                    navigate={navigate}
                    workflowState={workflowState}
                  />
                }
              />
            </Routes>

            {/* Phase 4: Modal routes render on top of background location */}
            <ModalOutlet />
          </Suspense>
        </div>
        <BuildBadge />
        <DevSystemStatus />
        <ChatPanel />
        <BottomNav currentView={currentView} onNavigate={navigate} />
        <DemoNav />
      </ChatAwareLayout>
    </ChatProvider>
    </ProgressProvider>
  );
}

// ─── Route helper components ───────────────────────────────────────────────────

function HomeRoute({
  user,
  workoutHistoryList,
  navigate,
  workflowState,
}: {
  user: any;
  workoutHistoryList: any[];
  navigate: (view: View) => void;
  workflowState: any;
}) {
  if (workflowState.welcomeDismissed) {
    return (
      <HomeScreen
        user={user}
        recentWorkouts={workoutHistoryList}
        onNavigate={navigate}
      />
    );
  }
  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <WelcomeGuide
          onGetStarted={() => {
            workflowState.handleWelcomeDismiss();
            navigate('workflow');
          }}
          onDismiss={workflowState.handleWelcomeDismiss}
        />
        {!isDemoMode && (
          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground">
              Build: {new Date(workflowState.buildTimestamp).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function WorkoutsRoute({
  user,
  selectedDevice,
  workflowState,
  navigate,
}: {
  user: any;
  selectedDevice: DeviceId;
  workflowState: any;
  navigate: (view: View) => void;
}) {
  return (
    <div data-assistant-target="workout-list">
      <WorkoutList
        profileId={user.id}
        onEditWorkout={item => {
          workflowState.handleEditFromHistory({
            ...item,
            workout: normalizeWorkoutStructure(item.workout),
          });
        }}
        onLoadWorkout={item => {
          workflowState.handleLoadFromHistory({
            ...item,
            workout: normalizeWorkoutStructure(item.workout),
          });
        }}
        onDeleteWorkout={id => {
          console.log('Workout deleted:', id);
        }}
        onViewProgram={programId => {
          workflowState.setSelectedProgramId(programId);
          navigate('program-detail');
        }}
        onExportWorkout={(item, device) => {
          const w = normalizeWorkoutStructure(item.workout);
          if (device.requiresMapping) {
            workflowState.handleOpenExportPage(w, device);
          } else {
            workflowState.handleInlineExport(w, device);
          }
        }}
        onBatchExport={(items) => {
          const workouts = items.map(item => normalizeWorkoutStructure(item.workout));
          workflowState.handleBatchExport(workouts);
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
          workflowState.handleLoadFromHistory({
            ...fakeHistoryItem,
            workout: normalizeWorkoutStructure(fakeHistoryItem.workout as any),
          } as any);
        }}
        onNavigate={navigate}
        onAddToCalendar={() => navigate('calendar')}
      />
    </div>
  );
}
