/**
 * Clerk Authentication Integration
 * 
 * This file provides Clerk-based authentication functions that integrate
 * with the existing Supabase profiles database.
 */

import { useUser, useAuth } from '@clerk/clerk-react';
import { supabase } from './supabase';
import { User } from '../types/auth';
import { DeviceId } from './devices';

/**
 * Get the current Clerk user
 * Use this hook in components: const { user } = useClerkUser();
 */
export function useClerkUser() {
  // Check if Clerk is actually configured (has real publishable key, not placeholder)
  const hasClerk = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY && 
                   !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY.includes('placeholder');
  
  // If no Clerk configured, return mock values immediately without calling hook
  // This avoids the "useUser can only be used within ClerkProvider" error
  if (!hasClerk) {
    return {
      user: null,
      isLoaded: true,
      isSignedIn: false,
    } as ReturnType<typeof useUser>;
  }
  
  // Must always call hooks unconditionally (React rules)
  // But we've already checked, so this only executes when hasClerk is true
  // and ClerkProvider should exist
  return useUser();
}

/**
 * Get Clerk auth functions
 * Use this hook in components: const { signOut } = useClerkAuth();
 */
export function useClerkAuth() {
  // Check if Clerk is actually configured (has real publishable key, not placeholder)
  const hasClerk = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY && 
                   !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY.includes('placeholder');
  
  // If no Clerk configured, return mock auth functions
  if (!hasClerk) {
    return {
      signOut: () => Promise.resolve(),
      isSignedIn: false,
      userId: null,
      sessionId: null,
    } as ReturnType<typeof useAuth>;
  }
  
  // Must always call hooks unconditionally (React rules)
  return useAuth();
}

/**
 * Get user profile from Supabase (linked to Clerk user ID)
 */
