import { getUserPresets, saveUserPreset, deleteUserPreset } from '../userPresets';

beforeEach(() => {
  localStorage.clear();
});

test('getUserPresets returns empty array when nothing saved', () => {
  expect(getUserPresets()).toEqual([]);
});

test('saveUserPreset persists and retrieves a preset', () => {
  const flow = { id: 'user-1', label: 'My Preset', steps: ['ingest-youtube', 'export-garmin'] };
  saveUserPreset(flow);
  expect(getUserPresets()).toHaveLength(1);
  expect(getUserPresets()[0].label).toBe('My Preset');
});

test('saveUserPreset overwrites preset with same id', () => {
  const flow1 = { id: 'user-1', label: 'Version 1', steps: ['ingest-youtube'] };
  const flow2 = { id: 'user-1', label: 'Version 2', steps: ['ingest-youtube', 'export-garmin'] };
  saveUserPreset(flow1);
  saveUserPreset(flow2);
  expect(getUserPresets()).toHaveLength(1);
  expect(getUserPresets()[0].label).toBe('Version 2');
});

test('deleteUserPreset removes preset by id', () => {
  saveUserPreset({ id: 'user-1', label: 'A', steps: [] });
  saveUserPreset({ id: 'user-2', label: 'B', steps: [] });
  deleteUserPreset('user-1');
  expect(getUserPresets()).toHaveLength(1);
  expect(getUserPresets()[0].id).toBe('user-2');
});

test('getUserPresets returns empty array on invalid JSON', () => {
  localStorage.setItem('observatory-user-presets', 'invalid-json');
  expect(getUserPresets()).toEqual([]);
});
