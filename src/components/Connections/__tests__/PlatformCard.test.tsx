import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlatformCard } from '../PlatformCard';
import type { PlatformConnection } from '../types';

const baseConnection: PlatformConnection = {
  id: 'stryd',
  name: 'Stryd',
  icon: 'Footprints',
  color: 'orange-500',
  authMethod: 'credentials',
  status: 'disconnected',
};

const handlers = {
  onConnect: vi.fn(),
  onDisconnect: vi.fn(),
  onSyncNow: vi.fn(),
  onRetry: vi.fn(),
};

describe('PlatformCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders platform name', () => {
    render(<PlatformCard connection={baseConnection} {...handlers} />);
    expect(screen.getByText('Stryd')).toBeInTheDocument();
  });

  it('shows Connect button when disconnected', () => {
    render(<PlatformCard connection={baseConnection} {...handlers} />);
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
  });

  it('calls onConnect when Connect is clicked', () => {
    render(<PlatformCard connection={baseConnection} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(handlers.onConnect).toHaveBeenCalledWith('stryd');
  });

  it('shows Connected badge and Sync Now when connected', () => {
    const connected: PlatformConnection = {
      ...baseConnection,
      status: 'connected',
      lastSyncedAt: new Date(),
      username: 'alex@example.com',
    };
    render(<PlatformCard connection={connected} {...handlers} />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText(/Sync Now/)).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
  });

  it('shows last synced time when connected', () => {
    const connected: PlatformConnection = {
      ...baseConnection,
      status: 'connected',
      lastSyncedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
    };
    render(<PlatformCard connection={connected} {...handlers} />);
    expect(screen.getByText(/Last synced: 5 minutes ago/)).toBeInTheDocument();
  });

  it('shows spinning loader when syncing', () => {
    const syncing: PlatformConnection = {
      ...baseConnection,
      status: 'syncing',
      username: 'alex@example.com',
    };
    render(<PlatformCard connection={syncing} {...handlers} />);
    const syncingElements = screen.getAllByText('Syncing...');
    expect(syncingElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error badge and Retry button on error', () => {
    const errored: PlatformConnection = {
      ...baseConnection,
      status: 'error',
      errorMessage: 'Connection timed out',
      lastSyncedAt: new Date(Date.now() - 60 * 1000),
    };
    render(<PlatformCard connection={errored} {...handlers} />);
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Connection timed out')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('calls onRetry when Retry is clicked', () => {
    const errored: PlatformConnection = {
      ...baseConnection,
      status: 'error',
      errorMessage: 'fail',
    };
    render(<PlatformCard connection={errored} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(handlers.onRetry).toHaveBeenCalledWith('stryd');
  });

  it('calls onSyncNow when Sync Now is clicked', () => {
    const connected: PlatformConnection = {
      ...baseConnection,
      status: 'connected',
      lastSyncedAt: new Date(),
    };
    render(<PlatformCard connection={connected} {...handlers} />);
    fireEvent.click(screen.getByText(/Sync Now/));
    expect(handlers.onSyncNow).toHaveBeenCalledWith('stryd');
  });

  it('calls onDisconnect when disconnect button is clicked', () => {
    const connected: PlatformConnection = {
      ...baseConnection,
      status: 'connected',
      lastSyncedAt: new Date(),
    };
    render(<PlatformCard connection={connected} {...handlers} />);
    // The disconnect button has the Unplug icon, no text
    const buttons = screen.getAllByRole('button');
    const disconnectBtn = buttons.find(b => !b.textContent?.includes('Sync'));
    fireEvent.click(disconnectBtn!);
    expect(handlers.onDisconnect).toHaveBeenCalledWith('stryd');
  });
});
