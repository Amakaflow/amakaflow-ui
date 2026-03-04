import { useState, useEffect } from 'react';
import type { ServiceName } from '../store/runTypes';

const SERVICE_URLS: Record<ServiceName, string> = {
  ingestor: 'http://localhost:8004',
  mapper: 'http://localhost:8001',
  garmin: 'http://localhost:8002',
  strava: 'http://localhost:8000',
  calendar: 'http://localhost:8003',
  chat: 'http://localhost:8005',
};

export interface ServiceStatus {
  status: 'up' | 'down' | 'checking';
  latencyMs?: number;
  checkedAt?: number;
}

export function useServiceHealth() {
  const [health, setHealth] = useState<Record<ServiceName, ServiceStatus>>(() => {
    const initial = {} as Record<ServiceName, ServiceStatus>;
    for (const name of Object.keys(SERVICE_URLS) as ServiceName[]) {
      initial[name] = { status: 'checking' };
    }
    return initial;
  });

  async function checkAll() {
    await Promise.all(
      (Object.entries(SERVICE_URLS) as [ServiceName, string][]).map(async ([name, url]) => {
        const start = Date.now();
        try {
          const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
          const latencyMs = Date.now() - start;
          setHealth(prev => ({
            ...prev,
            [name]: { status: res.ok ? 'up' : 'down', latencyMs, checkedAt: Date.now() },
          }));
        } catch {
          setHealth(prev => ({
            ...prev,
            [name]: { status: 'down', checkedAt: Date.now() },
          }));
        }
      }),
    );
  }

  useEffect(() => {
    checkAll();
    const interval = setInterval(checkAll, 30_000);
    return () => clearInterval(interval);
  }, []);

  return { health, refresh: checkAll };
}
