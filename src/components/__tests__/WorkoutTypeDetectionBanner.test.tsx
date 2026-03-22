import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkoutTypeDetectionBanner } from '../WorkoutTypeDetectionBanner';

const mockDetection = {
  detectedType: 'strength' as const,
  confidence: 0.85,
  reason: '5 strength-related keywords',
};

describe('WorkoutTypeDetectionBanner', () => {
  it('renders the detection message', () => {
    render(
      <WorkoutTypeDetectionBanner
        detection={mockDetection}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByTestId('detection-message')).toHaveTextContent(
      'This looks like a Strength workout. Is that right?'
    );
  });

  it('shows confidence percentage', () => {
    render(
      <WorkoutTypeDetectionBanner
        detection={mockDetection}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByText('85% confidence')).toBeInTheDocument();
  });

  it('calls onConfirm with detected type when Confirm is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <WorkoutTypeDetectionBanner
        detection={mockDetection}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('confirm-detection'));
    expect(onConfirm).toHaveBeenCalledWith('strength');
  });

  it('calls onDismiss when dismiss is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <WorkoutTypeDetectionBanner
        detection={mockDetection}
        onConfirm={vi.fn()}
        onDismiss={onDismiss}
      />
    );
    fireEvent.click(screen.getByTestId('dismiss-detection'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
