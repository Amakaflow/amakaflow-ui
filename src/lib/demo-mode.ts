export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

// AppUser matches App.tsx: User & { avatar?: string; mode: 'individual' | 'trainer' }
export const DEMO_USER = {
  id: 'demo-user-1',
  email: 'demo@amakaflow.com',
  name: 'Alex Demo',
  subscription: 'pro' as const,
  workoutsThisWeek: 5,
  selectedDevices: ['garmin', 'apple'] as string[],
  exportGarminUsb: false,
  billingDate: new Date('2026-12-01'),
  avatar: undefined as string | undefined,
  mode: 'trainer' as const,
};
