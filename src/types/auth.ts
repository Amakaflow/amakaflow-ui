import { DeviceId } from '../lib/devices';

export type SubscriptionTier = 'free' | 'pro' | 'trainer';

export interface User {
  id: string;
  email: string;
  name: string;
  subscription: SubscriptionTier;
  workoutsThisWeek: number;
  selectedDevices: DeviceId[];
  exportGarminUsb?: boolean; // NEW: Garmin USB FIT export toggle
  billingDate?: Date;
  zipCode?: string; // User's zip code for location-based features
  address?: string; // Street address
  city?: string; // City name
  state?: string; // State/Province
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}
