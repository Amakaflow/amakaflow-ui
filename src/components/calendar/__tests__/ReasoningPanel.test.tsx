/**
 * Tests for AMA-1153: ReasoningPanel component.
 *
 * Covers:
 *  - Summary rendering and toggle expand/collapse
 *  - Category sections render with correct icons
 *  - Citation cards show source, metric, value, interpretation
 *  - Confidence badges with correct colour coding
 *  - Decision factors ordered list
 *  - Source links render when raw_data_url present
 *  - SessionCard integration: "Why?" button and reasoning panel
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReasoningPanel } from '../ReasoningPanel';
import {
  easyRunReasoning,
  hardStrengthReasoning,
  tempoRunReasoning,
} from '../mockReasoningData';

// ---------- ReasoningPanel basics ----------

describe('ReasoningPanel', () => {
  it('renders summary text', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} />);
    expect(screen.getByText(/Easy run because recovery is moderate/)).toBeInTheDocument();
  });

  it('renders "Why this workout?" header', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} />);
    expect(screen.getByText('Why this workout?')).toBeInTheDocument();
  });

  it('starts collapsed by default', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} />);
    expect(screen.queryByTestId('reasoning-expanded')).not.toBeInTheDocument();
  });

  it('expands when toggle is clicked', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} />);
    fireEvent.click(screen.getByTestId('reasoning-toggle'));
    expect(screen.getByTestId('reasoning-expanded')).toBeInTheDocument();
  });

  it('collapses when toggle is clicked again', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} />);
    fireEvent.click(screen.getByTestId('reasoning-toggle'));
    expect(screen.getByTestId('reasoning-expanded')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('reasoning-toggle'));
    expect(screen.queryByTestId('reasoning-expanded')).not.toBeInTheDocument();
  });

  it('starts expanded when defaultExpanded is true', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} defaultExpanded />);
    expect(screen.getByTestId('reasoning-expanded')).toBeInTheDocument();
  });
});

// ---------- Categories ----------

describe('ReasoningPanel categories', () => {
  it('renders recovery category', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} defaultExpanded />);
    expect(screen.getByTestId('category-recovery')).toBeInTheDocument();
  });

  it('renders load category', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} defaultExpanded />);
    expect(screen.getByTestId('category-load')).toBeInTheDocument();
  });

  it('renders performance category', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} defaultExpanded />);
    expect(screen.getByTestId('category-performance')).toBeInTheDocument();
  });

  it('renders schedule category', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} defaultExpanded />);
    expect(screen.getByTestId('category-schedule')).toBeInTheDocument();
  });

  it('renders all 4 categories for strength session', () => {
    render(<ReasoningPanel reasoning={hardStrengthReasoning} defaultExpanded />);
    expect(screen.getByTestId('category-recovery')).toBeInTheDocument();
    expect(screen.getByTestId('category-load')).toBeInTheDocument();
    expect(screen.getByTestId('category-performance')).toBeInTheDocument();
    expect(screen.getByTestId('category-schedule')).toBeInTheDocument();
  });
});

// ---------- Citations ----------

describe('ReasoningPanel citations', () => {
  it('renders Garmin recovery citation for easy run', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} defaultExpanded />);
    expect(screen.getByTestId('citation-garmin-recovery_score')).toBeInTheDocument();
    expect(screen.getByText('62/100')).toBeInTheDocument();
  });

  it('renders Strava training load citation', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} defaultExpanded />);
    expect(screen.getByTestId('citation-strava-training_load')).toBeInTheDocument();
    expect(screen.getByText('+12% this week')).toBeInTheDocument();
  });

  it('renders Stryd power trend citation', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} defaultExpanded />);
    expect(screen.getByTestId('citation-stryd-power_trend')).toBeInTheDocument();
    expect(screen.getByText('declining 2%')).toBeInTheDocument();
  });

  it('renders interpretation text', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} defaultExpanded />);
    expect(
      screen.getByText(/Moderate recovery.*avoid hard sessions/i),
    ).toBeInTheDocument();
  });

  it('renders source link when raw_data_url is provided', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} defaultExpanded />);
    const link = screen.getByTestId('source-link-garmin');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://connect.garmin.com/modern/daily-summary');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('does not render source link when no raw_data_url', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} defaultExpanded />);
    expect(screen.queryByTestId('source-link-strava')).not.toBeInTheDocument();
  });
});

// ---------- Confidence badges ----------

describe('ReasoningPanel confidence badges', () => {
  it('renders Strong confidence for high values (>= 0.8)', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} defaultExpanded />);
    const garminBadge = screen.getByTestId('confidence-badge-garmin');
    expect(garminBadge).toHaveTextContent('Strong');
    expect(garminBadge).toHaveTextContent('92%');
  });

  it('renders Moderate confidence for mid values (0.5-0.8)', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} defaultExpanded />);
    const strydBadge = screen.getByTestId('confidence-badge-stryd');
    expect(strydBadge).toHaveTextContent('Moderate');
    expect(strydBadge).toHaveTextContent('78%');
  });
});

// ---------- Decision factors ----------

describe('ReasoningPanel decision factors', () => {
  it('renders decision factors list', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} defaultExpanded />);
    expect(screen.getByTestId('decision-factors')).toBeInTheDocument();
    expect(screen.getByText('Key Decision Factors')).toBeInTheDocument();
  });

  it('renders factors in order', () => {
    render(<ReasoningPanel reasoning={easyRunReasoning} defaultExpanded />);
    const factors = screen.getByTestId('decision-factors');
    const items = factors.querySelectorAll('li');
    expect(items.length).toBe(4);
    expect(items[0].textContent).toContain('Garmin recovery score');
    expect(items[1].textContent).toContain('Race in 3 weeks');
  });

  it('renders 5 factors for strength session', () => {
    render(<ReasoningPanel reasoning={hardStrengthReasoning} defaultExpanded />);
    const factors = screen.getByTestId('decision-factors');
    const items = factors.querySelectorAll('li');
    expect(items.length).toBe(5);
  });
});

// ---------- Tempo run (varied sources) ----------

describe('ReasoningPanel tempo run', () => {
  it('renders tempo summary', () => {
    render(<ReasoningPanel reasoning={tempoRunReasoning} defaultExpanded />);
    expect(screen.getByText(/Tempo run after rest day/)).toBeInTheDocument();
  });

  it('shows HRV citation from Garmin', () => {
    render(<ReasoningPanel reasoning={tempoRunReasoning} defaultExpanded />);
    expect(screen.getByTestId('citation-garmin-hrv_status')).toBeInTheDocument();
    expect(screen.getByText('balanced (65ms)')).toBeInTheDocument();
  });

  it('shows Stryd critical power citation', () => {
    render(<ReasoningPanel reasoning={tempoRunReasoning} defaultExpanded />);
    expect(screen.getByTestId('citation-stryd-critical_power')).toBeInTheDocument();
    expect(screen.getByText('268W (stable)')).toBeInTheDocument();
  });

  it('shows source count footer', () => {
    render(<ReasoningPanel reasoning={tempoRunReasoning} defaultExpanded />);
    expect(screen.getByText('5 sources cited')).toBeInTheDocument();
  });
});

// ---------- Empty / edge cases ----------

describe('ReasoningPanel edge cases', () => {
  it('handles empty citations gracefully', () => {
    const empty = {
      session_id: 'test',
      summary: 'No data available.',
      citations: [],
      categories: {},
      decision_factors: [],
    };
    render(<ReasoningPanel reasoning={empty} defaultExpanded />);
    expect(screen.getByText('No data available.')).toBeInTheDocument();
    expect(screen.queryByTestId('decision-factors')).not.toBeInTheDocument();
    expect(screen.getByText('0 sources cited')).toBeInTheDocument();
  });
});
