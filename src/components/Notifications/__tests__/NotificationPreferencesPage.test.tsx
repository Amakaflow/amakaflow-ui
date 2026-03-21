/**
 * Tests for NotificationPreferencesPage (AMA-1132).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationPreferencesPage } from '../NotificationPreferencesPage';
import { NotificationPreferences } from '../../../hooks/useNotifications';

const DEFAULT_PREFS: NotificationPreferences = {
  user_id: 'test-user',
  workout_reminders: true,
  sync_alerts: true,
  conflict_warnings: true,
  readiness_alerts: true,
  weekly_summary: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
};

describe('NotificationPreferencesPage', () => {
  it('renders all five notification toggles', () => {
    const onToggle = vi.fn();
    const onQuietHoursChange = vi.fn();

    render(
      <NotificationPreferencesPage
        preferences={DEFAULT_PREFS}
        onToggle={onToggle}
        onQuietHoursChange={onQuietHoursChange}
      />,
    );

    expect(screen.getByTestId('notification-preferences-page')).toBeTruthy();
    expect(screen.getByTestId('notification-toggle-workout_reminders')).toBeTruthy();
    expect(screen.getByTestId('notification-toggle-sync_alerts')).toBeTruthy();
    expect(screen.getByTestId('notification-toggle-conflict_warnings')).toBeTruthy();
    expect(screen.getByTestId('notification-toggle-readiness_alerts')).toBeTruthy();
    expect(screen.getByTestId('notification-toggle-weekly_summary')).toBeTruthy();
  });

  it('displays notification type labels and examples', () => {
    render(
      <NotificationPreferencesPage
        preferences={DEFAULT_PREFS}
        onToggle={vi.fn()}
        onQuietHoursChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Workout Reminders')).toBeTruthy();
    expect(screen.getByText('Sync Alerts')).toBeTruthy();
    expect(screen.getByText('Conflict Warnings')).toBeTruthy();
    expect(screen.getByText('Readiness Alerts')).toBeTruthy();
    expect(screen.getByText('Weekly Summary')).toBeTruthy();

    // Example notification text
    expect(screen.getByText(/interval run is in 1 hour/)).toBeTruthy();
    expect(screen.getByText(/3 new sessions pulled/)).toBeTruthy();
  });

  it('renders quiet hours inputs with correct values', () => {
    render(
      <NotificationPreferencesPage
        preferences={DEFAULT_PREFS}
        onToggle={vi.fn()}
        onQuietHoursChange={vi.fn()}
      />,
    );

    const startInput = screen.getByTestId('quiet-hours-start') as HTMLInputElement;
    const endInput = screen.getByTestId('quiet-hours-end') as HTMLInputElement;

    expect(startInput.value).toBe('22:00');
    expect(endInput.value).toBe('07:00');
  });

  it('calls onQuietHoursChange when quiet hours inputs change', () => {
    const onQuietHoursChange = vi.fn();

    render(
      <NotificationPreferencesPage
        preferences={DEFAULT_PREFS}
        onToggle={vi.fn()}
        onQuietHoursChange={onQuietHoursChange}
      />,
    );

    const startInput = screen.getByTestId('quiet-hours-start');
    fireEvent.change(startInput, { target: { value: '23:00' } });

    expect(onQuietHoursChange).toHaveBeenCalledWith('23:00', '07:00');
  });

  it('renders with null preferences using defaults', () => {
    render(
      <NotificationPreferencesPage
        preferences={null}
        onToggle={vi.fn()}
        onQuietHoursChange={vi.fn()}
      />,
    );

    // Should still render all toggles with defaults
    expect(screen.getByTestId('notification-preferences-page')).toBeTruthy();
    expect(screen.getByTestId('quiet-hours-section')).toBeTruthy();
  });

  it('disables switches when isLoading is true', () => {
    render(
      <NotificationPreferencesPage
        preferences={DEFAULT_PREFS}
        onToggle={vi.fn()}
        onQuietHoursChange={vi.fn()}
        isLoading={true}
      />,
    );

    const switchEl = screen.getByTestId('switch-workout_reminders');
    expect(switchEl).toHaveAttribute('data-disabled', '');
  });
});
