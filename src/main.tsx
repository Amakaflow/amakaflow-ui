import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { AppShell } from "./app/AppShell.tsx";
import { ClerkWrapper } from "./components/ClerkWrapper.tsx";
import { isDemoMode } from "./lib/demo-mode";
import "./index.css";

// Initialize Sentry for error tracking (AMA-225)
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

if (!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) {
  console.warn("⚠️ Missing Clerk Publishable Key - running without authentication");
  console.warn("⚠️ Some features may not work. Set VITE_CLERK_PUBLISHABLE_KEY in .env.local");
}

async function enableMocking() {
  if (!isDemoMode) return;
  const { worker } = await import('./api/mocks/browser');
  return worker.start({ onUnhandledRequest: 'warn' });
}

// ClerkWrapper conditionally provides ClerkProvider or just renders App
enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ClerkWrapper>
        <AppShell />
      </ClerkWrapper>
    </StrictMode>
  );
});