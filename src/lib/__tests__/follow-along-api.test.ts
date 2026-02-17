import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteFollowAlong } from '../follow-along-api';

// Mock the authenticated-fetch module
vi.mock('../authenticated-fetch', () => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock('../config', () => ({
  API_URLS: {
    MAPPER: 'https://api.example.com',
  },
}));

import { authenticatedFetch } from '../authenticated-fetch';

describe('follow-along-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deleteFollowAlong', () => {
    const mockResponse = {
      success: true,
      message: 'Workout deleted successfully',
    };

    it('should delete a follow-along workout successfully', async () => {
      // Arrange
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });
      (authenticatedFetch as ReturnType<typeof vi.fn>).mockImplementation(mockFetch);

      const workoutId = 'workout-123';

      // Act
      const result = await deleteFollowAlong(workoutId);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Workout deleted successfully',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/follow-along/workout-123',
        { method: 'DELETE' }
      );
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      const errorResponse = {
        success: false,
        message: 'Workout not found',
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue(errorResponse),
      });
      (authenticatedFetch as ReturnType<typeof vi.fn>).mockImplementation(mockFetch);

      const workoutId = 'nonexistent-workout';

      // Act
      const result = await deleteFollowAlong(workoutId);

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'Workout not found',
      });
    });

    it('should handle network errors gracefully', async () => {
      // Arrange
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockRejectedValue(new Error('Network error')),
      });
      (authenticatedFetch as ReturnType<typeof vi.fn>).mockImplementation(mockFetch);

      const workoutId = 'workout-123';

      // Act
      const result = await deleteFollowAlong(workoutId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });

    it('should use the correct API endpoint format', async () => {
      // Arrange
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });
      (authenticatedFetch as ReturnType<typeof vi.fn>).mockImplementation(mockFetch);

      const workoutId = 'test-id-456';

      // Act
      await deleteFollowAlong(workoutId);

      // Assert
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/follow-along/');
      expect(calledUrl).toContain('/test-id-456');
      expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
    });

    it('should pass userId parameter but not include it in the request (deprecated parameter)', async () => {
      // Arrange
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });
      (authenticatedFetch as ReturnType<typeof vi.fn>).mockImplementation(mockFetch);

      const workoutId = 'workout-123';
      const userId = 'user-456';

      // Act
      const result = await deleteFollowAlong(workoutId, userId);

      // Assert
      expect(result.success).toBe(true);
      // The userId parameter is deprecated - user is identified via JWT
      // So we just verify the function accepts the parameter
    });
  });
});
