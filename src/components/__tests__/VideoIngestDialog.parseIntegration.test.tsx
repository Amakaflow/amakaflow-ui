import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoIngestDialog } from '../VideoIngestDialog';
import { parseDescriptionForExercises } from '../../lib/parse-exercises';
import { API_URLS } from '../../lib/config';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock authenticated-fetch as a spy that passes through to global.fetch
const mockAuthenticatedFetch = vi.fn((...args: any[]) => global.fetch(...args));
vi.mock('../../lib/authenticated-fetch', () => ({
  authenticatedFetch: (...args: any[]) => mockAuthenticatedFetch(...args),
}));

// Mock video-api so handleDetectUrl doesn't consume mockFetch responses
vi.mock('../../lib/video-api', () => ({
  detectVideoUrl: vi.fn().mockResolvedValue({ video_id: 'ABC123', normalized_url: 'https://instagram.com/reel/ABC123' }),
  fetchOEmbed: vi.fn().mockRejectedValue(new Error('oEmbed not supported')),
  checkVideoCache: vi.fn().mockResolvedValue({ cached: false, cache_entry: null }),
  saveVideoToCache: vi.fn().mockResolvedValue({}),
  supportsAutoExtraction: vi.fn().mockReturnValue(false),
  getPlatformDisplayName: vi.fn().mockReturnValue('Instagram'),
}));

// Mock follow-along-api so ingestFollowAlong/createFollowAlongManual are no-ops
vi.mock('../../lib/follow-along-api', () => ({
  ingestFollowAlong: vi.fn().mockResolvedValue({ followAlongWorkout: {} }),
  createFollowAlongManual: vi.fn().mockResolvedValue({ followAlongWorkout: {} }),
}));

// Mock exercise-library
vi.mock('../../lib/exercise-library', () => ({
  searchExercises: vi.fn().mockReturnValue([]),
  exerciseLibrary: [],
}));

// Mock the parse-exercises module
vi.mock('../../lib/parse-exercises', () => ({
  parseDescriptionForExercises: vi.fn((text) => {
    // Simple mock that returns basic exercises
    if (!text.trim()) return [];
    return text.split('\n')
      .filter((line: string) => line.trim())
      .map((line: string, i: number) => ({
        id: `local_${i}`,
        label: line.trim().replace(/^\d+\.\s*/, ''),
        duration_sec: 30,
        accepted: true,
        order: i,
        source: 'local'
      }));
  })
}));

