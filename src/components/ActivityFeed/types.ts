/**
 * PendingAction types matching the backend model (AMA-1124).
 */

export type AgentName = 'scheduler' | 'stryd_sync' | 'strava_enricher' | 'garmin_pusher';

export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'undone';

export type ApprovalPath = 'auto' | 'user_required';

export interface PendingAction {
  id: string;
  user_id: string;
  agent: AgentName;
  action_type: string;
  payload: Record<string, unknown>;
  status: ActionStatus;
  approval_path: ApprovalPath;
  rationale: string;
  reversible: boolean;
  snapshot: Record<string, unknown> | null;
  created_at: string;
  applied_at: string | null;
  undone_at: string | null;
}
