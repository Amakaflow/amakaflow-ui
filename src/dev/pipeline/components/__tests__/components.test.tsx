import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RunHistory } from '../RunHistory';
import { ServiceHealth } from '../ServiceHealth';

// Mock the hooks
vi.mock('../../hooks/useRunHistory', () => ({
  useRunHistory: vi.fn(() => ({
    runs: [],
    loading: false,
    refresh: vi.fn(),
  })),
}));

vi.mock('../../hooks/useServiceHealth', () => ({
  useServiceHealth: vi.fn(() => ({
    health: {
      ingestor: { status: 'up', latencyMs: 12 },
      mapper: { status: 'down' },
      garmin: { status: 'checking' },
      strava: { status: 'up', latencyMs: 45 },
      calendar: { status: 'up', latencyMs: 8 },
      chat: { status: 'up', latencyMs: 22 },
    },
    refresh: vi.fn(),
  })),
}));

describe('RunHistory', () => {
  it('renders empty state when no runs', () => {
    render(
      <RunHistory selectedRunId={null} onSelectRun={vi.fn()} onNewRun={vi.fn()} />,
    );
    expect(screen.getByText(/no runs yet/i)).toBeTruthy();
  });

  it('renders run list when runs exist', async () => {
    const { useRunHistory } = await import('../../hooks/useRunHistory');
    vi.mocked(useRunHistory).mockReturnValueOnce({
      runs: [
        {
          id: 'r1',
          flowId: 'ingest-only',
          label: 'Test run',
          mode: 'auto',
          status: 'success',
          startedAt: Date.now() - 60_000,
          inputs: {},
          steps: [],
        },
      ],
      loading: false,
      refresh: vi.fn(),
    });
    render(
      <RunHistory selectedRunId={null} onSelectRun={vi.fn()} onNewRun={vi.fn()} />,
    );
    expect(screen.getByText('Test run')).toBeTruthy();
    expect(screen.getByText('✓')).toBeTruthy();
  });
});

describe('ServiceHealth', () => {
  it('renders all 6 service labels', () => {
    render(<ServiceHealth />);
    expect(screen.getByText('Ingestor')).toBeTruthy();
    expect(screen.getByText('Mapper')).toBeTruthy();
    expect(screen.getByText('Garmin')).toBeTruthy();
    expect(screen.getByText('Strava')).toBeTruthy();
    expect(screen.getByText('Calendar')).toBeTruthy();
    expect(screen.getByText('Chat')).toBeTruthy();
  });

  it('renders latency for up services', () => {
    render(<ServiceHealth />);
    expect(screen.getByText('12ms')).toBeTruthy();
  });

  it('calls refresh when Refresh button is clicked', async () => {
    const mockRefresh = vi.fn();
    const { useServiceHealth } = await import('../../hooks/useServiceHealth');
    vi.mocked(useServiceHealth).mockReturnValueOnce({
      health: {
        ingestor: { status: 'up', latencyMs: 12 },
        mapper: { status: 'down' },
        garmin: { status: 'checking' },
        strava: { status: 'up', latencyMs: 45 },
        calendar: { status: 'up', latencyMs: 8 },
        chat: { status: 'up', latencyMs: 22 },
      },
      refresh: mockRefresh,
    });
    const { getByText } = render(<ServiceHealth />);
    getByText('Refresh').click();
    expect(mockRefresh).toHaveBeenCalledOnce();
  });
});
