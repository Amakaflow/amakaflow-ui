import { openDB, type IDBPDatabase } from 'idb';
import type { PipelineRun, StepEvent } from './runTypes';

const DB_NAME = 'pipeline-observatory';
const DB_VERSION = 1;
const MAX_RUNS = 100;

export type PipelineDB = {
  runs: {
    key: string;
    value: PipelineRun;
    indexes: { 'by-startedAt': number };
  };
};

let dbPromise: Promise<IDBPDatabase<PipelineDB>> | null = null;

function getDb(): Promise<IDBPDatabase<PipelineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PipelineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('runs', { keyPath: 'id' });
        store.createIndex('by-startedAt', 'startedAt');
      },
    });
  }
  return dbPromise;
}

export async function saveRun(run: PipelineRun): Promise<void> {
  const db = await getDb();
  await db.put('runs', run);
  await trimOldRuns(db);
}

export async function getRun(runId: string): Promise<PipelineRun | undefined> {
  const db = await getDb();
  return db.get('runs', runId);
}

export async function getAllRuns(): Promise<PipelineRun[]> {
  const db = await getDb();
  const runs = await db.getAllFromIndex('runs', 'by-startedAt');
  return runs.reverse(); // newest first
}

export async function deleteRun(runId: string): Promise<void> {
  const db = await getDb();
  await db.delete('runs', runId);
}

async function trimOldRuns(db: IDBPDatabase<PipelineDB>): Promise<void> {
  const allKeys = await db.getAllKeysFromIndex('runs', 'by-startedAt');
  if (allKeys.length > MAX_RUNS) {
    const toDelete = allKeys.slice(0, allKeys.length - MAX_RUNS);
    await Promise.all(toDelete.map(key => db.delete('runs', key)));
  }
}

// Apply a StepEvent to a PipelineRun in memory, returning a new copy (pure function).
export function applyEventToRun(run: PipelineRun, event: StepEvent): PipelineRun {
  switch (event.type) {
    case 'run:started':
      return { ...run, status: 'running' };
    case 'step:started': {
      const newStep = {
        id: event.stepId,
        service: event.service,
        label: event.label,
        status: 'running' as const,
        startedAt: Date.now(),
        edited: false,
      };
      return { ...run, steps: [...run.steps, newStep] };
    }
    case 'step:completed': {
      const steps = run.steps.map(s => s.id === event.stepId ? event.step : s);
      return { ...run, steps };
    }
    case 'step:failed': {
      const steps = run.steps.map(s => s.id === event.stepId ? event.step : s);
      return { ...run, steps };
    }
    case 'step:paused': {
      const steps = run.steps.map(s => s.id === event.stepId ? event.step : s);
      return { ...run, steps };
    }
    case 'step:edited': {
      const steps = run.steps.map(s =>
        s.id === event.stepId
          ? { ...s, effectiveOutput: event.effectiveOutput, edited: true, editedAt: Date.now() }
          : s,
      );
      return { ...run, steps };
    }
    case 'run:completed':
    case 'run:cancelled':
      return { ...run, status: event.status, completedAt: Date.now() };
    default:
      return run;
  }
}
