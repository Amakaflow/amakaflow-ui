import { supabase } from './supabase';
import { User } from '../types/auth';
import { DeviceId } from './devices';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

export interface SignUpData {
  email: string;
  password: string;
  name?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

/**
 * Sign up a new user
 */
export async function signUp({ email, password, name }: SignUpData) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
        },
      },
    });

    if (error) throw error;

    // Profile will be created automatically by database trigger
    // If trigger doesn't exist, we'll create it on first login

    return { user: data.user, session: data.session, error: null };
  } catch (error: any) {
    return { user: null, session: null, error };
  }
}

/**
 * Sign in an existing user
 */
export async function signIn({ email, password }: SignInData) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    return { user: data.user, session: data.session, error: null };
  } catch (error: any) {
    return { user: null, session: null, error };
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    return { error };
  }
}

/**
 * Delete the current user's account
 * This will delete both the auth user and their profile (cascade delete)
 * Uses Supabase Edge Function for secure deletion with admin privileges
 */
export async function deleteAccount() {
  try {
    // Get the current session to get the access token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }

    // Call the Edge Function to delete the user
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const response = await fetch(`${supabaseUrl}/functions/v1/delete-user-account`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey || '',
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to delete account');
    }

    // Sign out after deletion
    await supabase.auth.signOut();
    
    return { error: null };
  } catch (error: any) {
    return { error };
  }
}

/**
 * Get the current session
 */
export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { session: data.session, error: null };
  } catch (error: any) {
    return { session: null, error };
  }
}

/**
 * Get the current user
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return { user, error: null };
  } catch (error: any) {
    return { user: null, error };
  }
}

/**
 * Get the user's linked identity providers (OAuth providers)
 */
export async function getUserIdentityProviders() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return { providers: [], error };
    }

    // Get user identities from the user object
    const identities = user.identities || [];
    const providers = identities.map((identity: any) => identity.provider);

    return { providers, error: null };
  } catch (error: any) {
    return { providers: [], error };
  }
}

/**
 * Fetch user profile from database
 */
export async function getUserProfile(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Supabase returns a specific error code when no row is found
    if (error) {
      // PGRST116 = no rows returned (profile doesn't exist yet)
      if (error.code === 'PGRST116') {
        console.log('Profile not found for user:', userId);
        return null;
      }
      // For other errors, log and throw
      console.error('Error fetching user profile:', error);
      throw error;
    }

    if (!data) {
      console.log('No data returned for user:', userId);
      return null;
    }

    console.log('Profile data retrieved:', {
      id: data.id,
      email: data.email,
      selected_devices: data.selected_devices,
    });

    return {
      id: data.id,
      email: data.email,
      name: data.name || data.email.split('@')[0],
      subscription: data.subscription || 'free',
      workoutsThisWeek: data.workouts_this_week || 0,
      // Preserve empty arrays - don't fallback to ['garmin'] as that prevents profile completion
      selectedDevices: (data.selected_devices ?? []) as DeviceId[],
      billingDate: data.billing_date ? new Date(data.billing_date) : undefined,
    };
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    // Re-throw to let caller handle it
    throw error;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId: string, updates: Partial<User>) {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.subscription !== undefined) updateData.subscription = updates.subscription;
    if (updates.workoutsThisWeek !== undefined) updateData.workouts_this_week = updates.workoutsThisWeek;
    if (updates.selectedDevices !== undefined) updateData.selected_devices = updates.selectedDevices;
    if (updates.billingDate !== undefined) updateData.billing_date = updates.billingDate.toISOString();

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

/**
 * Sign in with OAuth provider (Google, Apple, etc.)
 */
export async function signInWithOAuth(provider: 'google' | 'apple') {
  try {
    // Check if user already has a session - if so, allow automatic sign-in
    const { data: { session } } = await supabase.auth.getSession();
    const hasExistingSession = !!session;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}`,
        queryParams: provider === 'google' ? {
          access_type: 'offline',
          // Don't set prompt - let Google handle it automatically
          // This allows automatic sign-in for returning users who are already logged in to Google
          // Google will only show account picker if needed (multiple accounts or not logged in)
        } : provider === 'apple' ? {
          // For Apple, we can't control the prompt directly, but we can skip showing the UI
          // if the user is already authenticated with Apple
          // Apple will handle automatic sign-in if the user is already logged in to iCloud
        } : undefined,
        // Skip browser redirect for Apple if user already has session (though Apple may still show UI)
        skipBrowserRedirect: false,
      },
    });

    if (error) throw error;

    // The redirect will happen automatically
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

/**
 * Handle OAuth callback
 */
export async function handleOAuthCallback() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { session: data.session, error: null };
  } catch (error: any) {
    return { session: null, error };
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}

