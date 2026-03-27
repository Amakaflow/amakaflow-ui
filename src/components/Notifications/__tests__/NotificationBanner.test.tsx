/**
 * Tests for NotificationBanner (AMA-1132).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationBanner } from '../NotificationBanner';

describe('NotificationBanner', () => {
  it('renders when permission is default', () => {
    render(<NotificationBanner permission="default" onEnable={vi.fn()} />);

    expect(screen.getByTestId('notification-banner')).toBeTruthy();
    expect(screen.getByText('Enable notifications')).toBeTruthy();
    expect(screen.getByText(/workout reminders/)).toBeTruthy();
  });

  it('does not render when permission is granted', () => {
    render(<NotificationBanner permission="granted" onEnable={vi.fn()} />);
    expect(screen.queryByTestId('notification-banner')).toBeNull();
  });

  it('does not render when permission is denied', () => {
    render(<NotificationBanner permission="denied" onEnable={vi.fn()} />);
    expect(screen.queryByTestId('notification-banner')).toBeNull();
  });

  it('does not render when unsupported', () => {
    render(<NotificationBanner permission="unsupported" onEnable={vi.fn()} />);
    expect(screen.queryByTestId('notification-banner')).toBeNull();
  });

  it('calls onEnable when Enable button is clicked', async () => {
    const onEnable = vi.fn().mockResolvedValue(undefined);
    render(<NotificationBanner permission="default" onEnable={onEnable} />);

    fireEvent.click(screen.getByTestId('enable-notifications-btn'));

    await waitFor(() => {
      expect(onEnable).toHaveBeenCalledOnce();
    });
  });

  it('dismisses banner when X is clicked', () => {
    render(<NotificationBanner permission="default" onEnable={vi.fn()} />);

    expect(screen.getByTestId('notification-banner')).toBeTruthy();

    fireEvent.click(screen.getByTestId('dismiss-banner-btn'));

    expect(screen.queryByTestId('notification-banner')).toBeNull();
  });

  it('shows Enabling... text while processing', async () => {
    // Create a promise we control to keep the enable in progress
    let resolveEnable: () => void;
    const onEnable = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolveEnable = resolve;
      }),
    );

    render(<NotificationBanner permission="default" onEnable={onEnable} />);

    fireEvent.click(screen.getByTestId('enable-notifications-btn'));

    await waitFor(() => {
      expect(screen.getByText('Enabling...')).toBeTruthy();
    });

    // Resolve and verify it goes back
    resolveEnable!();
    await waitFor(() => {
      expect(screen.getByText('Enable')).toBeTruthy();
    });
  });
});
