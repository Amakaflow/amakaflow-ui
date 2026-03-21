/**
 * Tests for FatigueAdvisor components (AMA-1114).
 *
 * Tests cover:
 * - FatigueResponse renders all sections
 * - BodyMapSelector fires callbacks on selection
 * - FatigueAdvisorPage renders in different states
 * - useFatigueAdvisor hook demo mode behavior
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FatigueResponse } from '../FatigueAdvisor/FatigueResponse';
import { BodyMapSelector } from '../FatigueAdvisor/BodyMapSelector';
import { FatigueAdvisorPage } from '../FatigueAdvisor/FatigueAdvisorPage';
import type { FatigueAdvice } from '../FatigueAdvisor/hooks/useFatigueAdvisor';

// =============================================================================
// Test Data
// =============================================================================

const MOCK_ADVICE: FatigueAdvice = {
  likely_cause: 'Eccentric overload on the quadriceps during HYROX wall balls',
  immediate_recovery: [
    'Quad stretch 2x30s each leg',
    'Foam roll quads 90s each side',
  ],
  programming_suggestions: [
    'Add tempo squats to build eccentric strength',
    'Include Nordic hamstring curls',
  ],
  related_exercises: [
    'Bulgarian split squat',
    'Step-up with knee drive',
    'Wall sit',
  ],
  rest_recommendation: '48-72h before next heavy lower body session',
};

// =============================================================================
// FatigueResponse Tests
// =============================================================================

describe('FatigueResponse', () => {
  it('renders likely cause section', () => {
    render(<FatigueResponse advice={MOCK_ADVICE} />);
    expect(screen.getByTestId('fatigue-cause')).toBeInTheDocument();
    expect(screen.getByText(/Eccentric overload/)).toBeInTheDocument();
  });

  it('renders immediate recovery section with all items', () => {
    render(<FatigueResponse advice={MOCK_ADVICE} />);
    expect(screen.getByTestId('fatigue-recovery')).toBeInTheDocument();
    expect(screen.getByText(/Quad stretch/)).toBeInTheDocument();
    expect(screen.getByText(/Foam roll/)).toBeInTheDocument();
  });

  it('renders programming suggestions section', () => {
    render(<FatigueResponse advice={MOCK_ADVICE} />);
    expect(screen.getByTestId('fatigue-programming')).toBeInTheDocument();
    expect(screen.getByText(/tempo squats/)).toBeInTheDocument();
  });

  it('renders related exercises as chips', () => {
    render(<FatigueResponse advice={MOCK_ADVICE} />);
    expect(screen.getByTestId('fatigue-exercises')).toBeInTheDocument();
    expect(screen.getByText('Bulgarian split squat')).toBeInTheDocument();
    expect(screen.getByText('Wall sit')).toBeInTheDocument();
  });

  it('renders rest recommendation section', () => {
    render(<FatigueResponse advice={MOCK_ADVICE} />);
    expect(screen.getByTestId('fatigue-rest')).toBeInTheDocument();
    expect(screen.getByText(/48-72h/)).toBeInTheDocument();
  });
});

// =============================================================================
// BodyMapSelector Tests
// =============================================================================

describe('BodyMapSelector', () => {
  it('renders front and back muscle groups', () => {
    render(<BodyMapSelector onSelect={vi.fn()} />);
    expect(screen.getByTestId('body-map-selector')).toBeInTheDocument();
    expect(screen.getByText('Front')).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('renders muscle group buttons', () => {
    render(<BodyMapSelector onSelect={vi.fn()} />);
    expect(screen.getByTestId('muscle-group-quads')).toBeInTheDocument();
    expect(screen.getByTestId('muscle-group-hamstrings')).toBeInTheDocument();
    expect(screen.getByTestId('muscle-group-calves')).toBeInTheDocument();
  });

  it('calls onSelect with question template when clicked', () => {
    const onSelect = vi.fn();
    render(<BodyMapSelector onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId('muscle-group-quads'));

    expect(onSelect).toHaveBeenCalledWith(
      expect.stringContaining('quadriceps'),
    );
  });

  it('highlights selected muscle group', () => {
    render(<BodyMapSelector onSelect={vi.fn()} />);

    fireEvent.click(screen.getByTestId('muscle-group-quads'));

    const button = screen.getByTestId('muscle-group-quads');
    expect(button.className).toContain('violet');
  });
});

// =============================================================================
// FatigueAdvisorPage Tests
// =============================================================================

describe('FatigueAdvisorPage', () => {
  it('renders the page with header', () => {
    render(<FatigueAdvisorPage />);
    expect(screen.getByTestId('fatigue-advisor-page')).toBeInTheDocument();
    expect(screen.getByText('Fatigue Advisor')).toBeInTheDocument();
  });

  it('renders body map in empty state', () => {
    render(<FatigueAdvisorPage showBodyMap={true} />);
    expect(screen.getByTestId('body-map-selector')).toBeInTheDocument();
  });

  it('renders input field and submit button', () => {
    render(<FatigueAdvisorPage />);
    expect(screen.getByTestId('fatigue-input')).toBeInTheDocument();
    expect(screen.getByTestId('fatigue-submit')).toBeInTheDocument();
  });

  it('renders with initial advice (preview mode)', () => {
    render(
      <FatigueAdvisorPage
        initialAdvice={MOCK_ADVICE}
        initialQuestion="My quads hurt"
        showBodyMap={false}
      />,
    );
    expect(screen.getByTestId('fatigue-response')).toBeInTheDocument();
    expect(screen.getByTestId('fatigue-question-display')).toBeInTheDocument();
  });

  it('submit button is disabled when input is empty', () => {
    render(<FatigueAdvisorPage />);
    const button = screen.getByTestId('fatigue-submit');
    expect(button).toBeDisabled();
  });

  it('submit button is enabled when input has text', () => {
    render(<FatigueAdvisorPage />);
    const input = screen.getByTestId('fatigue-input');
    fireEvent.change(input, { target: { value: 'My quads are sore' } });
    const button = screen.getByTestId('fatigue-submit');
    expect(button).not.toBeDisabled();
  });

  it('fills input when body map muscle group is selected', () => {
    render(<FatigueAdvisorPage showBodyMap={true} />);
    fireEvent.click(screen.getByTestId('muscle-group-quads'));
    const input = screen.getByTestId('fatigue-input') as HTMLTextAreaElement;
    expect(input.value).toContain('quadriceps');
  });
});
