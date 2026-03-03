export interface WorkoutSource {
  id: string;
  label: string;
  color: string;           // Tailwind bg-* class for the sidebar colour dot
  icon: string;            // emoji
  category: 'device' | 'video' | 'creation' | 'calendar';
  requiresConnection: boolean;
  matchesSources: string[]; // raw `source` field values this entry covers
}

export const WORKOUT_SOURCES: WorkoutSource[] = [
  // ── Devices ────────────────────────────────────────────────────────────────
  {
    id: 'garmin',
    label: 'Garmin',
    color: 'bg-orange-500',
    icon: '🟠',
    category: 'device',
    requiresConnection: false,
    matchesSources: ['garmin'],
  },
  {
    id: 'strava',
    label: 'Strava',
    color: 'bg-orange-600',
    icon: '🏃',
    category: 'device',
    requiresConnection: true,
    matchesSources: ['strava'],
  },
  {
    id: 'apple',
    label: 'Apple Watch',
    color: 'bg-gray-500',
    icon: '⌚',
    category: 'device',
    requiresConnection: false,
    matchesSources: ['apple', 'ios_companion'],
  },
  {
    id: 'android',
    label: 'Android',
    color: 'bg-green-600',
    icon: '🤖',
    category: 'device',
    requiresConnection: false,
    matchesSources: ['android', 'android_companion'],
  },
  // ── Video imports ───────────────────────────────────────────────────────────
  {
    id: 'youtube',
    label: 'YouTube',
    color: 'bg-red-500',
    icon: '▶️',
    category: 'video',
    requiresConnection: false,
    matchesSources: ['youtube'],
  },
  {
    id: 'instagram',
    label: 'Instagram',
    color: 'bg-pink-500',
    icon: '📸',
    category: 'video',
    requiresConnection: false,
    matchesSources: ['instagram'],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    color: 'bg-slate-800',
    icon: '🎵',
    category: 'video',
    requiresConnection: false,
    matchesSources: ['tiktok'],
  },
  // ── In-app creation ─────────────────────────────────────────────────────────
  {
    id: 'ai',
    label: 'AI Generated',
    color: 'bg-purple-500',
    icon: '✨',
    category: 'creation',
    requiresConnection: false,
    matchesSources: ['ai', 'amaka', 'ai_generated'],
  },
  {
    id: 'manual',
    label: 'Manual Entry',
    color: 'bg-blue-500',
    icon: '✏️',
    category: 'creation',
    requiresConnection: false,
    matchesSources: ['manual', 'gym_class', 'gym_manual_sync'],
  },
  // ── Connected calendars ─────────────────────────────────────────────────────
  {
    id: 'runna',
    label: 'Runna',
    color: 'bg-blue-500',
    icon: '🏃',
    category: 'calendar',
    requiresConnection: true,
    matchesSources: ['runna', 'connected_calendar'],
  },
  {
    id: 'apple-calendar',
    label: 'Apple Calendar',
    color: 'bg-gray-400',
    icon: '📅',
    category: 'calendar',
    requiresConnection: true,
    matchesSources: ['apple_calendar', 'connected_calendar'],
  },
  {
    id: 'google-calendar',
    label: 'Google Calendar',
    color: 'bg-indigo-500',
    icon: '📆',
    category: 'calendar',
    requiresConnection: true,
    matchesSources: ['google_calendar', 'connected_calendar'],
  },
];

/** Look up a source by its canonical id. */
export function getSourceById(id: string): WorkoutSource | undefined {
  return WORKOUT_SOURCES.find(s => s.id === id);
}

/** Look up a source by a raw `source` field value from workout/calendar data. */
export function getSourceByRawValue(value: string): WorkoutSource | undefined {
  return WORKOUT_SOURCES.find(s => s.matchesSources.includes(value));
}
