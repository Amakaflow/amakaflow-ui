import type { FlowDefinition, RunMode, StepEvent, PipelineStep, ServiceName, SchemaValidationResult } from '../store/runTypes';
import { isParallelGroup } from '../store/runTypes';
import { executeIngest, executeMap, executeHealthCheck, extractExerciseNames, executeExport, type InputType } from './stepExecutors';
import { getStep } from '../registry/stepRegistry';
import { API_URLS } from '../../../lib/config';

function genId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export interface PipelineRunnerOptions {
  flow: FlowDefinition;
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

interface StepContext {
  inputs: Record<string, unknown>;
  ingestOutput?: unknown;
  mapOutput?: unknown;
}

async function executeStepById(
  stepId: string,
  context: StepContext,
): Promise<{ service: ServiceName; label: string; result: StepExecutorResult }> {
  const inputType = (context.inputs.inputType as InputType) ?? 'text';
  const input = inputType === 'text'
    ? (context.inputs.workoutText as string)
    : (context.inputs.url as string);

  switch (stepId) {
    case 'ingest-youtube':
    case 'ingest-instagram':
    case 'ingest-tiktok':
    case 'ingest-text': {
      const typeMap: Record<string, InputType> = {
        'ingest-youtube': 'youtube',
        'ingest-instagram': 'instagram',
        'ingest-tiktok': 'tiktok',
        'ingest-text': 'text',
      };
      const resolvedType = typeMap[stepId];
      // Use workoutText for text type, url for media types; fall back to whichever is provided
      const resolvedInput = resolvedType === 'text'
        ? ((context.inputs.workoutText as string) ?? (context.inputs.url as string))
        : ((context.inputs.url as string) ?? (context.inputs.workoutText as string));
      const result = await executeIngest(resolvedInput, resolvedType);
      return { service: 'ingestor', label: `Ingest ${resolvedType}`, result };
    }
    case 'map-exercises': {
      const exercises = extractExerciseNames(context.ingestOutput);
      const result = await executeMap(exercises);
      return { service: 'mapper', label: 'Map exercises', result };
    }
    case 'export-garmin': {
      const title = (context.ingestOutput as Record<string, unknown>)?.title as string ?? 'Workout';
      const result = await executeExport(context.ingestOutput, title);
      return { service: 'garmin', label: 'Export → Garmin', result };
    }
    case 'export-apple':
      return {
        service: 'mapper',
        label: 'Export → Apple Health',
        result: { apiOutput: { status: 'not_implemented' }, error: 'Apple Health export not yet implemented' },
      };
    case 'sync-strava':
      return {
        service: 'strava',
        label: 'Sync → Strava',
        result: { apiOutput: { status: 'not_implemented' }, error: 'Strava sync not yet implemented' },
      };
    case 'pull-runna':
      return {
        service: 'ingestor',
        label: 'Pull Runna plan',
        result: { apiOutput: { status: 'not_implemented' }, error: 'Runna pull not yet implemented' },
      };
    case 'health-check':
      return {
        service: 'ingestor',
        label: 'Health Check',
        result: await executeHealthCheck('ingestor', API_URLS.INGESTOR),
      };
    default:
      return {
        service: 'ingestor',
        label: stepId,
        result: { apiOutput: null, error: `Unknown step: ${stepId}` },
      };
  }
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

export async function* runPipeline(opts: PipelineRunnerOptions): AsyncGenerator<StepEvent> {
  const { flow, inputs, mode, onStepPaused } = opts;
  const runId = genId();

  yield { type: 'run:started', runId, flowId: flow.id, inputs };

  // Special case: health-check flow ID runs all service health checks regardless of steps array
  if (flow.id === 'health-check') {
    yield* runHealthCheckSteps(runId);
    yield { type: 'run:completed', runId, status: 'success' };
    return;
  }

  const context: StepContext = { inputs };

  try {
    for (const flowStep of flow.steps) {
      if (isParallelGroup(flowStep)) {
        // Run all parallel branches concurrently
        const branchResults = await Promise.allSettled(
          flowStep.steps.map(stepId => executeStepById(stepId, context))
        );

        for (let i = 0; i < flowStep.steps.length; i++) {
          const stepId = flowStep.steps[i];
          const settled = branchResults[i];

          if (settled.status === 'rejected') {
            const errStepId = genId();
            const errStep: PipelineStep = {
              id: errStepId,
              service: 'ingestor',
              label: stepId,
              status: 'failed',
              edited: false,
            };
            yield {
              type: 'step:failed',
              runId,
              stepId: errStepId,
              error: String(settled.reason),
              step: errStep,
            };
          } else {
            const { service, label, result } = settled.value;
            const parallelStepId = genId();
            const step: PipelineStep = {
              id: parallelStepId,
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
            yield { type: 'step:started', runId, stepId: parallelStepId, service, label };
            if (result.error) {
              yield { type: 'step:failed', runId, stepId: parallelStepId, error: result.error, step };
            } else {
              yield { type: 'step:completed', runId, stepId: parallelStepId, step };
            }
          }
        }
        // Parallel step failures don't abort the run — continue to next flow step
      } else {
        // Sequential step
        const stepDef = getStep(flowStep);
        const service: ServiceName = stepDef?.service ?? 'ingestor';
        const label = stepDef?.label ?? flowStep;
        const stepId = genId();

        yield { type: 'step:started', runId, stepId, service, label };

        const { result } = await executeStepById(flowStep, context);

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
          yield { type: 'run:completed', runId, status: 'failed' };
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

        // Update context for downstream steps
        if (flowStep.startsWith('ingest-') || flowStep === 'pull-runna') {
          context.ingestOutput = step.effectiveOutput;
        } else if (flowStep === 'map-exercises') {
          context.mapOutput = step.effectiveOutput;
        }
      }
    }

    yield { type: 'run:completed', runId, status: 'success' };
  } catch (err) {
    console.error('[pipelineRunner] Unexpected error during pipeline run:', err);
    yield { type: 'run:completed', runId, status: 'failed' };
  }
}
