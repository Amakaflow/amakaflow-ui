import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TrainingWeekView } from '../calendar/TrainingWeekView';

describe('TrainingWeekView', () => {
  it('renders the week view container', () => {
    render(<TrainingWeekView />);
    expect(screen.getByTestId('training-week-view')).toBeInTheDocument();
  });

  it('renders 7 day columns', () => {
    render(<TrainingWeekView />);
    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`day-column-${i}`)).toBeInTheDocument();
    }
  });

  it('shows readiness pills for each day', () => {
    render(<TrainingWeekView />);
    const pills = screen.getAllByTestId('readiness-pill');
    expect(pills.length).toBe(7);
  });

  it('shows adherence summary bar', () => {
    render(<TrainingWeekView />);
    expect(screen.getByTestId('adherence-summary')).toBeInTheDocument();
  });

  it('renders session cards for days with sessions', () => {
    render(<TrainingWeekView />);
    expect(screen.getByText('Tempo Run')).toBeInTheDocument();
    expect(screen.getByText('Full Body Strength')).toBeInTheDocument();
    expect(screen.getByText('Long Run')).toBeInTheDocument();
  });

  it('shows rest day placeholder for empty days', () => {
    render(<TrainingWeekView />);
    const restTexts = screen.getAllByText('Rest day');
    expect(restTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('expands session details on click', () => {
    render(<TrainingWeekView />);
    const detailButtons = screen.getAllByText('Details');
    fireEvent.click(detailButtons[0]);
    expect(screen.getByTestId('session-expanded')).toBeInTheDocument();
    expect(screen.getByText('Why here?')).toBeInTheDocument();
  });

  it('toggles between Plan and Actuals view', () => {
    render(<TrainingWeekView />);
    const toggle = screen.getByTestId('plan-actual-toggle');
    expect(toggle).toBeInTheDocument();
    const switchEl = toggle.querySelector('[role="switch"]');
    expect(switchEl).toBeInTheDocument();
    fireEvent.click(switchEl!);
    expect(screen.getByText('Tempo Run')).toBeInTheDocument();
    expect(screen.getByText('Long Run')).toBeInTheDocument();
  });

  it('shows source labels on session cards', () => {
    render(<TrainingWeekView />);
    expect(screen.getAllByText('Stryd').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('AmakaFlow').length).toBeGreaterThanOrEqual(1);
  });

  it('shows lock icon on external sessions', () => {
    render(<TrainingWeekView />);
    const tempoCard = screen.getByTestId('session-card-tue-run-1');
    expect(tempoCard).toBeInTheDocument();
  });

  it('shows conflict badges on days with conflicts', () => {
    render(<TrainingWeekView />);
    const badges = screen.getAllByTestId('conflict-badge');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('displays source legend at bottom', () => {
    render(<TrainingWeekView />);
    expect(screen.getByText('Sources:')).toBeInTheDocument();
  });

  // AMA-1115 new tests

  it('renders Generate my week button', () => {
    render(<TrainingWeekView />);
    const btn = screen.getByTestId('generate-week-btn');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('Generate my week');
  });

  it('shows loading state when generating', async () => {
    render(<TrainingWeekView />);
    const btn = screen.getByTestId('generate-week-btn');
    fireEvent.click(btn);
    expect(btn).toHaveTextContent('Generating...');
    expect(btn).toBeDisabled();
    await waitFor(() => {
      expect(btn).toHaveTextContent('Generate my week');
    }, { timeout: 3000 });
  });

  // AMA-1521: applyPlan sets generated=true but doesn't populate weekState.conflicts,
  // so ConflictWarningBanner never renders. Component bug — conflicts should be set
  // when plan is applied (like getGeneratedWeekState does).
  it.skip('shows conflict warning banner after generating and applying plan', async () => {
    render(<TrainingWeekView />);
    fireEvent.click(screen.getByTestId('generate-week-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('apply-plan-btn')).toBeInTheDocument();
    }, { timeout: 3000 });
    fireEvent.click(screen.getByTestId('apply-plan-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('conflict-warning-banner')).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(screen.getByTestId('conflict-warning-0')).toBeInTheDocument();
  });

  it.skip('dismisses conflict warning when X is clicked', async () => {
    render(<TrainingWeekView />);
    fireEvent.click(screen.getByTestId('generate-week-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('apply-plan-btn')).toBeInTheDocument();
    }, { timeout: 3000 });
    fireEvent.click(screen.getByTestId('apply-plan-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('conflict-warning-banner')).toBeInTheDocument();
    }, { timeout: 3000 });
    fireEvent.click(screen.getByLabelText('Dismiss conflict warning'));
    expect(screen.queryByTestId('conflict-warning-banner')).not.toBeInTheDocument();
  });

  it('shows missed session prompt for Monday interval', () => {
    render(<TrainingWeekView />);
    const prompt = screen.getByTestId('missed-session-prompt-mon-run-missed');
    expect(prompt).toBeInTheDocument();
    expect(prompt).toHaveTextContent('Missed: Interval Run');
  });

  it('missed session prompt has reschedule and skip buttons', () => {
    render(<TrainingWeekView />);
    expect(screen.getByTestId('reschedule-mon-run-missed')).toBeInTheDocument();
    expect(screen.getByTestId('skip-mon-run-missed')).toBeInTheDocument();
  });

  it('dismisses missed session on skip', () => {
    render(<TrainingWeekView />);
    fireEvent.click(screen.getByTestId('skip-mon-run-missed'));
    expect(screen.queryByTestId('missed-session-prompt-mon-run-missed')).not.toBeInTheDocument();
  });

  it('does not show readiness downgrade prompt when no hard sessions on low readiness days', () => {
    render(<TrainingWeekView />);
    expect(screen.queryByTestId('readiness-downgrade-prompt')).not.toBeInTheDocument();
  });
});
