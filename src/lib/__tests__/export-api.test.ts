import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../authenticated-fetch', () => ({ authenticatedFetch: vi.fn() }));

import { downloadBlob } from '../export-api';

describe('export-api', () => {
  describe('downloadBlob', () => {
    it('creates and clicks a download link', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((() => {}) as any);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((() => {}) as any);

      const mockBlob = new Blob(['test'], { type: 'text/csv' });
      const revokeURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const createURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');

      downloadBlob(mockBlob, 'workout.csv');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(createURLSpy).toHaveBeenCalledWith(mockBlob);
      expect(revokeURLSpy).toHaveBeenCalledWith('blob:test');

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      createURLSpy.mockRestore();
      revokeURLSpy.mockRestore();
    });
  });
});
