/**
 * Antfarm workflow runner.
 * Spawns `antfarm workflow run` as a child process with timeout handling.
 */

import { spawn } from "node:child_process";
import type { Config } from "./config.js";

export interface AntfarmResult {
  success: boolean;
  runId: string | null;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

/**
 * Build the task prompt from a Linear issue.
 * This is what gets passed to `antfarm workflow run <workflow> "<task>"`.
 */
export function buildTaskPrompt(issue: {
  identifier: string;
  title: string;
  description: string;
  url: string;
}): string {
  // Truncate description to avoid shell argument limits (~100KB is safe, but be conservative)
  const maxDescLen = 8000;
  const desc =
    issue.description.length > maxDescLen
      ? issue.description.slice(0, maxDescLen) + "\n\n[description truncated]"
      : issue.description;

  return [
    `Linear ticket: ${issue.identifier} — ${issue.title}`,
    `URL: ${issue.url}`,
    "",
    "## Description",
    desc,
    "",
    "## Instructions",
    "- Follow the ticket description exactly",
    "- Commit your work with a message referencing the ticket ID",
    "- If the ticket references specific files, only modify those files",
    "- Run any relevant tests before finishing",
  ].join("\n");
}

/**
 * Run an Antfarm workflow and wait for completion.
 * Handles: stdout/stderr capture, timeout, exit code parsing, run ID extraction.
 */
export function runWorkflow(
  config: Config,
  task: string
): Promise<AntfarmResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let runId: string | null = null;

    const proc = spawn(config.antfarmBin, ["workflow", "run", config.antfarmWorkflow, task], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
      // Don't inherit cwd — antfarm should handle its own working directory
    });

    // Capture output
    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;

      // Try to extract run ID from antfarm output
      // Antfarm typically outputs something like "Run ID: abc-123" or "Started run abc-123"
      const runIdMatch = text.match(/(?:Run ID|run|Started run)[:\s]+([a-zA-Z0-9_-]+)/i);
      if (runIdMatch && !runId) {
        runId = runIdMatch[1];
      }

      // Stream to console for visibility
      process.stdout.write(`  [antfarm] ${text}`);
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(`  [antfarm:err] ${text}`);
    });

    // Timeout handler
    const timer = setTimeout(() => {
      timedOut = true;
      console.warn(`[antfarm] Timeout after ${config.antfarmTimeoutMs}ms — killing process`);
      proc.kill("SIGTERM");

      // Force kill after 10s if SIGTERM doesn't work
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill("SIGKILL");
        }
      }, 10000);
    }, config.antfarmTimeoutMs);

    proc.on("close", (exitCode) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      resolve({
        success: exitCode === 0 && !timedOut,
        runId,
        stdout,
        stderr,
        exitCode,
        timedOut,
        durationMs,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      resolve({
        success: false,
        runId: null,
        stdout,
        stderr: `${stderr}\nProcess error: ${err.message}`,
        exitCode: null,
        timedOut: false,
        durationMs,
      });
    });
  });
}
