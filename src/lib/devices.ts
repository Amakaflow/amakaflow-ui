// Export Destinations - renamed from "Connected Devices"
// Each destination has an export method and whether it requires exercise mapping

export type DeviceId =
  | 'garmin'
  | 'garmin_usb'
  | 'apple'  // iOS Companion (kept as 'apple' for backward compatibility)
  | 'android-companion'  // Android Companion (AMA-246)
  | 'hevy'
  | 'coros'
  | 'zwift'
  | 'trainingpeaks'
  | 'strava'
  // Legacy device IDs (kept for backward compatibility)
  | 'suunto'
  | 'polar'
  | 'wahoo'
  | 'whoop'
  | 'fitbit'
  | 'oura'
  | 'peloton'
  | 'concept2'
  | 'trainerroad'
  | 'final-surge';

export type ExportMethod = 'api' | 'file_download' | 'coming_soon';

export interface Device {
  id: DeviceId;
  name: string;
  description: string;
  category: 'watch' | 'platform' | 'app' | 'tracker' | 'equipment';
  format: string;
  icon: string;
  popular?: boolean;
  // New fields for export workflow
  exportMethod: ExportMethod;
  requiresMapping: boolean;
  setupInstructions?: string;
}

export const AVAILABLE_DEVICES: Device[] = [
  // === PRIMARY DESTINATIONS (shown in UI) ===
  {
    id: 'garmin',
    name: 'Garmin Connect',
    description: 'Sync directly to your Garmin account',
    category: 'watch',
    format: 'FIT',
    icon: '📱',
    popular: true,
    exportMethod: 'api',
    requiresMapping: true,
    setupInstructions: 'Connect your Garmin account to sync workouts automatically',
  },
  {
    id: 'garmin_usb',
    name: 'Garmin USB',
    description: 'Download FIT file for manual upload',
    category: 'watch',
    format: 'FIT',
    icon: '💾',
    popular: true,
    exportMethod: 'file_download',
    requiresMapping: true,
    setupInstructions: 'Download the .FIT file and copy to GARMIN/NewFiles on your watch',
  },
  {
    id: 'coros',
    name: 'COROS',
    description: 'Download FIT for COROS Training Hub',
    category: 'watch',
    format: 'FIT',
    icon: '🏃',
    exportMethod: 'file_download',
    requiresMapping: true,
    setupInstructions: 'Upload the .FIT file at training.coros.com',
  },
  {
    id: 'apple',
    name: 'iOS Companion',
    description: 'Sync via iOS Companion App. Supports Apple Watch (native or remote mode), Garmin via Health sync, and any HealthKit-connected device.',
    category: 'app',
    format: 'WorkoutKit',
    icon: '📱',
    popular: true,
    exportMethod: 'api',
    requiresMapping: false,
    setupInstructions: 'Download the AmakaFlow iOS Companion App and pair with your account',
  },
  {
    id: 'android-companion',
    name: 'Android Companion',
    description: 'Sync via Android Companion App. Supports Wear OS, Samsung Galaxy Watch, Garmin via Health Connect, and any Health Connect device.',
    category: 'app',
    format: 'HealthConnect',
    icon: '📱',
    popular: true,
    exportMethod: 'api',
    requiresMapping: false,
    setupInstructions: 'Download the AmakaFlow Android Companion App from Google Play and pair with your account',
  },
  {
    id: 'hevy',
    name: 'Hevy',
    description: 'Create routine in Hevy app',
    category: 'app',
    format: 'Hevy JSON',
    icon: '💪',
    popular: true,
    exportMethod: 'coming_soon',
    requiresMapping: false,
    setupInstructions: 'Requires Hevy Pro subscription and API key',
  },
  {
    id: 'zwift',
    name: 'Zwift',
    description: 'Virtual cycling workouts',
    category: 'platform',
    format: 'ZWO',
    icon: '🚴',
    popular: true,
    exportMethod: 'file_download',
    requiresMapping: false,
    setupInstructions: 'Download .ZWO file and import into Zwift',
  },
  {
    id: 'trainingpeaks',
    name: 'TrainingPeaks',
    description: 'Professional training platform',
    category: 'platform',
    format: 'JSON',
    icon: '📊',
    exportMethod: 'coming_soon',
    requiresMapping: false,
  },
  {
    id: 'strava',
    name: 'Strava',
    description: 'Post-workout activity sync',
    category: 'platform',
    format: 'Activity',
    icon: '🏃',
    exportMethod: 'api',
    requiresMapping: false,
    setupInstructions: 'Connect Strava to auto-post completed workouts',
  },

  // === LEGACY DEVICES (kept for backward compatibility) ===
  {
    id: 'suunto',
    name: 'Suunto',
    description: 'Vertical, Race, 9 Peak',
    category: 'watch',
    format: 'FIT',
    icon: '⌚',
    exportMethod: 'coming_soon',
    requiresMapping: true,
  },
  {
    id: 'polar',
    name: 'Polar',
    description: 'Vantage, Grit, Ignite',
    category: 'watch',
    format: 'TCX',
    icon: '⌚',
    exportMethod: 'coming_soon',
    requiresMapping: true,
  },
  {
    id: 'wahoo',
    name: 'Wahoo',
    description: 'ELEMNT, RIVAL',
    category: 'watch',
    format: 'FIT',
    icon: '⌚',
    exportMethod: 'coming_soon',
    requiresMapping: true,
  },
  {
    id: 'whoop',
    name: 'WHOOP',
    description: 'Recovery & strain tracker',
    category: 'tracker',
    format: 'JSON',
    icon: '💪',
    exportMethod: 'coming_soon',
    requiresMapping: false,
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    description: 'Fitness & wellness',
    category: 'tracker',
    format: 'TCX',
    icon: '⌚',
    exportMethod: 'coming_soon',
    requiresMapping: false,
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    description: 'Sleep & recovery',
    category: 'tracker',
    format: 'JSON',
    icon: '💍',
    exportMethod: 'coming_soon',
    requiresMapping: false,
  },
  {
    id: 'peloton',
    name: 'Peloton',
    description: 'Bike & Tread',
    category: 'equipment',
    format: 'JSON',
    icon: '🚴',
    exportMethod: 'coming_soon',
    requiresMapping: false,
  },
  {
    id: 'concept2',
    name: 'Concept2',
    description: 'Rowing & SkiErg',
    category: 'equipment',
    format: 'CSV',
    icon: '🚣',
    exportMethod: 'coming_soon',
    requiresMapping: false,
  },
  {
    id: 'trainerroad',
    name: 'TrainerRoad',
    description: 'Structured training',
    category: 'platform',
    format: 'MRC',
    icon: '🚴',
    exportMethod: 'coming_soon',
    requiresMapping: false,
  },
  {
    id: 'final-surge',
    name: 'Final Surge',
    description: 'Coaching platform',
    category: 'platform',
    format: 'JSON',
    icon: '📈',
    exportMethod: 'coming_soon',
    requiresMapping: false,
  },
];

