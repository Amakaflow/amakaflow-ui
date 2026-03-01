import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useClerkUser, getUserProfileFromClerk, syncClerkUserToProfile } from '../lib/clerk-auth';
import { isDemoMode, DEMO_USER } from '../lib/demo-mode';
import { User } from '../types/auth';
import { isAccountConnectedSync, isAccountConnected } from '../lib/linked-accounts';
import { setCurrentProfileId } from '../lib/workout-history';

export type AppUser = User & {
  avatar?: string;
  mode: 'individual' | 'trainer';
};

export interface UseAppAuthResult {
  user: AppUser | null;
  setUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
  authLoading: boolean;
  stravaConnected: boolean;
  setStravaConnected: React.Dispatch<React.SetStateAction<boolean>>;
  hasClerk: boolean;
  clerkLoaded: boolean;
  needsProfileCompletion: (u: AppUser | null) => boolean;
  handleProfileComplete: (updatedUser: User) => Promise<void>;
  handleLogout: () => void;
  loadUserProfile: (clerkUserId: string, retryCount?: number) => Promise<void>;
}

export function useAppAuth(): UseAppAuthResult {
  // Clerk authentication
  const { user: clerkUser, isLoaded: clerkLoaded } = useClerkUser();

  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [stravaConnected, setStravaConnected] = useState(false);

  // Check if Clerk is configured
  const hasClerk = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY &&
                   !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY.includes('placeholder');

  // Sync Clerk user with Supabase profile, or create default user if Clerk not configured
  useEffect(() => {
    const syncUser = async () => {
      if (isDemoMode) {
        setUser(DEMO_USER as AppUser);
        setAuthLoading(false);
        return;
      }

      // If Clerk not configured, create default user for development
      if (!hasClerk && !user) {
        setAuthLoading(true);
        const defaultUser: AppUser = {
          id: 'dev-user',
          email: 'dev@example.com',
          name: 'Developer',
          subscription: 'free',
          workoutsThisWeek: 0,
          selectedDevices: ['garmin'], // Pre-select Garmin as default device for dev mode
          mode: 'individual',
        };
        setUser(defaultUser);
        setCurrentProfileId('dev-user'); // Scope localStorage to dev user
        setAuthLoading(false);
        return;
      }

      // If Clerk is configured but not loaded yet, wait
      if (hasClerk && !clerkLoaded) {
        // Clerk is still loading
        return;
      }

      setAuthLoading(true);
      try {
        if (clerkUser) {
          console.log('Clerk user found, syncing with profile:', clerkUser.id);
          // Sync Clerk user to Supabase profile
          const profile = await syncClerkUserToProfile(clerkUser);
          if (profile) {
            setUser({
              ...profile,
              avatar: clerkUser.imageUrl,
              mode: 'individual' as const,
            });
            setCurrentProfileId(profile.id); // Scope localStorage to this user
          } else {
            // Profile creation failed, but we still have Clerk user
            // Create a temporary user object
            const email = clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress || '';
            const name = clerkUser.firstName && clerkUser.lastName
              ? `${clerkUser.firstName} ${clerkUser.lastName}`
              : clerkUser.firstName || clerkUser.username || email.split('@')[0];

            const tempUser: AppUser = {
              id: clerkUser.id,
              email: email,
              name: name,
              subscription: 'free',
              workoutsThisWeek: 0,
              selectedDevices: [],
              mode: 'individual',
              avatar: clerkUser.imageUrl,
            };
            setUser(tempUser);
            setCurrentProfileId(clerkUser.id); // Scope localStorage to this user
          }
          // Check Strava connection status from Supabase
          if (clerkUser?.id) {
            try {
              const connected = await isAccountConnected(clerkUser.id, 'strava');
              setStravaConnected(connected);
            } catch (error) {
              console.error('Error checking Strava connection:', error);
              setStravaConnected(false);
            }
          } else {
            setStravaConnected(false);
          }
        } else {
          // No Clerk user, clear app user
          setUser(null);
          setCurrentProfileId(null); // Clear localStorage scope
          setStravaConnected(false);
        }
      } catch (error: any) {
        console.error('Error syncing Clerk user:', error);
        toast.error(`Error: ${error.message || 'Failed to sync user'}`);
      } finally {
        setAuthLoading(false);
      }
    };

    syncUser();
  }, [clerkUser, clerkLoaded, hasClerk]);

  // Check if profile needs completion
  const needsProfileCompletion = (u: AppUser | null): boolean => {
    if (!u) return false;

    // Skip profile completion if Clerk is not configured (dev mode)
    if (!hasClerk) {
      return false;
    }

    // Profile needs completion if:
    // 1. No devices selected AND
    // 2. Strava is not connected
    const hasDevices = u.selectedDevices && u.selectedDevices.length > 0;
    const hasStrava = isAccountConnectedSync('strava');
    return !hasDevices && !hasStrava;
  };

  // Load user profile from Supabase (for Clerk user)
  const loadUserProfile = async (clerkUserId: string, retryCount = 0): Promise<void> => {
    try {
      console.log(`Loading profile for Clerk user ${clerkUserId} (attempt ${retryCount + 1})`);
      const profile = await getUserProfileFromClerk(clerkUserId);

      if (profile) {
        console.log('Profile found:', profile);
        console.log('Selected devices:', profile.selectedDevices, 'Length:', profile.selectedDevices.length);
        setUser({
          ...profile,
          avatar: clerkUser?.imageUrl,
          mode: 'individual' as const,
        });
      } else {
        console.log('No profile found, retry count:', retryCount);
        // Profile might not be created yet
        // Retry up to 3 times with increasing delays
        if (retryCount < 3) {
          console.log(`Retrying in ${500 * (retryCount + 1)}ms...`);
          setTimeout(() => {
            loadUserProfile(clerkUserId, retryCount + 1);
          }, 500 * (retryCount + 1)); // 500ms, 1000ms, 1500ms
          return;
        }

        // If profile still doesn't exist after retries, sync it
        console.log('Profile still not found after retries, syncing Clerk user');
        if (clerkUser) {
          const syncedProfile = await syncClerkUserToProfile(clerkUser);
          if (syncedProfile) {
            setUser({
              ...syncedProfile,
              avatar: clerkUser.imageUrl,
              mode: 'individual' as const,
            });
          }
        }
      }
      // Check Strava connection status from Supabase
      if (clerkUserId) {
        try {
          const connected = await isAccountConnected(clerkUserId, 'strava');
          setStravaConnected(connected);
        } catch (error) {
          console.error('Error checking Strava connection:', error);
          setStravaConnected(false);
        }
      } else {
        setStravaConnected(false);
      }
    } catch (error: any) {
      console.error('Error loading user profile:', error);
      // Only show toast for non-404 errors (profile not found is expected for new users)
      if (error?.code !== 'PGRST116') {
        toast.error(`Error loading profile: ${error.message || 'Unknown error'}`);
      }
    }
  };

  // Handle profile completion
  const handleProfileComplete = async (updatedUser: User): Promise<void> => {
    setUser({
      ...updatedUser,
      avatar: undefined,
      mode: 'individual' as const,
    });
    // Refresh Strava connection status from Supabase
    if (updatedUser.id) {
      try {
        const connected = await isAccountConnected(updatedUser.id, 'strava');
        setStravaConnected(connected);
      } catch (error) {
        console.error('Error checking Strava connection:', error);
        setStravaConnected(false);
      }
    } else {
      setStravaConnected(false);
    }
  };

  // Handle logout (Clerk handles this automatically via UserButton)
  // This is kept for compatibility but Clerk's UserButton handles sign out
  const handleLogout = (): void => {
    setUser(null);
    setStravaConnected(false);
  };

  return {
    user,
    setUser,
    authLoading,
    stravaConnected,
    setStravaConnected,
    hasClerk,
    clerkLoaded,
    needsProfileCompletion,
    handleProfileComplete,
    handleLogout,
    loadUserProfile,
  };
}
