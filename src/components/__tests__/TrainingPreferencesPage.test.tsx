import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrainingPreferencesPage } from '../TrainingPreferences/TrainingPreferencesPage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('TrainingPreferencesPage', () => {
  const onBack = vi.fn();

  beforeEach(() => {
    onBack.mockClear();
    localStorageMock.clear();
  });

  it('renders the page with all sections', () => {
    render(<TrainingPreferencesPage onBack={onBack} />);

    expect(screen.getByTestId('training-preferences-page')).toBeInTheDocument();
    expect(screen.getByText('Training Preferences')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-volume-section')).toBeInTheDocument();
    expect(screen.getByTestId('hard-days-section')).toBeInTheDocument();
    expect(screen.getByTestId('max-session-section')).toBeInTheDocument();
    expect(screen.getByTestId('run-days-section')).toBeInTheDocument();
    expect(screen.getByTestId('workout-time-section')).toBeInTheDocument();
    expect(screen.getByTestId('goal-race-section')).toBeInTheDocument();
    expect(screen.getByTestId('deload-section')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    render(<TrainingPreferencesPage onBack={onBack} />);
    fireEvent.click(screen.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renders volume preset buttons with default "Moderate" selected', () => {
    render(<TrainingPreferencesPage onBack={onBack} />);
    const moderateBtn = screen.getByTestId('volume-moderate');
    // Default is moderate - check it has the default (primary) variant style
    expect(moderateBtn).toBeInTheDocument();
    expect(screen.getByTestId('volume-range-label')).toHaveTextContent('Moderate (4-6h)');
  });

  it('shows custom slider when Custom volume is selected', () => {
    render(<TrainingPreferencesPage onBack={onBack} />);

    // Click Custom
    fireEvent.click(screen.getByTestId('volume-custom'));
    expect(screen.getByTestId('custom-volume-slider')).toBeInTheDocument();
    expect(screen.getByText('Custom hours')).toBeInTheDocument();
  });

  it('renders hard days selector with 1-4 options', () => {
    render(<TrainingPreferencesPage onBack={onBack} />);
    expect(screen.getByTestId('hard-days-1')).toBeInTheDocument();
    expect(screen.getByTestId('hard-days-2')).toBeInTheDocument();
    expect(screen.getByTestId('hard-days-3')).toBeInTheDocument();
    expect(screen.getByTestId('hard-days-4')).toBeInTheDocument();
  });

  it('toggles hard days selection when clicked', () => {
    render(<TrainingPreferencesPage onBack={onBack} />);
    fireEvent.click(screen.getByTestId('hard-days-3'));
    // After click, the localStorage should be updated
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('renders all 7 day-of-week buttons', () => {
    render(<TrainingPreferencesPage onBack={onBack} />);
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    days.forEach(day => {
      expect(screen.getByTestId(`run-day-${day}`)).toBeInTheDocument();
    });
  });

  it('toggles run day selection', () => {
    render(<TrainingPreferencesPage onBack={onBack} />);

    // Mon is not selected by default (defaults are tue, thu, sat)
    const monBtn = screen.getByTestId('run-day-mon');
    expect(monBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(monBtn);
    expect(monBtn).toHaveAttribute('aria-pressed', 'true');

    // Toggle off
    fireEvent.click(monBtn);
    expect(monBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders workout time options', () => {
    render(<TrainingPreferencesPage onBack={onBack} />);
    expect(screen.getByTestId('workout-time-morning')).toBeInTheDocument();
    expect(screen.getByTestId('workout-time-lunchtime')).toBeInTheDocument();
    expect(screen.getByTestId('workout-time-evening')).toBeInTheDocument();
    expect(screen.getByTestId('workout-time-flexible')).toBeInTheDocument();
  });

  it('renders goal race selector', () => {
    render(<TrainingPreferencesPage onBack={onBack} />);
    expect(screen.getByTestId('goal-race-select')).toBeInTheDocument();
  });

  it('renders deload interval buttons', () => {
    render(<TrainingPreferencesPage onBack={onBack} />);
    expect(screen.getByTestId('deload-3')).toHaveTextContent('Every 3 weeks');
    expect(screen.getByTestId('deload-4')).toHaveTextContent('Every 4 weeks');
    expect(screen.getByTestId('deload-5')).toHaveTextContent('Every 5 weeks');
  });

  it('displays session length in correct format', () => {
    render(<TrainingPreferencesPage onBack={onBack} />);
    // Default is 90 minutes = 1h 30min
    expect(screen.getByTestId('session-length-display')).toHaveTextContent('1h 30min');
  });

  it('shows Reset button when preferences are changed', () => {
    render(<TrainingPreferencesPage onBack={onBack} />);

    // Initially no reset button
    expect(screen.queryByLabelText('Reset to defaults')).not.toBeInTheDocument();

    // Make a change
    fireEvent.click(screen.getByTestId('hard-days-4'));

    // Reset button should appear
    expect(screen.getByLabelText('Reset to defaults')).toBeInTheDocument();
  });

  it('resets preferences when Reset button is clicked', () => {
    render(<TrainingPreferencesPage onBack={onBack} />);

    // Change a preference
    fireEvent.click(screen.getByTestId('hard-days-4'));

    // Click reset
    fireEvent.click(screen.getByLabelText('Reset to defaults'));

    // Should revert to default (2 hard days)
    // Reset button should disappear
    expect(screen.queryByLabelText('Reset to defaults')).not.toBeInTheDocument();
  });

  it('persists preferences to localStorage', () => {
    render(<TrainingPreferencesPage onBack={onBack} />);
    fireEvent.click(screen.getByTestId('hard-days-3'));
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'amakaflow-training-preferences',
      expect.stringContaining('"hardDaysPerWeek":3')
    );
  });
});
