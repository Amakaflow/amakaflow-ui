import type { FlowId, RunMode, StepEvent, PipelineStep, ServiceName } from '../store/runTypes';
import { executeIngest, executeMap, executeHealthCheck, extractExerciseNames } from './stepExecutors';
import { API_URLS } from '../../../lib/config';

function genId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export interface PipelineRunnerOptions {
  flowId: FlowId;
  inputs: Record<string, unknown>;
  mode: RunMode;
  onStepPaused?: (stepId: string, step: PipelineStep) => Promise<unknown>;
}

export async function* runPipeline(opts: PipelineRunnerOptions): AsyncGenerator<StepEvent> {
  const { flowId, inputs, mode, onStepPaused } = opts;
  const runId = genId();

  yield { type: 'run:started', runId, flowId, inputs };

  try {
    if (flowId === 'ingest-only') {
      yield* runIngestStep(runId, inputs.workoutText as string, mode, onStepPaused);
    } else if (flowId === 'map-only') {
      const exercises = Array.isArray(inputs.exercises) ? inputs.exercises as string[] : [];
      yield* runMapStep(runId, exercises, mode, onStepPaused);
    } else if (flowId === 'full-pipeline') {
      let ingestOutput: unknown;
      for await (const event of runIngestStep(runId, inputs.workoutText as string, mode, onStepPaused)) {
        yield event;
        if (event.type === 'step:completed') ingestOutput = event.step.effectiveOutput;
        if (event.type === 'step:failed') {
          yield { type: 'run:completed', runId, status: 'failed' };
          return;
        }
      }
      const exercises = extractExerciseNames(ingestOutput);
      for await (const event of runMapStep(runId, exercises, mode, onStepPaused)) {
        yield event;
        if (event.type === 'step:failed') {
          yield { type: 'run:completed', runId, status: 'failed' };
          return;
        }
      }
    } else if (flowId === 'health-check') {
      yield* runHealthCheckSteps(runId);
    }

    yield { type: 'run:completed', runId, status: 'success' };
  } catch {
    yield { type: 'run:completed', runId, status: 'failed' };
  }
}

async function* runIngestStep(
  runId: string,
  workoutText: string,
  mode: RunMode,
  onStepPaused?: PipelineRunnerOptions['onStepPaused']
): AsyncGenerator<StepEvent> {
  const stepId = genId();
  const service: ServiceName = 'ingestor';
  yield { type: 'step:started', runId, stepId, service, label: 'Ingest workout text' };

  const result = await executeIngest(workoutText);
  const step: PipelineStep = {
    id: stepId,
    service,
    label: 'Ingest workout text',
    status: result.error ? 'failed' : 'success',
    request: result.request,
    response: result.response,
    schemaValidation: result.schemaValidation,
    apiOutput: result.apiOutput,
    effectiveOutput: result.apiOutput,
    edited: false,
  };

  if (result.error) {
    yield { type: 'step:failed', runId, stepId, error: result.error, step };
    return;
  }

  if (mode === 'step-through' && onStepPaused) {
    step.status = 'paused';
    yield { type: 'step:paused', runId, stepId, step };
    const effective = await onStepPaused(stepId, step);
    if (effective !== step.apiOutput) {
      step.edited = true;
      step.editedAt = Date.now();
      step.effectiveOutput = effective;
      yield { type: 'step:edited', runId, stepId, effectiveOutput: effective };
    }
    step.status = 'success';
  }

  yield { type: 'step:completed', runId, stepId, step };
}

async function* runMapStep(
  runId: string,
  exercises: string[],
  mode: RunMode,
  onStepPaused?: PipelineRunnerOptions['onStepPaused']
): AsyncGenerator<StepEvent> {
  const stepId = genId();
  const service: ServiceName = 'mapper';
  yield { type: 'step:started', runId, stepId, service, label: 'Map exercises' };

  const result = await executeMap(exercises);
  const step: PipelineStep = {
    id: stepId,
    service,
    label: 'Map exercises',
    status: result.error ? 'failed' : 'success',
    request: result.request,
    response: result.response,
    schemaValidation: result.schemaValidation,
    apiOutput: result.apiOutput,
    effectiveOutput: result.apiOutput,
    edited: false,
  };

  if (result.error) {
    yield { type: 'step:failed', runId, stepId, error: result.error, step };
    return;
  }

  if (mode === 'step-through' && onStepPaused) {
    step.status = 'paused';
    yield { type: 'step:paused', runId, stepId, step };
    const effective = await onStepPaused(stepId, step);
    if (effective !== step.apiOutput) {
      step.edited = true;
      step.editedAt = Date.now();
      step.effectiveOutput = effective;
      yield { type: 'step:edited', runId, stepId, effectiveOutput: effective };
    }
    step.status = 'success';
  }

  yield { type: 'step:completed', runId, stepId, step };
}

async function* runHealthCheckSteps(runId: string): AsyncGenerator<StepEvent> {
  const services: Array<{ name: ServiceName; url: string; label: string }> = [
    { name: 'ingestor', url: API_URLS.INGESTOR, label: 'Ingestor health' },
    { name: 'mapper', url: API_URLS.MAPPER, label: 'Mapper health' },
    { name: 'garmin', url: API_URLS.GARMIN, label: 'Garmin health' },
    { name: 'strava', url: API_URLS.STRAVA, label: 'Strava health' },
    { name: 'calendar', url: API_URLS.CALENDAR, label: 'Calendar health' },
    { name: 'chat', url: API_URLS.CHAT, label: 'Chat health' },
  ];
  for (const svc of services) {
    const stepId = genId();
    yield { type: 'step:started', runId, stepId, service: svc.name, label: svc.label };
    const result = await executeHealthCheck(svc.name, svc.url);
    const step: PipelineStep = {
      id: stepId,
      service: svc.name,
      label: svc.label,
      status: result.error ? 'failed' : 'success',
      request: result.request,
      response: result.response,
      apiOutput: result.apiOutput,
      effectiveOutput: result.apiOutput,
      edited: false,
    };
    if (result.error) {
      yield { type: 'step:failed', runId, stepId, error: result.error, step };
    } else {
      yield { type: 'step:completed', runId, stepId, step };
    }
  }
}
