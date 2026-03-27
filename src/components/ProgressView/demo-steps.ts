/**
 * Demo step definitions for "Generate my week" and other operations (AMA-1154).
 */

export const GENERATE_WEEK_STEPS = [
  { id: 'garmin-recovery', label: 'Fetching your Garmin recovery data...' },
  { id: 'strava-load', label: 'Analyzing Strava training load (30 days)...' },
  { id: 'periodization', label: 'Building periodization plan...' },
  { id: 'conflicts', label: 'Checking for conflicts...' },
  { id: 'push-garmin', label: 'Pushing to Garmin Connect...' },
];

export const PLATFORM_SYNC_STEPS = [
  { id: 'auth', label: 'Authenticating with platform...' },
  { id: 'fetch-activities', label: 'Fetching recent activities...' },
  { id: 'map-exercises', label: 'Mapping exercises to library...' },
  { id: 'save', label: 'Saving to your account...' },
];

export const BATCH_PUSH_STEPS = [
  { id: 'validate', label: 'Validating workout data...' },
  { id: 'convert', label: 'Converting to Garmin format...' },
  { id: 'upload', label: 'Uploading workouts (3 of 3)...' },
  { id: 'confirm', label: 'Confirming sync status...' },
];
