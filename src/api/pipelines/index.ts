// src/api/pipelines/index.ts

export type PipelineErrorCode =
  | 'UnmappedExercises'
  | 'IngestorFailed'
  | 'ExportFailed';

export class PipelineError extends Error {
  readonly code: PipelineErrorCode;
  readonly detail: Record<string, unknown>;

  constructor(code: PipelineErrorCode, detail: Record<string, unknown>) {
    super((detail['message'] as string) ?? code);
    this.name = 'PipelineError';
    this.code = code;
    this.detail = detail;
  }
}
