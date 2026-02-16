/**
 * Simple JSON file state management.
 * Tracks current job, history, and retry counts.
 * Survives poller restarts.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

export interface JobRecord {
  issueId: string;
  identifier: string;       // e.g. "AMA-611"
  title: string;
  status: "running" | "succeeded" | "failed" | "timed_out";
  antfarmRunId?: string;
  startedAt: string;         // ISO timestamp
  finishedAt?: string;
  errorMessage?: string;
  retryCount: number;
}

export interface PollerState {
  currentJob: JobRecord | null;
  history: JobRecord[];
  retryTracker: Record<string, number>;  // issueId -> retry count
  lastPollAt: string | null;
}

const EMPTY_STATE: PollerState = {
  currentJob: null,
  history: [],
  retryTracker: {},
  lastPollAt: null,
};

export class StateManager {
  private state: PollerState;

  constructor(private filePath: string) {
    this.state = this.load();
  }

  private load(): PollerState {
    if (!existsSync(this.filePath)) return { ...EMPTY_STATE, history: [], retryTracker: {} };
    try {
      const raw = readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw) as PollerState;
    } catch {
      console.warn(`[state] Corrupt state file, starting fresh`);
      return { ...EMPTY_STATE, history: [], retryTracker: {} };
    }
  }

  private save(): void {
    writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }

  get currentJob(): JobRecord | null {
    return this.state.currentJob;
  }

  get lastPollAt(): string | null {
    return this.state.lastPollAt;
  }

  recordPoll(): void {
    this.state.lastPollAt = new Date().toISOString();
    this.save();
  }

  /**
   * Check if a job was already running when poller restarted.
   * This is the "crash recovery" scenario.
   */
  hasOrphanedJob(): boolean {
    return this.state.currentJob !== null && this.state.currentJob.status === "running";
  }

  getRetryCount(issueId: string): number {
    return this.state.retryTracker[issueId] || 0;
  }

  startJob(issueId: string, identifier: string, title: string): void {
    const job: JobRecord = {
      issueId,
      identifier,
      title,
      status: "running",
      startedAt: new Date().toISOString(),
      retryCount: this.getRetryCount(issueId),
    };
    this.state.currentJob = job;
    this.save();
  }

  finishJob(status: "succeeded" | "failed" | "timed_out", errorMessage?: string, antfarmRunId?: string): void {
    if (!this.state.currentJob) return;

    this.state.currentJob.status = status;
    this.state.currentJob.finishedAt = new Date().toISOString();
    if (errorMessage) this.state.currentJob.errorMessage = errorMessage;
    if (antfarmRunId) this.state.currentJob.antfarmRunId = antfarmRunId;

    // Update retry tracker on failure
    if (status === "failed" || status === "timed_out") {
      const id = this.state.currentJob.issueId;
      this.state.retryTracker[id] = (this.state.retryTracker[id] || 0) + 1;
    } else {
      // Clear retry count on success
      delete this.state.retryTracker[this.state.currentJob.issueId];
    }

    // Move to history
    this.state.history.push({ ...this.state.currentJob });
    this.state.currentJob = null;

    // Keep last 100 entries
    if (this.state.history.length > 100) {
      this.state.history = this.state.history.slice(-100);
    }

    this.save();
  }

  clearOrphanedJob(): void {
    if (this.state.currentJob) {
      this.state.currentJob.status = "failed";
      this.state.currentJob.finishedAt = new Date().toISOString();
      this.state.currentJob.errorMessage = "Poller restarted while job was running (orphaned)";
      this.state.history.push({ ...this.state.currentJob });
      this.state.currentJob = null;
      this.save();
    }
  }

  getStatus(): { current: JobRecord | null; recent: JobRecord[]; retries: Record<string, number> } {
    return {
      current: this.state.currentJob,
      recent: this.state.history.slice(-10),
      retries: this.state.retryTracker,
    };
  }
}
