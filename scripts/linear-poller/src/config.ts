/**
 * Configuration loaded from environment variables.
 * All required vars are validated at startup.
 */

export interface Config {
  // Linear
  linearApiKey: string;
  linearTeamId: string;
  linearAssigneeId: string;    // User ID for Joshua
  linearAssigneeName: string;  // Display name for logs
  linearPickupStatus: string;  // Status to poll (default: "Todo")
  linearInProgressStatusId: string;
  linearDoneStatusId: string;
  linearTodoStatusId: string;

  // Antfarm
  antfarmBin: string;          // Path to antfarm binary
  antfarmWorkflow: string;     // Workflow ID (default: "feature-dev")
  antfarmTimeoutMs: number;    // Max time per workflow run (default: 30 min)

  // Poller
  pollIntervalMs: number;      // How often to check Linear (default: 60s)
  maxRetries: number;          // Max dispatch retries per ticket (default: 2)
  stateFile: string;           // Path to JSON state file
  dryRun: boolean;             // If true, log but don't dispatch
}

const required = (key: string): string => {
  const val = process.env[key];
  if (!val) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
  return val;
};

const optional = (key: string, fallback: string): string =>
  process.env[key] || fallback;

export function loadConfig(): Config {
  return {
    linearApiKey: required("LINEAR_API_KEY"),
    linearTeamId: optional("LINEAR_TEAM_ID", "6c2d1065-85ae-4402-b8ac-64b8530dd663"),
    linearAssigneeId: optional("LINEAR_ASSIGNEE_ID", "9f0978e8-76bb-41de-b83d-6773d7c87fd9"),
    linearAssigneeName: optional("LINEAR_ASSIGNEE_NAME", "Joshua"),
    linearPickupStatus: optional("LINEAR_PICKUP_STATUS", "Todo"),
    linearInProgressStatusId: optional("LINEAR_IN_PROGRESS_STATUS_ID", "bafb8538-5b85-45c4-8630-7effdddbf34e"),
    linearDoneStatusId: optional("LINEAR_DONE_STATUS_ID", "06db5600-ff0f-47d8-92b8-d742ab151def"),
    linearTodoStatusId: optional("LINEAR_TODO_STATUS_ID", "1e077984-ac88-4a3d-b162-36b660dba604"),

    antfarmBin: optional("ANTFARM_BIN", "antfarm"),
    antfarmWorkflow: optional("ANTFARM_WORKFLOW", "feature-dev"),
    antfarmTimeoutMs: parseInt(optional("ANTFARM_TIMEOUT_MS", "1800000"), 10),  // 30 min

    pollIntervalMs: parseInt(optional("POLL_INTERVAL_MS", "60000"), 10),  // 60s
    maxRetries: parseInt(optional("MAX_RETRIES", "2"), 10),
    stateFile: optional("STATE_FILE", "./poller-state.json"),
    dryRun: process.argv.includes("--dry-run"),
  };
}
