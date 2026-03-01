import { useState, Suspense } from 'react';
import { Toaster } from 'sonner';
import { SignInButton, SignUpButton } from '@clerk/clerk-react';
import { Button } from '../components/ui/button';
import { ChatProvider } from '../context/ChatContext';
import { ChatAwareLayout } from '../components/ChatAwareLayout';
import { ProfileCompletion } from '../components/ProfileCompletion';
import { BuildBadge } from '../components/BuildBadge';
import { DevSystemStatus } from '../components/DevSystemStatus';
import { ChatPanel } from '../components/ChatPanel';
import { DemoNav } from '../components/DemoNav';
import { useAppAuth } from './useAppAuth';
import { useWorkoutHistory } from './useWorkoutHistory';
import { NavBar } from './NavBar';
import { WorkflowView } from './WorkflowView';
import { View } from './router';
import { DeviceId } from '../lib/devices';

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
  const [currentView, setCurrentView] = useState<View>('home');
  const [selectedDevice, setSelectedDevice] = useState<DeviceId>('garmin');
  const navigate = (view: View) => setCurrentView(view);

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
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
          <WorkflowView
            user={user}
            selectedDevice={selectedDevice}
            setSelectedDevice={setSelectedDevice}
            workoutHistoryList={workoutHistoryList}
            refreshHistory={refreshHistory}
            onNavigate={navigate}
            currentView={currentView}
            setCurrentView={setCurrentView}
            stravaConnected={stravaConnected}
          />
        </Suspense>
        <BuildBadge />
        <DevSystemStatus />
        <ChatPanel />
        <DemoNav />
      </ChatAwareLayout>
    </ChatProvider>
  );
}
