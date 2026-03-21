/**
 * Types for the Sync Dashboard (AMA-1127).
 */

export type IntegrationHealth = 'ok' | 'syncing' | 'error';

export interface IntegrationStatus {
  platformId: string;
  name: string;
  icon: string;
  color: string;
  health: IntegrationHealth;
  lastSyncedAt: Date | null;
  sessionsThisWeek: number;
  errorMessage?: string;
}

export interface PendingDecision {
  id: string;
  type: 'conflict' | 'suggestion' | 'confirmation';
  title: string;
  description: string;
  rationale: string;
  actions: DecisionAction[];
  createdAt: string;
  agent: string;
}

export interface DecisionAction {
  id: string;
  label: string;
  variant: 'default' | 'outline' | 'ghost';
  /** The value passed to the resolve handler */
  value: string;
}
