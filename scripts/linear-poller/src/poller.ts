#!/usr/bin/env tsx
/**
 * Linear → Antfarm Poller
 *
 * Polls Linear for tickets in "Todo" assigned to a specific agent,
 * checks blockers, and dispatches Antfarm workflows one at a time.
 *
 * SCENARIOS HANDLED:
 *
 * 1. Happy path: Todo ticket → check blockers → In Progress → antfarm → Done
 * 2. Blocked ticket: Todo but has unresolved blockers → skip, log reason
 * 3. No tickets: Nothing in Todo → sleep until next poll
 * 4. Workflow fails: antfarm exits non-zero → comment error → back to Todo → increment retry
 * 5. Workflow timeout: antfarm exceeds timeout → kill → comment → back to Todo
 * 6. Max retries exceeded: ticket failed too many times → comment → leave in Todo (stop retrying)
 * 7. Linear API down: catch error → log → retry on next poll
 * 8. Antfarm binary missing: catch spawn error → log → exit
 * 9. Poller restart with orphaned job: detect running job in state → mark failed → resume polling
 * 10. Ticket reassigned during execution: check assignee before marking Done
 * 11. Ticket canceled during execution: check status before marking Done
 * 12. Ticket moved out of Todo before dispatch: re-verify status before starting
 * 13. Empty description: skip ticket, comment asking for description
 * 14. Duplicate dispatch prevention: state tracks current job, won't start another
 * 15. Graceful shutdown: SIGINT/SIGTERM → finish current poll, don't start new dispatch
 *
 * USAGE:
 *   npm start          # Run continuous poller
 *   npm run once       # Run one poll cycle and exit
 *   npm run dry-run    # Poll and log what would happen, don't dispatch
 *   npm run status     # Show current poller state and recent history
 */

import { loadConfig, type Config } from "./config.js";
import { LinearClient, type ReadyIssue } from "./linear.js";
import { buildTaskPrompt, runWorkflow } from "./antfarm.js";
import { StateManager } from "./state.js";
import { log } from "./log.js";

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------
let shuttingDown = false;
let config: Config;
let linear: LinearClient;
let state: StateManager;

// ---------------------------------------------------------------------------
// Signal handling (Scenario 15)
// ---------------------------------------------------------------------------
function setupSignalHandlers(): void {
  const handler = (signal: string) => {
    log.warn("poller", `Received ${signal} — shutting down gracefully`);
    shuttingDown = true;
    // If no job is running, exit immediately
    if (!state.currentJob) {
      process.exit(0);
    }
    // Otherwise, the current dispatch will finish and then we exit
  };
  process.on("SIGINT", () => handler("SIGINT"));
  process.on("SIGTERM", () => handler("SIGTERM"));
}

// ---------------------------------------------------------------------------
// Pick the best ticket to dispatch
// ---------------------------------------------------------------------------
function pickNextTicket(issues: ReadyIssue[]): ReadyIssue | null {
  // Filter to only unblocked issues
  const ready = issues.filter((i) => i.blockedByUnresolved.length === 0);

  if (ready.length === 0) {
    if (issues.length > 0) {
      // All tickets are blocked — log why
      for (const issue of issues) {
        log.info("picker", `${issue.identifier} blocked by: ${issue.blockedByUnresolved.join(", ")}`);
      }
    }
    return null;
  }

  // Filter out tickets that exceeded max retries (Scenario 6)
  const retriable = ready.filter((i) => {
    const retries = state.getRetryCount(i.id);
    if (retries >= config.maxRetries) {
      log.warn("picker", `${i.identifier} skipped — exceeded max retries (${retries}/${config.maxRetries})`);
      return false;
    }
    return true;
  });

  if (retriable.length === 0) return null;

  // Pick lowest ticket number (oldest first)
  retriable.sort((a, b) => a.number - b.number);
  return retriable[0];
}

