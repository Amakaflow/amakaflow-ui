export type ServiceName = 'ingestor' | 'mapper' | 'garmin' | 'strava' | 'calendar' | 'chat';

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'paused';

export type RunStatus = 'running' | 'success' | 'failed' | 'cancelled' | 'paused';

export type FlowId = 'full-pipeline' | 'ingest-only' | 'map-only' | 'export-only' | 'health-check';

export type RunMode = 'auto' | 'step-through';

export interface SchemaValidationResult {
  passed: boolean;
  errors?: Array<{ path: string; message: string }>;
}

export interface PipelineStep {
  id: string;
  service: ServiceName;
  label: string;
  status: StepStatus;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  request?: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
    headers: Record<string, string>;
    body: unknown;
  };
  response?: {
    status: number;
    body: unknown;
  };
  schemaValidation?: SchemaValidationResult;
  error?: string;
  apiOutput?: unknown;
  effectiveOutput?: unknown;
  edited: boolean;
  editedAt?: number;
}

export interface PipelineRun {
  id: string;
  flowId: FlowId;
  label: string;
  mode: RunMode;
  status: RunStatus;
  startedAt: number;
  completedAt?: number;
  inputs: Record<string, unknown>;
  steps: PipelineStep[];
}

export type StepEvent =
  | { type: 'run:started'; runId: string; flowId: FlowId; inputs: Record<string, unknown> }
  | { type: 'step:started'; runId: string; stepId: string; service: ServiceName; label: string }
  | { type: 'step:completed'; runId: string; stepId: string; step: PipelineStep }
  | { type: 'step:failed'; runId: string; stepId: string; error: string; step: PipelineStep }
  | { type: 'step:paused'; runId: string; stepId: string; step: PipelineStep }
  | { type: 'step:edited'; runId: string; stepId: string; effectiveOutput: unknown }
  | { type: 'run:completed'; runId: string; status: RunStatus }
  | { type: 'run:cancelled'; runId: string; status: 'cancelled' };
