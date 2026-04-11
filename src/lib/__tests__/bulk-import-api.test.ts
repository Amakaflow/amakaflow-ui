import { describe, it, expect } from 'vitest';
import {
  isValidUrl,
  isSupportedVideoUrl,
  getSupportedFileExtensions,
  isSupportedFile,
} from '../bulk-import-api';

describe('isValidUrl', () => {
  it('returns true for valid URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://localhost:3000')).toBe(true);
    expect(isValidUrl('https://youtube.com/watch?v=abc')).toBe(true);
  });

  it('returns false for invalid URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('example.com')).toBe(false); // no protocol
  });
});

describe('isSupportedVideoUrl', () => {
  it('supports YouTube URLs', () => {
    expect(isSupportedVideoUrl('https://youtube.com/watch?v=abc')).toBe(true);
    expect(isSupportedVideoUrl('https://youtu.be/abc')).toBe(true);
    expect(isSupportedVideoUrl('https://www.youtube.com/watch?v=xyz')).toBe(true);
  });

  it('supports Instagram URLs', () => {
    expect(isSupportedVideoUrl('https://instagram.com/reel/abc')).toBe(true);
    expect(isSupportedVideoUrl('https://www.instagram.com/p/xyz')).toBe(true);
  });

  it('supports TikTok URLs', () => {
    expect(isSupportedVideoUrl('https://tiktok.com/@user/video/123')).toBe(true);
  });

  it('supports Pinterest URLs', () => {
    expect(isSupportedVideoUrl('https://pinterest.com/pin/123')).toBe(true);
    expect(isSupportedVideoUrl('https://pin.it/abc')).toBe(true);
  });

  it('rejects unsupported domains', () => {
    expect(isSupportedVideoUrl('https://example.com/video')).toBe(false);
    expect(isSupportedVideoUrl('https://vimeo.com/123')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(isSupportedVideoUrl('not-a-url')).toBe(false);
  });
});

describe('getSupportedFileExtensions', () => {
  it('returns expected extensions', () => {
    const exts = getSupportedFileExtensions();
    expect(exts).toContain('.xlsx');
    expect(exts).toContain('.csv');
    expect(exts).toContain('.json');
  });
});

describe('isSupportedFile', () => {
  it('returns true for supported file types', () => {
    expect(isSupportedFile(new File([], 'workout.xlsx'))).toBe(true);
    expect(isSupportedFile(new File([], 'data.csv'))).toBe(true);
    expect(isSupportedFile(new File([], 'program.json'))).toBe(true);
  });

  it('returns false for unsupported file types', () => {
    expect(isSupportedFile(new File([], 'image.png'))).toBe(false);
    expect(isSupportedFile(new File([], 'video.mp4'))).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isSupportedFile(new File([], 'Workout.XLSX'))).toBe(true);
    expect(isSupportedFile(new File([], 'DATA.CSV'))).toBe(true);
  });
});
