import { useState, useEffect, useCallback } from 'react';
import type { ServiceName } from '../store/runTypes';
import { API_URLS } from '../../../lib/config';

const SERVICE_URLS: Record<ServiceName, string> = {
  ingestor: API_URLS.INGESTOR,
  mapper: API_URLS.MAPPER,
  garmin: API_URLS.GARMIN,
  strava: API_URLS.STRAVA,
  calendar: API_URLS.CALENDAR,
  chat: API_URLS.CHAT,
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

  const checkAll = useCallback(async () => {
    await Promise.all(
      (Object.entries(SERVICE_URLS) as [ServiceName, string][]).map(async ([name, url]) => {
        const start = Date.now();
        try {
          const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
          const latencyMs = Date.now() - start;
          setHealth(prev => ({
            ...prev,
            [name]: { status: res.ok ? 'up' : 'down', latencyMs, checkedAt: start + latencyMs },
          }));
        } catch {
          setHealth(prev => ({
            ...prev,
            [name]: { status: 'down', checkedAt: Date.now() },
          }));
        }
      }),
    );
  }, []);

  useEffect(() => {
    checkAll();
    const interval = setInterval(checkAll, 30_000);
    return () => clearInterval(interval);
  }, [checkAll]);

  return { health, refresh: checkAll };
}
