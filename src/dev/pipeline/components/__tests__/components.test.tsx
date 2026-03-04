import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { RunHistory } from '../RunHistory';
import { ServiceHealth } from '../ServiceHealth';
import { StepCard } from '../StepCard';
import { StepDetail } from '../StepDetail';
import { StepEditForm } from '../StepEditForm';
import type { PipelineStep } from '../../store/runTypes';

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

// Helper
function makeStep(overrides: Partial<PipelineStep> = {}): PipelineStep {
  return {
    id: 'step-1',
    service: 'ingestor',
    label: 'Ingest',
    status: 'success',
    edited: false,
    ...overrides,
  };
}

describe('StepCard', () => {
  it('renders step label and service', () => {
    render(<StepCard step={makeStep()} isSelected={false} onClick={vi.fn()} />);
    expect(screen.getByText('Ingest')).toBeTruthy();
    expect(screen.getByText('ingestor')).toBeTruthy();
    expect(screen.getByText('✓')).toBeTruthy();
  });

  it('shows "edited" badge when step is edited', () => {
    render(<StepCard step={makeStep({ edited: true })} isSelected={false} onClick={vi.fn()} />);
    expect(screen.getByText('edited')).toBeTruthy();
  });

  it('shows schema validation badge', () => {
    render(
      <StepCard
        step={makeStep({ schemaValidation: { passed: false, errors: [{ path: 'title', message: 'Required' }] } })}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText(/schema ✗/)).toBeTruthy();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<StepCard step={makeStep()} isSelected={false} onClick={onClick} />);
    screen.getByText('Ingest').closest('button')?.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows error text for failed steps', () => {
    render(
      <StepCard
        step={makeStep({ status: 'failed', error: 'Connection refused' })}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Connection refused')).toBeTruthy();
  });
});

describe('StepDetail', () => {
  it('renders empty state when no step', () => {
    render(<StepDetail step={null} />);
    expect(screen.getByText(/select a step/i)).toBeTruthy();
  });

  it('shows step header info', () => {
    render(<StepDetail step={makeStep()} />);
    expect(screen.getByText('Ingest')).toBeTruthy();
    expect(screen.getByText('ingestor')).toBeTruthy();
  });

  it('shows response status code', () => {
    render(<StepDetail step={makeStep({ response: { status: 200, body: { title: 'Test' } } })} />);
    expect(screen.getByText('200')).toBeTruthy();
  });

  it('shows schema errors when schema tab active', async () => {
    const step = makeStep({
      schemaValidation: { passed: false, errors: [{ path: 'title', message: 'Required' }] },
    });
    const { getByText } = render(<StepDetail step={step} />);
    getByText('schema').click(); // click the Schema tab
    await waitFor(() => {
      expect(screen.getByText('title')).toBeTruthy();
      expect(screen.getByText('Required')).toBeTruthy();
    });
  });

  it('audit tab shows effective output when edited', async () => {
    const step = makeStep({
      edited: true,
      apiOutput: { raw: true },
      effectiveOutput: { edited: true },
    });
    const { getByText } = render(<StepDetail step={step} />);
    getByText('audit').click();
    await waitFor(() => {
      expect(screen.getByText(/"raw": true/)).toBeTruthy();
      expect(screen.getByText(/"edited": true/)).toBeTruthy();
    });
  });

  it('audit tab shows "not edited" message when unedited', async () => {
    const { getByText } = render(<StepDetail step={makeStep()} />);
    getByText('audit').click();
    await waitFor(() => {
      expect(screen.getByText(/not edited/i)).toBeTruthy();
    });
  });
});

describe('StepEditForm', () => {
  const step = makeStep({ apiOutput: { title: 'Test workout', blocks: [] } });

  it('renders the API output as JSON in the textarea', () => {
    render(<StepEditForm step={step} onContinue={vi.fn()} onAbort={vi.fn()} />);
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toContain('"title": "Test workout"');
  });

  it('calls onContinue with parsed JSON when Continue is clicked', async () => {
    const onContinue = vi.fn();
    render(<StepEditForm step={step} onContinue={onContinue} onAbort={vi.fn()} />);
    screen.getByText('Continue →').click();
    await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
    expect(onContinue).toHaveBeenCalledWith({ title: 'Test workout', blocks: [] });
  });

  it('shows parse error when JSON is invalid', async () => {
    render(<StepEditForm step={step} onContinue={vi.fn()} onAbort={vi.fn()} />);
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'invalid json {' } });
    screen.getByText('Continue →').click();
    await waitFor(() => {
      expect(document.querySelector('.text-red-600') ?? document.querySelector('[class*="red"]')).not.toBeNull();
    });
  });

  it('calls onAbort when Abort is clicked', () => {
    const onAbort = vi.fn();
    render(<StepEditForm step={step} onContinue={vi.fn()} onAbort={onAbort} />);
    screen.getByText('Abort').click();
    expect(onAbort).toHaveBeenCalledOnce();
  });

  it('shows "modified" badge when JSON is edited', async () => {
    render(<StepEditForm step={step} onContinue={vi.fn()} onAbort={vi.fn()} />);
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{"title": "Modified"}' } });
    await waitFor(() => expect(screen.getByText('modified')).toBeTruthy());
  });

  it('does not call onContinue when JSON is invalid', () => {
    const onContinue = vi.fn();
    render(<StepEditForm step={step} onContinue={onContinue} onAbort={vi.fn()} />);
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'invalid json {' } });
    screen.getByText('Continue →').click();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('falls back to response.body when apiOutput is undefined', () => {
    const stepWithResponse = makeStep({
      apiOutput: undefined,
      response: { status: 200, body: { fallback: true } },
    });
    render(<StepEditForm step={stepWithResponse} onContinue={vi.fn()} onAbort={vi.fn()} />);
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toContain('"fallback": true');
  });
});
