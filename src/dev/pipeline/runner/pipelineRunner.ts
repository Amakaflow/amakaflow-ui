import type { FlowId, RunMode, StepEvent, PipelineStep, ServiceName, SchemaValidationResult } from '../store/runTypes';
import { executeIngest, executeMap, executeHealthCheck, extractExerciseNames, executeExport, type InputType } from './stepExecutors';
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

interface StepExecutorResult {
  error?: string;
  apiOutput?: unknown;
  schemaValidation?: SchemaValidationResult;
  request?: PipelineStep['request'];
  response?: PipelineStep['response'];
}

async function* runStep(
  runId: string,
  stepId: string,
  service: ServiceName,
  label: string,
  execute: () => Promise<StepExecutorResult>,
  mode: RunMode,
  onStepPaused?: (stepId: string, step: PipelineStep) => Promise<unknown>,
): AsyncGenerator<StepEvent> {
  yield { type: 'step:started', runId, stepId, service, label };

  const result = await execute();
  const step: PipelineStep = {
    id: stepId,
    service,
    label,
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

export async function* runPipeline(opts: PipelineRunnerOptions): AsyncGenerator<StepEvent> {
  const { flowId, inputs, mode, onStepPaused } = opts;
  const runId = genId();

  yield { type: 'run:started', runId, flowId, inputs };

  try {
    const inputType = (inputs.inputType as InputType) || 'text';
    if (flowId === 'ingest-only') {
      const workoutText = inputs.workoutText as string;
      const url = inputs.url as string;
      const input = inputType === 'text' ? workoutText : url;
      if (typeof input !== 'string') {
        yield { type: 'run:completed', runId, status: 'failed' };
        return;
      }
      for await (const event of runIngestStep(runId, input, inputType, mode, onStepPaused)) {
        yield event;
        if (event.type === 'step:failed') {
          yield { type: 'run:completed', runId, status: 'failed' };
          return;
        }
      }
    } else if (flowId === 'map-only') {
      const exercises = inputs.exercises;
      if (!Array.isArray(exercises) || !exercises.every(e => typeof e === 'string')) {
        yield { type: 'run:completed', runId, status: 'failed' };
        return;
      }
      for await (const event of runMapStep(runId, exercises, mode, onStepPaused)) {
        yield event;
        if (event.type === 'step:failed') {
          yield { type: 'run:completed', runId, status: 'failed' };
          return;
        }
      }
    } else if (flowId === 'full-pipeline') {
      const workoutText = inputs.workoutText as string;
      const url = inputs.url as string;
      const input = inputType === 'text' ? workoutText : url;
      if (typeof input !== 'string') {
        yield { type: 'run:completed', runId, status: 'failed' };
        return;
      }
      let ingestOutput: unknown;
      for await (const event of runIngestStep(runId, input, inputType, mode, onStepPaused)) {
        yield event;
        if (event.type === 'step:completed') ingestOutput = event.step.effectiveOutput;
        if (event.type === 'step:failed') {
          yield { type: 'run:completed', runId, status: 'failed' };
          return;
        }
      }
      const exercises = extractExerciseNames(ingestOutput);
      let mapOutput: unknown;
      for await (const event of runMapStep(runId, exercises, mode, onStepPaused)) {
        yield event;
        if (event.type === 'step:completed') mapOutput = event.step.effectiveOutput;
        if (event.type === 'step:failed') {
          yield { type: 'run:completed', runId, status: 'failed' };
          return;
        }
      }
      // Export step: use the workout structure from ingest (before mapping transforms it)
      const workoutStructure = ingestOutput;
      const title =
        (workoutStructure as Record<string, unknown>)?.title as string ??
        'AI Generated Workout';

      yield { type: 'step:started', runId, stepId: genId(), service: 'mapper', label: 'Export to Garmin' };
      const exportResult = await executeExport(workoutStructure, title);
      yield {
        type: 'step:completed',
        runId,
        stepId: genId(),
        step: {
          id: '',
          service: 'mapper',
          label: 'Export to Garmin',
          status: exportResult.error ? 'failed' : 'success',
          request: exportResult.request,
          response: exportResult.response,
          apiOutput: exportResult.apiOutput,
          effectiveOutput: exportResult.apiOutput,
          edited: false,
        },
      };
      if (exportResult.error) {
        yield { type: 'run:completed', runId, status: 'failed' };
        return;
      }
    } else if (flowId === 'health-check') {
      // health-check intentionally continues after individual step failures
      yield* runHealthCheckSteps(runId);
    } else {
      // export-only flow not yet implemented
      yield { type: 'run:completed', runId, status: 'failed' };
      return;
    }

    yield { type: 'run:completed', runId, status: 'success' };
  } catch (err) {
    console.error('[pipelineRunner] Unexpected error during pipeline run:', err);
    yield { type: 'run:completed', runId, status: 'failed' };
  }
}

function runIngestStep(
  runId: string,
  input: string,
  inputType: InputType,
  mode: RunMode,
  onStepPaused?: PipelineRunnerOptions['onStepPaused'],
): AsyncGenerator<StepEvent> {
  const stepId = genId();
  const label = inputType === 'text' ? 'Ingest workout text' : `Ingest ${inputType}`;
  return runStep(runId, stepId, 'ingestor', label, () => executeIngest(input, inputType), mode, onStepPaused);
}

function runMapStep(
  runId: string,
  exercises: string[],
  mode: RunMode,
  onStepPaused?: PipelineRunnerOptions['onStepPaused'],
): AsyncGenerator<StepEvent> {
  const stepId = genId();
  return runStep(runId, stepId, 'mapper', 'Map exercises', () => executeMap(exercises), mode, onStepPaused);
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
