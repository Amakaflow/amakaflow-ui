/**
 * Simple structured logger.
 */

type Level = "info" | "warn" | "error" | "debug";

const COLORS: Record<Level, string> = {
  info: "\x1b[36m",   // cyan
  warn: "\x1b[33m",   // yellow
  error: "\x1b[31m",  // red
  debug: "\x1b[90m",  // gray
};
const RESET = "\x1b[0m";

function fmt(level: Level, tag: string, msg: string, data?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const color = COLORS[level];
  const dataStr = data ? ` ${JSON.stringify(data)}` : "";
  return `${color}[${ts}] [${level.toUpperCase()}] [${tag}]${RESET} ${msg}${dataStr}`;
}

export const log = {
  info: (tag: string, msg: string, data?: Record<string, unknown>) =>
    console.log(fmt("info", tag, msg, data)),
  warn: (tag: string, msg: string, data?: Record<string, unknown>) =>
    console.warn(fmt("warn", tag, msg, data)),
  error: (tag: string, msg: string, data?: Record<string, unknown>) =>
    console.error(fmt("error", tag, msg, data)),
  debug: (tag: string, msg: string, data?: Record<string, unknown>) =>
    process.env.DEBUG && console.log(fmt("debug", tag, msg, data)),
};