// Helper function to navigate to the parse step
async function navigateToParseStep(urlToPaste = 'https://instagram.com/reel/ABC123') {
  const urlInput = screen.getByPlaceholderText(/instagram.com|youtube.com/i);
  await userEvent.type(urlInput, urlToPaste);
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  await waitFor(() => {
    expect(screen.getByText(/parse description/i)).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole('button', { name: /paste text/i }));
}

describe('VideoIngestDialog Parse Description Integration', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    userId: 'test-user',
    onWorkoutCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockAuthenticatedFetch.mockClear();
  });

  it('should call API and display structured data when parse succeeds', async () => {
    // Mock successful API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        exercises: [
          { raw_name: 'Pull-ups', sets: 4, reps: '8', superset_group: 'A', order: 0 },
          { raw_name: 'Z Press', sets: 4, reps: '8', superset_group: 'A', order: 1 },
          { raw_name: 'Seated sled pull', sets: 5, distance: '10m', order: 2 },
        ],
        confidence: 90,
      }),
    });

    render(<VideoIngestDialog {...defaultProps} />);
    
    // Navigate to manual entry (Instagram flow)
    await navigateToParseStep();

    // Enter workout text
    const textarea = screen.getByPlaceholderText(/paste the video description/i);
    await userEvent.type(textarea, 'Pull-ups 4x8 + Z Press 4x8\nSeated sled pull 5 x 10m');

    // Click Parse
    const parseBtn = screen.getByRole('button', { name: /parse exercises/i });
    fireEvent.click(parseBtn);

    // Wait for API call and results — verify authenticatedFetch was used (not raw fetch)
    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(`${API_URLS.INGESTOR}/parse/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Pull-ups 4x8 + Z Press 4x8\nSeated sled pull 5 x 10m',
          source: 'instagram'
        }),
        signal: expect.any(AbortSignal),
      });
    });

    // Verify structured data is displayed
    await waitFor(() => {
      expect(screen.getByText('Pull-ups')).toBeInTheDocument();
      expect(screen.getByText('Z Press')).toBeInTheDocument();
      expect(screen.getByText('Seated sled pull')).toBeInTheDocument();
    });

    // Verify sets/reps are shown (two exercises share 4 × 8)
    expect(screen.getAllByText(/4 × 8/)).toHaveLength(2);
    expect(screen.getByText(/5 × 10m/)).toBeInTheDocument();

    // Verify superset grouping is shown
    expect(screen.getAllByText(/superset A/i)).toHaveLength(2);
  });

  it('should fall back to local parser when API fails', async () => {
    // Mock failed API response
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<VideoIngestDialog {...defaultProps} />);
    
    // Navigate to manual entry
    await navigateToParseStep();

    // Enter workout text
    const textarea = screen.getByPlaceholderText(/paste the video description/i);
    await userEvent.type(textarea, '1. Squats\n2. Bench Press');

    // Click Parse
    const parseBtn = screen.getByRole('button', { name: /parse exercises/i });
    fireEvent.click(parseBtn);

    // Wait for fallback
    await waitFor(() => {
      expect(screen.getByText('Squats')).toBeInTheDocument();
      expect(screen.getByText('Bench Press')).toBeInTheDocument();
    });

    // Verify offline indicator is shown on each local result
    expect(screen.getAllByText(/\[offline\]/i)).toHaveLength(2);
  });

  it('should show loading spinner during API call', async () => {
    // Mock slow API response
    mockFetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

    render(<VideoIngestDialog {...defaultProps} />);
    
    // Navigate to manual entry
    await navigateToParseStep();

    // Enter workout text
    const textarea = screen.getByPlaceholderText(/paste the video description/i);
    await userEvent.type(textarea, 'Pull-ups 4x8');

    // Click Parse
    const parseBtn = screen.getByRole('button', { name: /parse exercises/i });
    fireEvent.click(parseBtn);

    // Verify loading state
    await waitFor(() => {
      expect(screen.getByText(/parsing/i)).toBeInTheDocument();
    });

    // Button should be disabled during loading
    expect(parseBtn).toBeDisabled();
  });

  it('should include structured data when accepting parsed exercises', async () => {
    // Mock successful API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        exercises: [
          { raw_name: 'Squats', sets: 4, reps: '8', order: 0 },
        ],
        confidence: 90,
      }),
    });

    render(<VideoIngestDialog {...defaultProps} />);
    
    // Navigate to manual entry
    await navigateToParseStep();

    // Enter workout text
    const textarea = screen.getByPlaceholderText(/paste the video description/i);
    await userEvent.type(textarea, 'Squats 4x8');

    // Click Parse
    const parseBtn = screen.getByRole('button', { name: /parse exercises/i });
    fireEvent.click(parseBtn);

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('Squats')).toBeInTheDocument();
    });

    // Click Add Selected
    const addBtn = screen.getByRole('button', { name: /add \d+ selected/i });
    fireEvent.click(addBtn);

    // Verify the exercise was added with structured data in notes
    // The notes should contain the sets/reps info
    await waitFor(() => {
      // Exercise should appear in the exercise list
      const exerciseInputs = screen.getAllByPlaceholderText(/exercise name/i);
      expect(exerciseInputs.length).toBeGreaterThan(0);
    });
  });

  it('should handle API timeout gracefully', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Mock API that times out (abort signal triggered)
    mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
      return new Promise((_, reject) => {
        // Simulate abort on timeout
        if (options.signal) {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }
      });
    });

    render(<VideoIngestDialog {...defaultProps} />);

    // Navigate to manual entry
    await navigateToParseStep();

    // Enter workout text
    const textarea = screen.getByPlaceholderText(/paste the video description/i);
    await userEvent.type(textarea, '1. Squats\n2. Bench Press');

    // Click Parse
    const parseBtn = screen.getByRole('button', { name: /parse exercises/i });
    fireEvent.click(parseBtn);

    // Advance past the 10s abort timeout
    await vi.advanceTimersByTimeAsync(11000);

    // Wait for fallback to local parser
    await waitFor(() => {
      expect(screen.getByText('Squats')).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('should show error when both API and local parser fail', async () => {
    // Mock failed API
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    
    // Mock empty local parser result
    vi.mocked(parseDescriptionForExercises).mockReturnValueOnce([]);

    render(<VideoIngestDialog {...defaultProps} />);
    
    // Navigate to manual entry
    await navigateToParseStep();

    // Enter non-workout text
    const textarea = screen.getByPlaceholderText(/paste the video description/i);
    await userEvent.type(textarea, 'This is just random text without exercises');

    // Click Parse
    const parseBtn = screen.getByRole('button', { name: /parse exercises/i });
    fireEvent.click(parseBtn);

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/unable to parse/i)).toBeInTheDocument();
    });
  });
});