export const getDeviceById = (id: DeviceId): Device | undefined => {
  return AVAILABLE_DEVICES.find(d => d.id === id);
};

export const getDevicesByIds = (ids: DeviceId[]): Device[] => {
  return ids.map(id => getDeviceById(id)).filter(Boolean) as Device[];
};

export const getDevicesByCategory = (category: Device['category']): Device[] => {
  return AVAILABLE_DEVICES.filter(d => d.category === category);
};

export const getPopularDevices = (): Device[] => {
  return AVAILABLE_DEVICES.filter(d => d.popular);
};

// New helpers for export workflow
export const getDevicesRequiringMapping = (): Device[] => {
  return AVAILABLE_DEVICES.filter(d => d.requiresMapping);
};

export const getDirectExportDevices = (): Device[] => {
  return AVAILABLE_DEVICES.filter(d => !d.requiresMapping);
};

export const getAvailableExportDevices = (): Device[] => {
  return AVAILABLE_DEVICES.filter(d => d.exportMethod !== 'coming_soon');
};

export const isDeviceAvailable = (id: DeviceId): boolean => {
  const device = getDeviceById(id);
  return device ? device.exportMethod !== 'coming_soon' : false;
};

// Get primary export destinations (shown prominently in UI)
export const getPrimaryExportDestinations = (): Device[] => {
  const primaryIds: DeviceId[] = ['garmin', 'garmin_usb', 'coros', 'apple', 'android-companion', 'hevy', 'zwift', 'strava'];
  return primaryIds.map(id => getDeviceById(id)).filter(Boolean) as Device[];
};
