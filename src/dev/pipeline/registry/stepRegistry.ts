import type { ServiceName } from '../store/runTypes';

export type StepGroup = 'ingestion' | 'mapping' | 'export' | 'utilities';

export interface StepDefinition {
  id: string;
  label: string;
  service: ServiceName;
  mcpTool: string;          // future MCP tool name
  group: StepGroup;
  canParallelize: boolean;  // safe to run inside a ParallelGroup
  icon: string;             // emoji / letter for palette icon
  colorClass: string;       // Tailwind bg+text classes for the service badge
}

export const STEP_REGISTRY: Record<string, StepDefinition> = {
  'ingest-youtube': {
    id: 'ingest-youtube', label: 'YouTube', service: 'ingestor',
    mcpTool: 'ingest_youtube', group: 'ingestion', canParallelize: false,
    icon: '▶', colorClass: 'bg-blue-950 text-blue-400',
  },
  'ingest-instagram': {
    id: 'ingest-instagram', label: 'Instagram', service: 'ingestor',
    mcpTool: 'ingest_instagram', group: 'ingestion', canParallelize: false,
    icon: '📷', colorClass: 'bg-blue-950 text-blue-400',
  },
  'ingest-tiktok': {
    id: 'ingest-tiktok', label: 'TikTok', service: 'ingestor',
    mcpTool: 'ingest_tiktok', group: 'ingestion', canParallelize: false,
    icon: '♪', colorClass: 'bg-blue-950 text-blue-400',
  },
  'ingest-text': {
    id: 'ingest-text', label: 'Text / URL', service: 'ingestor',
    mcpTool: 'ingest_text', group: 'ingestion', canParallelize: false,
    icon: 'T', colorClass: 'bg-blue-950 text-blue-400',
  },
  'map-exercises': {
    id: 'map-exercises', label: 'Map Exercises', service: 'mapper',
    mcpTool: 'map_exercises', group: 'mapping', canParallelize: false,
    icon: '⇄', colorClass: 'bg-emerald-950 text-emerald-400',
  },
  'export-garmin': {
    id: 'export-garmin', label: 'Export → Garmin', service: 'garmin',
    mcpTool: 'export_garmin', group: 'export', canParallelize: true,
    icon: 'G', colorClass: 'bg-orange-950 text-orange-400',
  },
  'export-apple': {
    id: 'export-apple', label: 'Export → Apple Health', service: 'mapper',
    mcpTool: 'export_apple_health', group: 'export', canParallelize: true,
    icon: '⌘', colorClass: 'bg-purple-950 text-purple-400',
  },
  'sync-strava': {
    id: 'sync-strava', label: 'Sync → Strava', service: 'strava',
    mcpTool: 'sync_strava', group: 'export', canParallelize: true,
    icon: 'S', colorClass: 'bg-red-950 text-red-400',
  },
  'pull-runna': {
    id: 'pull-runna', label: 'Pull Runna Plan', service: 'ingestor',
    mcpTool: 'pull_runna_plan', group: 'export', canParallelize: false,
    icon: 'R', colorClass: 'bg-sky-950 text-sky-400',
  },
  'health-check': {
    id: 'health-check', label: 'Health Check', service: 'ingestor',
    mcpTool: 'health_check', group: 'utilities', canParallelize: false,
    icon: '♥', colorClass: 'bg-zinc-800 text-zinc-400',
  },
};

export const STEP_GROUPS: StepGroup[] = ['ingestion', 'mapping', 'export', 'utilities'];

export const GROUP_LABELS: Record<StepGroup, string> = {
  ingestion: 'Ingestion',
  mapping: 'Mapping',
  export: 'Export',
  utilities: 'Utilities',
};

export function getStep(id: string): StepDefinition | undefined {
  return STEP_REGISTRY[id];
}

export function getStepsByGroup(group: StepGroup): StepDefinition[] {
  return Object.values(STEP_REGISTRY).filter(s => s.group === group);
}
