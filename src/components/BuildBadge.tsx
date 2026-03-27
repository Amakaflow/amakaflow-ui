import buildInfoJson from "../build-info.json";
import { isDemoMode } from "../lib/demo-mode";

type BuildInfo = {
  appName: string;
  version: string;
  gitSha: string;
  builtAt: string;
  env: string;
};

const buildInfo = buildInfoJson as BuildInfo;

export function BuildBadge() {
  // Hide in production and demo mode
  if (import.meta.env.PROD || isDemoMode) return null;

  // Debug logging
  if (import.meta.env.DEV) {
    console.log('BuildBadge - buildInfo:', buildInfo);
  }

  if (!buildInfo) {
    console.warn('BuildBadge - buildInfo is null');
    return null;
  }

  if (!buildInfo.version) {
    console.warn('BuildBadge - version is missing:', buildInfo);
    return null;
  }

  let builtAtLocal = buildInfo.builtAt;
  try {
    builtAtLocal = new Date(buildInfo.builtAt).toLocaleString();
  } catch {
    // ignore
  }

  const label = `${buildInfo.appName} • ${buildInfo.version} • ${buildInfo.gitSha} • ${builtAtLocal}`;

  return (
    <div
      style={{
        position: "fixed",
        left: 8,
        bottom: 8,
        padding: "4px 8px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.75)",
        color: "#fff",
        fontSize: 11,
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        zIndex: 9999,
        maxWidth: "90vw",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        pointerEvents: "none"
      }}
      aria-label={`Build info: ${label}`}
    >
      {label}
    </div>
  );
}

export default BuildBadge;

