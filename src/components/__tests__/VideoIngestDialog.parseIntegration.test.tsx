import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoIngestDialog } from '../VideoIngestDialog';
import { parseDescriptionForExercises } from '../../lib/parse-exercises';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the parse-exercises module
vi.mock('../../lib/parse-exercises', () => ({
  parseDescriptionForExercises: vi.fn((text) => {
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

describe('VideoIngestDialog Parse Description Integration', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    userId: 'test-user',
    onWorkoutCreated: vi.fn(),
  };

  const mockResponse = (data: any) => ({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(),
  } as Response);

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('should call API and display structured data when parse succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ cached: false, cache_entry: null }))
      .mockResolvedValueOnce(mockResponse({
        platform: 'instagram',
        video_id: 'ABC123',
        normalized_url: 'https://instagram.com/reel/ABC123',
        original_url: 'https://instagram.com/reel/ABC123',
        post_type: 'reel'
      }))
      .mockResolvedValueOnce(mockResponse({
        success: true,
        exercises: [
          { raw_name: 'Pull-ups', sets: 4, reps: '8', superset_group: 'A', order: 0 },
          { raw_name: 'Z Press', sets: 4, reps: '8', superset_group: 'A', order: 1 },
        ],
        confidence: 90,
      }));

    render(<VideoIngestDialog {...defaultProps} />);
    
    const urlInput = screen.getByPlaceholderText(/instagram.com|youtube.com/i);
    await userEvent.type(urlInput, 'https://instagram.com/reel/ABC123');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /paste text/i })).toBeInTheDocument();
    }, { timeout: 3000 });
    
    fireEvent.click(screen.getByRole('button', { name: /paste text/i }));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/paste the video description/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/paste the video description/i);
    await userEvent.type(textarea, 'Pull-ups 4x8\nZ Press 4x8');

    fireEvent.click(screen.getByRole('button', { name: /parse exercises/i }));

    await waitFor(() => {
      expect(screen.getByText('Pull-ups')).toBeInTheDocument();
      expect(screen.getByText('Z Press')).toBeInTheDocument();
    });

    expect(screen.getByText(/4 × 8/)).toBeInTheDocument();
    expect(screen.getByText(/superset A/i)).toBeInTheDocument();
  });

  it('should fall back to local parser when API fails', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ cached: false, cache_entry: null }))
      .mockResolvedValueOnce(mockResponse({
        platform: 'instagram',
        video_id: 'ABC123',
        normalized_url: 'https://instagram.com/reel/ABC123',
        original_url: 'https://instagram.com/reel/ABC123',
        post_type: 'reel'
      }))
      .mockRejectedValueOnce(new Error('Network error'));

    render(<VideoIngestDialog {...defaultProps} />);
    
    const urlInput = screen.getByPlaceholderText(/instagram.com|youtube.com/i);
    await userEvent.type(urlInput, 'https://instagram.com/reel/ABC123');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /paste text/i })).toBeInTheDocument();
    }, { timeout: 3000 });
    
    fireEvent.click(screen.getByRole('button', { name: /paste text/i }));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/paste the video description/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/paste the video description/i);
    await userEvent.type(textarea, '1. Squats\n2. Bench Press');

    fireEvent.click(screen.getByRole('button', { name: /parse exercises/i }));

    await waitFor(() => {
      expect(screen.getByText('Squats')).toBeInTheDocument();
      expect(screen.getByText('Bench Press')).toBeInTheDocument();
    });

    // Verify offline indicator is shown
    await waitFor(() => {
      expect(screen.getAllByText(/offline/i).length).toBeGreaterThan(0);
    });
  });

  it('should show loading spinner during API call', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ cached: false, cache_entry: null }))
      .mockResolvedValueOnce(mockResponse({
        platform: 'instagram',
        video_id: 'ABC123',
        normalized_url: 'https://instagram.com/reel/ABC123',
        original_url: 'https://instagram.com/reel/ABC123',
        post_type: 'reel'
      }))
      .mockImplementationOnce(() => new Promise(() => {}));

    render(<VideoIngestDialog {...defaultProps} />);
    
    const urlInput = screen.getByPlaceholderText(/instagram.com|youtube.com/i);
    await userEvent.type(urlInput, 'https://instagram.com/reel/ABC123');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /paste text/i })).toBeInTheDocument();
    }, { timeout: 3000 });
    
    fireEvent.click(screen.getByRole('button', { name: /paste text/i }));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/paste the video description/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/paste the video description/i);
    await userEvent.type(textarea, 'Pull-ups 4x8');

    fireEvent.click(screen.getByRole('button', { name: /parse exercises/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/parsing/i).length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('should include structured data when accepting parsed exercises', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ cached: false, cache_entry: null }))
      .mockResolvedValueOnce(mockResponse({
        platform: 'instagram',
        video_id: 'ABC123',
        normalized_url: 'https://instagram.com/reel/ABC123',
        original_url: 'https://instagram.com/reel/ABC123',
        post_type: 'reel'
      }))
      .mockResolvedValueOnce(mockResponse({
        success: true,
        exercises: [
          { raw_name: 'Squats', sets: 4, reps: '8', order: 0 },
        ],
        confidence: 90,
      }));

    render(<VideoIngestDialog {...defaultProps} />);
    
    const urlInput = screen.getByPlaceholderText(/instagram.com|youtube.com/i);
    await userEvent.type(urlInput, 'https://instagram.com/reel/ABC123');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /paste text/i })).toBeInTheDocument();
    }, { timeout: 3000 });
    
    fireEvent.click(screen.getByRole('button', { name: /paste text/i }));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/paste the video description/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/paste the video description/i);
    await userEvent.type(textarea, 'Squats 4x8');

    fireEvent.click(screen.getByRole('button', { name: /parse exercises/i }));

    // Wait for parsed results to appear (the suggestion list)
    await waitFor(() => {
      expect(screen.getByText('Squats')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Click "Add Selected" button
    const addBtn = screen.getByRole('button', { name: /add \d+ selected/i });
    fireEvent.click(addBtn);

    // Verify it was added to the main exercise list
    await waitFor(() => {
      const inputs = screen.getAllByPlaceholderText(/exercise name/i);
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it('should handle API timeout gracefully', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ cached: false, cache_entry: null }))
      .mockResolvedValueOnce(mockResponse({
        platform: 'instagram',
        video_id: 'ABC123',
        normalized_url: 'https://instagram.com/reel/ABC123',
        original_url: 'https://instagram.com/reel/ABC123',
        post_type: 'reel'
      }))
      .mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new DOMException('Aborted', 'AbortError'));
          }, 100);
        });
      });

    render(<VideoIngestDialog {...defaultProps} />);
    
    const urlInput = screen.getByPlaceholderText(/instagram.com|youtube.com/i);
    await userEvent.type(urlInput, 'https://instagram.com/reel/ABC123');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /paste text/i })).toBeInTheDocument();
    }, { timeout: 3000 });
    
    fireEvent.click(screen.getByRole('button', { name: /paste text/i }));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/paste the video description/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/paste the video description/i);
    await userEvent.type(textarea, '1. Squats\n2. Bench Press');

    fireEvent.click(screen.getByRole('button', { name: /parse exercises/i }));

    await waitFor(() => {
      expect(screen.getByText('Squats')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should show error when both API and local parser fail', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ cached: false, cache_entry: null }))
      .mockResolvedValueOnce(mockResponse({
        platform: 'instagram',
        video_id: 'ABC123',
        normalized_url: 'https://instagram.com/reel/ABC123',
        original_url: 'https://instagram.com/reel/ABC123',
        post_type: 'reel'
      }))
      .mockRejectedValueOnce(new Error('Network error'));
    
    vi.mocked(parseDescriptionForExercises).mockReturnValueOnce([]);

    render(<VideoIngestDialog {...defaultProps} />);
    
    const urlInput = screen.getByPlaceholderText(/instagram.com|youtube.com/i);
    await userEvent.type(urlInput, 'https://instagram.com/reel/ABC123');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /paste text/i })).toBeInTheDocument();
    }, { timeout: 3000 });
    
    fireEvent.click(screen.getByRole('button', { name: /paste text/i }));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/paste the video description/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/paste the video description/i);
    await userEvent.type(textarea, 'This is just random text without exercises');

    fireEvent.click(screen.getByRole('button', { name: /parse exercises/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/unable to parse/i).length).toBeGreaterThan(0);
    });
  });
});
