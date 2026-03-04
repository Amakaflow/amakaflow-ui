// src/api/pipelines/index.ts

export type PipelineErrorCode =
  | 'UnmappedExercises'
  | 'IngestorFailed'
  | 'MapperFailed'
  | 'ExportFailed';

export class PipelineError extends Error {
  readonly code: PipelineErrorCode;
  readonly detail: Record<string, unknown>;

  constructor(code: PipelineErrorCode, detail: Record<string, unknown>) {
    super(typeof detail['message'] === 'string' ? detail['message'] : code);
    this.name = 'PipelineError';
    this.code = code;
    this.detail = detail;
  }
}

export { runIngestionPipeline } from './ingestion';
export type { IngestionResult } from './ingestion';