export async function getUserProfileFromClerk(clerkUserId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', clerkUserId)
      .single();

    if (error) {
      // PGRST116 = no rows returned (profile doesn't exist yet)
      if (error.code === 'PGRST116') {
        console.log('Profile not found for Clerk user:', clerkUserId);
        return null;
      }
      console.error('Error fetching user profile:', error);
      throw error;
    }

    if (!data) {
      return null;
    }

    // Handle selected_devices: can be array (old format) or object (new format with exportGarminUsb)
    let selectedDevices: DeviceId[] = [];
    let exportGarminUsb = false;

    if (data.selected_devices) {
      if (Array.isArray(data.selected_devices)) {
        // Old format: just an array
        selectedDevices = data.selected_devices as DeviceId[];
      } else if (typeof data.selected_devices === 'object') {
        // New format: object with devices array and exportGarminUsb flag
        selectedDevices = (data.selected_devices.devices ?? []) as DeviceId[];
        exportGarminUsb = data.selected_devices.exportGarminUsb ?? false;
      }
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name || data.email.split('@')[0],
      subscription: data.subscription || 'free',
      workoutsThisWeek: data.workouts_this_week || 0,
      selectedDevices,
      exportGarminUsb,
      billingDate: data.billing_date ? new Date(data.billing_date) : undefined,
      zipCode: data.zip_code,
      address: data.address,
      city: data.city,
      state: data.state,
    };
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

/**
 * Create or update user profile in Supabase for Clerk user
 */
export async function syncClerkUserToProfile(clerkUser: any): Promise<User | null> {
  try {
    if (!clerkUser?.id) {
      throw new Error('Clerk user ID is required');
    }

    // Check if profile exists
    const existingProfile = await getUserProfileFromClerk(clerkUser.id);

    if (existingProfile) {
      // Profile exists, return it
      return existingProfile;
    }

    // Profile doesn't exist, create it using the helper function
    const email = clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress || '';
    const name = clerkUser.firstName && clerkUser.lastName
      ? `${clerkUser.firstName} ${clerkUser.lastName}`
      : clerkUser.firstName || clerkUser.username || email.split('@')[0];

    // Use the upsert_clerk_profile function to create the profile
    const { data, error } = await supabase.rpc('upsert_clerk_profile', {
      p_user_id: clerkUser.id,
      p_email: email,
      p_name: name,
      p_selected_devices: [], // Empty array - user must complete profile
    });

    if (error) {
      console.error('Error creating profile via RPC:', error);
      
      // Fallback: Try direct insert (might fail due to RLS, but worth trying)
      const { data: insertData, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: clerkUser.id,
          email: email,
          name: name,
          selected_devices: [], // Empty array - user must complete profile
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating profile via direct insert:', insertError);
        throw insertError;
      // ---- Normalize selected_devices / exportGarminUsb ----
      let selectedDevices: DeviceId[] = [];
      let exportGarminUsb = false;

      if (insertData.selected_devices) {
        if (Array.isArray(insertData.selected_devices)) {
          // Old format: just an array of device ids
          selectedDevices = insertData.selected_devices as DeviceId[];
        } else if (typeof insertData.selected_devices === 'object') {
          // New format: { devices: DeviceId[]; exportGarminUsb?: boolean }
          const raw = insertData.selected_devices as {
            exportGarminUsb?: boolean;
          };

          if (Array.isArray(raw.devices)) {
            selectedDevices = raw.devices;
          }

          if (typeof raw.exportGarminUsb === 'boolean') {
            exportGarminUsb = raw.exportGarminUsb;
          }
        }
      }

      }


      return {
        id: insertData.id,
        email: insertData.email,
        name: insertData.name || insertData.email.split('@')[0],
        subscription: insertData.subscription || 'free',
        workoutsThisWeek: insertData.workouts_this_week || 0,
        selectedDevices,
        exportGarminUsb,
        billingDate: insertData.billing_date ? new Date(insertData.billing_date) : undefined,
        zipCode: insertData.zip_code,
        address: insertData.address,
        city: insertData.city,
        state: insertData.state,
      };
    }

    // RPC function returns the profile
    if (data) {
      // Handle selected_devices format
      let selectedDevices: DeviceId[] = [];
      let exportGarminUsb = false;
      if (data.selected_devices) {
        if (Array.isArray(data.selected_devices)) {
          selectedDevices = data.selected_devices as DeviceId[];
        } else if (typeof data.selected_devices === 'object') {
          selectedDevices = (data.selected_devices.devices ?? []) as DeviceId[];
          exportGarminUsb = data.selected_devices.exportGarminUsb ?? false;
        }
      }
      return {
        id: data.id,
        email: data.email,
        name: data.name || data.email.split('@')[0],
        subscription: data.subscription || 'free',
        workoutsThisWeek: data.workouts_this_week || 0,
        selectedDevices,
        exportGarminUsb,
        billingDate: data.billing_date ? new Date(data.billing_date) : undefined,
        zipCode: data.zip_code,
        address: data.address,
        city: data.city,
        state: data.state,
      };
    }

    throw new Error('Failed to create profile');
  } catch (error: any) {
    console.error('Error syncing Clerk user to profile:', error);
    throw error;
  }
}

/**
 * Update user profile in Supabase
 */
export async function updateUserProfileFromClerk(clerkUserId: string, updates: Partial<User>) {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.subscription !== undefined) updateData.subscription = updates.subscription;
    if (updates.workoutsThisWeek !== undefined) updateData.workouts_this_week = updates.workoutsThisWeek;
    // selectedDevices maps directly to selected_devices JSON array
    if (updates.selectedDevices !== undefined) {
      updateData.selected_devices = updates.selectedDevices;
    }

    // For now we do NOT persist exportGarminUsb to Supabase.
    // We'll add a dedicated column later when the DB is ready.

    // Location fields
    if (updates.zipCode !== undefined) updateData.zip_code = updates.zipCode;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.city !== undefined) updateData.city = updates.city;
    if (updates.state !== undefined) updateData.state = updates.state;

    // If nothing except updated_at changed, just return
    if (Object.keys(updateData).length <= 1) {
      return { data: null, error: null };
    }

    if (updates.billingDate !== undefined) {
      updateData.billing_date = updates.billingDate.toISOString();
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', clerkUserId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}
