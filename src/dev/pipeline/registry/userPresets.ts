import type { FlowDefinition } from '../store/runTypes';

const KEY = 'observatory-user-presets';

export function getUserPresets(): FlowDefinition[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch { return []; }
}

export function saveUserPreset(flow: FlowDefinition): void {
  const existing = getUserPresets().filter(p => p.id !== flow.id);
  localStorage.setItem(KEY, JSON.stringify([...existing, flow]));
}

export function deleteUserPreset(id: string): void {
  const existing = getUserPresets().filter(p => p.id !== id);
  localStorage.setItem(KEY, JSON.stringify(existing));
}