// ---------------------------------------------------------------------------
// Dispatch a single ticket through Antfarm
// ---------------------------------------------------------------------------
async function dispatchTicket(issue: ReadyIssue): Promise<void> {
  const tag = `dispatch:${issue.identifier}`;

  // Scenario 13: Empty description
  if (!issue.description.trim()) {
    log.warn(tag, "Ticket has no description — skipping and commenting");
    await linear.addComment(
      issue.id,
      `⚠️ **Poller skipped**: This ticket has no description. Please add implementation details so the agent can work on it.`
    );
    return;
  }

  // Scenario 12: Re-verify status before dispatch (race condition guard)
  const fresh = await linear.fetchIssue(issue.id);
  if (!fresh) {
    log.warn(tag, "Could not re-fetch issue — skipping");
    return;
  }
  if (fresh.state.name !== config.linearPickupStatus) {
    log.info(tag, `Status changed to "${fresh.state.name}" since last poll — skipping`);
    return;
  }
  if (!fresh.assignee || fresh.assignee.id !== config.linearAssigneeId) {
    log.info(tag, "Assignee changed since last poll — skipping");
    return;
  }

  // Move to In Progress
  log.info(tag, "Moving to In Progress");
  await linear.moveToInProgress(issue.id);

  // Record in state (Scenario 14: prevents duplicate dispatch)
  state.startJob(issue.id, issue.identifier, issue.title);

  // Build task prompt
  const task = buildTaskPrompt(issue);
  log.info(tag, `Dispatching antfarm workflow "${config.antfarmWorkflow}"`, {
    titleLength: issue.title.length,
    descLength: issue.description.length,
  });

  if (config.dryRun) {
    log.info(tag, "[DRY RUN] Would dispatch antfarm — skipping");
    log.info(tag, `[DRY RUN] Task prompt:\n${task.slice(0, 500)}...`);
    state.finishJob("succeeded");
    await linear.moveToTodo(issue.id);  // Move back since we didn't actually do anything
    return;
  }

  // Run the workflow (Scenario 1, 4, 5)
  const result = await runWorkflow(config, task);

  // Post-execution: verify ticket state before updating (Scenario 10, 11)
  const postExec = await linear.fetchIssue(issue.id);

  if (result.success) {
    // --- SUCCESS ---
    log.info(tag, `Workflow succeeded in ${Math.round(result.durationMs / 1000)}s`);
    state.finishJob("succeeded", undefined, result.runId ?? undefined);

    if (!postExec) {
      log.warn(tag, "Could not re-fetch issue after success — leaving as-is");
      return;
    }

    // Scenario 10: Check if still assigned to us
    if (postExec.assignee?.id !== config.linearAssigneeId) {
      log.warn(tag, "Assignee changed during execution — not marking Done");
      await linear.addComment(
        issue.id,
        `✅ **Antfarm completed** workflow for this ticket, but assignee changed during execution. Please review the work.`
      );
      return;
    }

    // Scenario 11: Check if ticket was canceled
    if (postExec.state.type === "canceled") {
      log.warn(tag, "Ticket was canceled during execution — not marking Done");
      return;
    }

    // Mark Done and comment
    await linear.moveToDone(issue.id);
    await linear.addComment(
      issue.id,
      [
        `✅ **Antfarm completed** this ticket.`,
        "",
        `- Workflow: \`${config.antfarmWorkflow}\``,
        result.runId ? `- Run ID: \`${result.runId}\`` : null,
        `- Duration: ${Math.round(result.durationMs / 1000)}s`,
      ]
        .filter(Boolean)
        .join("\n")
    );
  } else {
    // --- FAILURE ---
    const reason = result.timedOut
      ? `Workflow timed out after ${Math.round(config.antfarmTimeoutMs / 1000)}s`
      : `Workflow failed with exit code ${result.exitCode}`;

    log.error(tag, reason);
    state.finishJob(result.timedOut ? "timed_out" : "failed", reason, result.runId ?? undefined);

    // Truncate stderr for comment (Linear has a body limit)
    const stderrSnippet = result.stderr.slice(-1500);

    await linear.addComment(
      issue.id,
      [
        `❌ **Antfarm failed** on this ticket.`,
        "",
        `- Reason: ${reason}`,
        `- Workflow: \`${config.antfarmWorkflow}\``,
        result.runId ? `- Run ID: \`${result.runId}\`` : null,
        `- Retry: ${state.getRetryCount(issue.id)}/${config.maxRetries}`,
        "",
        stderrSnippet
          ? `<details><summary>Last stderr output</summary>\n\n\`\`\`\n${stderrSnippet}\n\`\`\`\n</details>`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    );

    // Move back to Todo for retry (unless max retries hit)
    if (state.getRetryCount(issue.id) < config.maxRetries) {
      log.info(tag, "Moving back to Todo for retry");
      if (postExec && postExec.state.type !== "canceled") {
        await linear.moveToTodo(issue.id);
      }
    } else {
      log.warn(tag, `Max retries (${config.maxRetries}) exceeded — leaving in current state`);
      await linear.addComment(
        issue.id,
        `⛔ **Max retries exceeded** (${config.maxRetries}). This ticket needs manual attention.`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Single poll cycle
// ---------------------------------------------------------------------------
async function pollOnce(): Promise<void> {
  // Scenario 14: Don't start new work if something is already running
  if (state.currentJob) {
    log.warn("poll", `Job already running: ${state.currentJob.identifier} — skipping poll`);
    return;
  }

  state.recordPoll();
  log.info("poll", `Checking Linear for ${config.linearAssigneeName}'s "${config.linearPickupStatus}" tickets...`);

  let issues: ReadyIssue[];
  try {
    issues = await linear.fetchTodoIssues();
  } catch (err) {
    // Scenario 7: Linear API down
    log.error("poll", `Linear API error: ${(err as Error).message}`);
    return;
  }

  log.info("poll", `Found ${issues.length} ticket(s) in "${config.linearPickupStatus}"`);

  if (issues.length === 0) return;

  const next = pickNextTicket(issues);
  if (!next) {
    log.info("poll", "No unblocked, retriable tickets available");
    return;
  }

  log.info("poll", `Selected: ${next.identifier} — ${next.title}`);

  try {
    await dispatchTicket(next);
  } catch (err) {
    // Unexpected error during dispatch
    log.error("dispatch", `Unexpected error: ${(err as Error).message}`);
    state.finishJob("failed", (err as Error).message);

    // Try to move back to Todo and comment
    try {
      await linear.moveToTodo(next.id);
      await linear.addComment(
        next.id,
        `❌ **Poller error**: Unexpected error during dispatch: ${(err as Error).message}`
      );
    } catch {
      log.error("dispatch", "Failed to update Linear after error");
    }
  }
}

// ---------------------------------------------------------------------------
// Status command
// ---------------------------------------------------------------------------
function showStatus(): void {
  const { current, recent, retries } = state.getStatus();

  console.log("\n=== Linear-Antfarm Poller Status ===\n");

  if (current) {
    console.log(`Current job: ${current.identifier} — ${current.title}`);
    console.log(`  Status: ${current.status}`);
    console.log(`  Started: ${current.startedAt}`);
  } else {
    console.log("Current job: none (idle)");
  }

  console.log(`\nLast poll: ${state.lastPollAt || "never"}`);

  if (Object.keys(retries).length > 0) {
    console.log("\nRetry tracker:");
    for (const [id, count] of Object.entries(retries)) {
      console.log(`  ${id}: ${count} retries`);
    }
  }

  if (recent.length > 0) {
    console.log("\nRecent history:");
    for (const job of recent) {
      const duration = job.finishedAt
        ? `${Math.round((new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)}s`
        : "—";
      console.log(`  ${job.identifier} [${job.status}] ${duration} — ${job.title}`);
      if (job.errorMessage) console.log(`    Error: ${job.errorMessage}`);
    }
  }

  console.log("");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  config = loadConfig();
  linear = new LinearClient(config);
  state = new StateManager(config.stateFile);

  // Handle --status flag
  if (process.argv.includes("--status")) {
    showStatus();
    return;
  }

  setupSignalHandlers();

  // Scenario 9: Handle orphaned job from previous run
  if (state.hasOrphanedJob()) {
    const orphan = state.currentJob!;
    log.warn("startup", `Found orphaned job: ${orphan.identifier} — marking as failed`);
    state.clearOrphanedJob();

    // Try to move ticket back to Todo
    try {
      await linear.moveToTodo(orphan.issueId);
      await linear.addComment(
        orphan.issueId,
        `⚠️ **Poller restarted** while this ticket was being processed. Moving back to Todo for retry.`
      );
    } catch {
      log.error("startup", "Could not update orphaned ticket in Linear");
    }
  }

  // Scenario 8: Verify antfarm is available (unless dry-run)
  if (!config.dryRun) {
    const { execSync } = await import("node:child_process");
    try {
      execSync(`${config.antfarmBin} --version`, { stdio: "pipe" });
    } catch {
      log.error("startup", `Cannot find antfarm binary at "${config.antfarmBin}"`);
      log.error("startup", "Set ANTFARM_BIN env var or install antfarm globally");
      process.exit(1);
    }
  }

  const runOnce = process.argv.includes("--once");

  log.info("startup", `Poller started`, {
    assignee: config.linearAssigneeName,
    pickupStatus: config.linearPickupStatus,
    workflow: config.antfarmWorkflow,
    pollInterval: `${config.pollIntervalMs / 1000}s`,
    maxRetries: config.maxRetries,
    dryRun: config.dryRun,
    mode: runOnce ? "once" : "continuous",
  });

  if (runOnce) {
    await pollOnce();
    return;
  }

  // Continuous polling loop
  while (!shuttingDown) {
    await pollOnce();

    if (shuttingDown) break;

    // Wait for next poll interval
    log.debug("poll", `Sleeping ${config.pollIntervalMs / 1000}s...`);
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }

  log.info("shutdown", "Poller stopped cleanly");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
