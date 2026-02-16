# Linear → Antfarm Poller

Polls Linear for "Todo" tickets assigned to Joshua and dispatches them through Antfarm workflows, one at a time.

## Setup

```bash
cd amakaflow-automation/scripts/linear-poller
npm install
cp .env.example .env
# Edit .env with your LINEAR_API_KEY
```

## Usage

```bash
# Continuous polling (every 60s)
npm start

# Single poll cycle (for testing or cron)
npm run once

# See what would happen without dispatching
npm run dry-run

# Check poller state and history
npm run status
```

## How it works

```
every 60s:
  1. Query Linear: assignee=Joshua, status=Todo
  2. Filter out tickets with unresolved blockers
  3. Filter out tickets that exceeded max retries
  4. Pick lowest ticket number (oldest first)
  5. Re-verify ticket status (race condition guard)
  6. Move ticket to "In Progress"
  7. Run: antfarm workflow run feature-dev "<ticket details>"
  8. On success → move to "Done", add comment
  9. On failure → add error comment, move back to "Todo" for retry
```

## Scenarios handled

| # | Scenario | Behavior |
|---|----------|----------|
| 1 | Happy path | Todo → In Progress → antfarm → Done |
| 2 | Blocked ticket | Skip, log which tickets block it |
| 3 | No tickets | Sleep until next poll |
| 4 | Workflow fails | Comment error, back to Todo, retry on next poll |
| 5 | Workflow timeout | Kill process, comment, back to Todo |
| 6 | Max retries exceeded | Comment "needs manual attention", stop retrying |
| 7 | Linear API down | Log error, retry on next poll |
| 8 | Antfarm binary missing | Exit with error at startup |
| 9 | Poller restart with orphaned job | Mark previous job failed, move ticket back to Todo |
| 10 | Ticket reassigned during execution | Don't mark Done, add comment |
| 11 | Ticket canceled during execution | Don't mark Done |
| 12 | Ticket moved before dispatch | Re-verify status, skip if changed |
| 13 | Empty description | Skip, comment asking for description |
| 14 | Duplicate dispatch | State tracks current job, blocks new dispatches |
| 15 | Graceful shutdown (SIGINT/SIGTERM) | Finish current work, then exit |

## Workflow for the agent operating this

1. **Move tickets to "Todo"** in Linear when they're ready for Joshua
2. The poller picks them up automatically
3. Check `npm run status` or Linear comments to see progress
4. If a ticket fails repeatedly, it stops retrying and comments for manual attention

## State file

The poller writes `poller-state.json` in its working directory. This tracks:
- Current running job (crash recovery)
- History of last 100 jobs
- Retry counts per ticket

Delete this file to reset all state.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LINEAR_API_KEY` | Yes | — | Linear API key |
| `LINEAR_TEAM_ID` | No | MyAmaka team ID | Team to poll |
| `LINEAR_ASSIGNEE_ID` | No | Joshua's ID | User to poll for |
| `LINEAR_ASSIGNEE_NAME` | No | Joshua | Display name for logs |
| `LINEAR_PICKUP_STATUS` | No | Todo | Status to poll |
| `ANTFARM_BIN` | No | antfarm | Path to antfarm binary |
| `ANTFARM_WORKFLOW` | No | feature-dev | Workflow to dispatch |
| `ANTFARM_TIMEOUT_MS` | No | 1800000 (30min) | Max workflow runtime |
| `POLL_INTERVAL_MS` | No | 60000 (60s) | Poll frequency |
| `MAX_RETRIES` | No | 2 | Max dispatch retries per ticket |
| `STATE_FILE` | No | ./poller-state.json | Path to state file |
| `DEBUG` | No | — | Enable debug logging |
