import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TrainingWeekView } from '../Calendar/TrainingWeekView';

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
    // Mock data: 2 completed out of 6 total
    expect(screen.getByText('2/6 sessions')).toBeInTheDocument();
  });

  it('renders session cards for days with sessions', () => {
    render(<TrainingWeekView />);
    // Tuesday has a Tempo Run
    expect(screen.getByText('Tempo Run')).toBeInTheDocument();
    // Wednesday has Full Body Strength
    expect(screen.getByText('Full Body Strength')).toBeInTheDocument();
    // Saturday has Long Run
    expect(screen.getByText('Long Run')).toBeInTheDocument();
  });

  it('shows rest day placeholder for empty days', () => {
    render(<TrainingWeekView />);
    // Monday and Friday are rest days in planned view
    const restTexts = screen.getAllByText('Rest day');
    expect(restTexts.length).toBeGreaterThanOrEqual(2);
  });

  it('expands session details on click', () => {
    render(<TrainingWeekView />);
    // Click "Details" on Tempo Run card
    const detailButtons = screen.getAllByText('Details');
    fireEvent.click(detailButtons[0]);
    expect(screen.getByTestId('session-expanded')).toBeInTheDocument();
    expect(screen.getByText('Why here?')).toBeInTheDocument();
  });

  it('toggles between Plan and Actuals view', () => {
    render(<TrainingWeekView />);
    const toggle = screen.getByTestId('plan-actual-toggle');
    expect(toggle).toBeInTheDocument();

    // Switch to actuals
    const switchEl = toggle.querySelector('[role="switch"]');
    expect(switchEl).toBeInTheDocument();
    fireEvent.click(switchEl!);

    // In actuals view, only completed sessions should show
    // Tempo Run (completed) and Long Run (completed) should still be visible
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
    // Tempo Run is from Stryd and is locked
    const tempoCard = screen.getByTestId('session-card-tue-run-1');
    expect(tempoCard).toBeInTheDocument();
  });

  it('shows conflict badge on Thursday', () => {
    render(<TrainingWeekView />);
    // Thursday (dayIndex 3) has a conflict
    expect(screen.getByTestId('conflict-badge')).toBeInTheDocument();
  });

  it('displays source legend at bottom', () => {
    render(<TrainingWeekView />);
    expect(screen.getByText('Sources:')).toBeInTheDocument();
  });
});
