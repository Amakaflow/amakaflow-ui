import type { FlowDefinition } from '../store/runTypes';

export const PRESETS: FlowDefinition[] = [
  {
    id: 'garmin-full',
    label: 'Garmin Full Pipeline',
    steps: ['ingest-youtube', 'map-exercises', 'export-garmin'],
  },
  {
    id: 'apple-full',
    label: 'Apple Health',
    steps: ['ingest-youtube', 'export-apple'],
  },
  {
    id: 'everything',
    label: 'Everything (Garmin + Apple + Strava)',
    steps: [
      'ingest-youtube',
      'map-exercises',
      { type: 'parallel', steps: ['export-garmin', 'export-apple', 'sync-strava'] },
    ],
  },
  {
    id: 'runna-reconcile',
    label: 'Runna → Strava → Apple',
    steps: ['pull-runna', 'sync-strava', 'export-apple'],
  },
  {
    id: 'ingest-only',
    label: 'Ingest Only',
    steps: ['ingest-youtube'],
  },
];

export function getPreset(id: string): FlowDefinition | undefined {
  return PRESETS.find(p => p.id === id);
}
