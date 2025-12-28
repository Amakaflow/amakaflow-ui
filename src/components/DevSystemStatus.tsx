import { useEffect, useState } from "react";
import { getApiHealthEndpoints } from "../lib/config";

type ServiceConfig = {
  name: string;
  url: string;
};

type ServiceState = ServiceConfig & {
  loading: boolean;
  error?: string;
  data?: any;
};

// Use centralized API config for health endpoints
const SERVICES: ServiceConfig[] = getApiHealthEndpoints();

export function DevSystemStatus() {
  // Don't show anything in production
  if (import.meta.env.PROD) return null;
  if (SERVICES.length === 0) return null;

  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<ServiceState[]>(
    SERVICES.map((s) => ({ ...s, loading: true }))
  );

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      const results: ServiceState[] = [];

      for (const svc of SERVICES) {
        const state: ServiceState = { ...svc, loading: false };

        try {
          const res = await fetch(svc.url, {
            headers: { Accept: "application/json" },
            // Add timeout to prevent hanging
            signal: AbortSignal.timeout(5000)
          });

          if (!res.ok) {
            state.error = `HTTP ${res.status}`;
          } else {
            const data = await res.json().catch(() => null);
            state.data = data;
          }
        } catch (err: any) {
          if (err.name === 'AbortError') {
            state.error = "Timeout";
          } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
            state.error = "Not reachable";
          } else {
            state.error = err?.message ?? "Network error";
          }
        }

        results.push(state);
      }

      if (!isCancelled) {
        setServices(results);
      }
    }

    load();

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <>
      {/* Always-visible toggle pill */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          left: 8,
          bottom: 8,
          padding: "4px 10px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.75)",
          color: "#fff",
          fontSize: 11,
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
          zIndex: 9999,
          border: "none",
          cursor: "pointer"
        }}
      >
        Dev {open ? "▾" : "▴"}
      </button>

      {/* Drawer */}
      {open && (
        <div
          style={{
            position: "fixed",
            left: 8,
            bottom: 36, // sits just above the pill
            width: 340,
            maxHeight: "50vh",
            overflow: "auto",
            padding: 10,
            borderRadius: 8,
            background: "rgba(0,0,0,0.9)",
            color: "#fff",
            fontSize: 11,
            fontFamily:
              'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            zIndex: 9999,
            boxShadow: "0 8px 20px rgba(0,0,0,0.4)"
          }}
        >
          <div
            style={{
              marginBottom: 6,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontWeight: 600
            }}
          >
            <span>Dev System Status</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                border: "none",
                background: "transparent",
                color: "#fff",
                cursor: "pointer",
                fontSize: 12
              }}
            >
              ✕
            </button>
          </div>

          {/* List of services */}
          {services.map((svc) => (
            <div
              key={svc.name}
              style={{
                marginBottom: 8,
                paddingBottom: 8,
                borderBottom: "1px solid rgba(255,255,255,0.15)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{svc.name}</span>
                <span>
                  {svc.loading ? "Loading…" : svc.error ? "❌" : "✅"}
                </span>
              </div>

              {svc.error && (
                <div style={{ color: "#f99", marginTop: 2 }}>{svc.error}</div>
              )}

              {!svc.error && svc.data && (
                <pre
                  style={{
                    marginTop: 4,
                    maxHeight: 80,
                    overflow: "auto",
                    background: "rgba(255,255,255,0.05)",
                    padding: 6,
                    borderRadius: 4,
                    fontSize: 10,
                    fontFamily: "Menlo, monospace",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word"
                  }}
                >
                  {JSON.stringify(svc.data, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

