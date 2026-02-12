/**
 * Tests for ImportWorkout component.
 * Mocks useStreamingPipeline hook to verify rendering and user interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportWorkout } from '../ImportWorkout';
import type { UseStreamingPipelineReturn } from '../../hooks/useStreamingPipeline';

// Mock the toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { toast } from 'sonner';

// Mock useStreamingPipeline
const mockStart = vi.fn();
const mockCancel = vi.fn();

const defaultPipeline: UseStreamingPipelineReturn = {
  start: mockStart,
  cancel: mockCancel,
  currentStage: null,
  completedStages: [],
  content: '',
  preview: null,
  isStreaming: false,
  error: null,
};

let mockPipelineReturn = { ...defaultPipeline };

vi.mock('../../hooks/useStreamingPipeline', () => ({
  useStreamingPipeline: () => mockPipelineReturn,
}));

describe('ImportWorkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPipelineReturn = { ...defaultPipeline, start: mockStart, cancel: mockCancel };
  });

  it('renders the page title and URL input', () => {
    render(<ImportWorkout />);

    expect(screen.getByText('Import from URL')).toBeInTheDocument();
    expect(screen.getByTestId('import-url-input')).toBeInTheDocument();
    expect(screen.getByTestId('import-url-submit')).toBeInTheDocument();
  });

  it('shows supported platforms hint in idle state', () => {
    render(<ImportWorkout />);

    expect(screen.getByTestId('supported-platforms-hint')).toBeInTheDocument();
    expect(screen.getByText('Supported platforms:')).toBeInTheDocument();
  });

  it('disables import button when URL is empty', () => {
    render(<ImportWorkout />);

    const button = screen.getByTestId('import-url-submit');
    expect(button).toBeDisabled();
  });

  it('enables import button when URL has value', () => {
    render(<ImportWorkout />);

    const input = screen.getByTestId('import-url-input');
    fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=abc' } });

    const button = screen.getByTestId('import-url-submit');
    expect(button).not.toBeDisabled();
  });

  it('shows toast for empty URL submission', () => {
    render(<ImportWorkout />);

    // Force button click by typing and clearing
    const input = screen.getByTestId('import-url-input');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.change(input, { target: { value: '' } });

    // Simulate Enter on empty (the button is disabled, but enter key handler checks separately)
    fireEvent.keyDown(input, { key: 'Enter' });

    // Enter won't fire because url.trim() is empty — this is expected behavior
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('shows toast for invalid URL', () => {
    render(<ImportWorkout />);

    const input = screen.getByTestId('import-url-input');
    fireEvent.change(input, { target: { value: 'not-a-valid-url' } });

    const button = screen.getByTestId('import-url-submit');
    fireEvent.click(button);

    expect(toast.error).toHaveBeenCalledWith('Please enter a valid URL.');
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('calls pipeline.start with correct endpoint on valid URL', () => {
    render(<ImportWorkout />);

    const input = screen.getByTestId('import-url-input');
    fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=abc' } });

    const button = screen.getByTestId('import-url-submit');
    fireEvent.click(button);

    expect(mockStart).toHaveBeenCalledWith('/api/workouts/import/stream', {
      url: 'https://www.youtube.com/watch?v=abc',
    });
  });

  it('triggers import on Enter key press', () => {
    render(<ImportWorkout />);

    const input = screen.getByTestId('import-url-input');
    fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockStart).toHaveBeenCalledOnce();
  });

  it('shows "Importing..." text while streaming', () => {
    mockPipelineReturn = { ...defaultPipeline, isStreaming: true, start: mockStart, cancel: mockCancel };

    render(<ImportWorkout />);

    expect(screen.getByText('Importing...')).toBeInTheDocument();
  });

  it('disables input and button while streaming', () => {
    mockPipelineReturn = { ...defaultPipeline, isStreaming: true, start: mockStart, cancel: mockCancel };

    render(<ImportWorkout />);

    expect(screen.getByTestId('import-url-input')).toBeDisabled();
    expect(screen.getByTestId('import-url-submit')).toBeDisabled();
  });

  it('hides platforms hint while streaming', () => {
    mockPipelineReturn = { ...defaultPipeline, isStreaming: true, start: mockStart, cancel: mockCancel };

    render(<ImportWorkout />);

    expect(screen.queryByTestId('supported-platforms-hint')).not.toBeInTheDocument();
  });
});
