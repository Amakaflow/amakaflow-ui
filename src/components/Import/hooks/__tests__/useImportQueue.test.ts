import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useImportQueue } from '../useImportQueue';

// fileToBase64 is async — mock it so tests don't hit real FileReader
vi.mock('../../../../lib/bulk-import-api', () => ({
  fileToBase64: vi.fn(async (file: File) => `base64:${file.name}`),
}));

describe('useImportQueue', () => {
  it('starts with an empty queue', () => {
    const { result } = renderHook(() => useImportQueue());
    expect(result.current.queue).toEqual([]);
  });

  it('addUrls parses newline-separated input into QueueItems', () => {
    const { result } = renderHook(() => useImportQueue());
    act(() => {
      result.current.addUrls('https://youtube.com/a\nhttps://youtube.com/b');
    });
    expect(result.current.queue).toHaveLength(2);
    expect(result.current.queue[0].type).toBe('url');
    expect(result.current.queue[0].raw).toBe('https://youtube.com/a');
  });

  it('addUrls parses comma-separated input', () => {
    const { result } = renderHook(() => useImportQueue());
    act(() => {
      result.current.addUrls('https://a.com,https://b.com');
    });
    expect(result.current.queue).toHaveLength(2);
    expect(result.current.queue[0].type).toBe('url');
    expect(result.current.queue[0].raw).toBe('https://a.com');
    expect(result.current.queue[1].type).toBe('url');
    expect(result.current.queue[1].raw).toBe('https://b.com');
  });

  it('addUrls ignores blank lines', () => {
    const { result } = renderHook(() => useImportQueue());
    act(() => {
      result.current.addUrls('https://a.com\n\nhttps://b.com\n');
    });
    expect(result.current.queue).toHaveLength(2);
  });

  it('addFiles assigns image type for image MIME types', () => {
    const { result } = renderHook(() => useImportQueue());
    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    act(() => {
      result.current.addFiles([file]);
    });
    expect(result.current.queue[0].type).toBe('image');
    expect(result.current.queue[0].raw).toBe(file);
  });

  it('addFiles assigns pdf type for application/pdf', () => {
    const { result } = renderHook(() => useImportQueue());
    const file = new File([''], 'doc.pdf', { type: 'application/pdf' });
    act(() => {
      result.current.addFiles([file]);
    });
    expect(result.current.queue[0].type).toBe('pdf');
  });

  it('removeItem removes by id', () => {
    const { result } = renderHook(() => useImportQueue());
    act(() => {
      result.current.addUrls('https://a.com');
    });
    const id = result.current.queue[0].id;
    act(() => {
      result.current.removeItem(id);
    });
    expect(result.current.queue).toHaveLength(0);
  });

  it('clearQueue empties the queue', () => {
    const { result } = renderHook(() => useImportQueue());
    act(() => {
      result.current.addUrls('https://a.com\nhttps://b.com');
    });
    act(() => {
      result.current.clearQueue();
    });
    expect(result.current.queue).toHaveLength(0);
  });

  it('addFiles skips unsupported file types', () => {
    const { result } = renderHook(() => useImportQueue());
    const docxFile = new File(['content'], 'doc.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    act(() => {
      result.current.addFiles([docxFile]);
    });
    expect(result.current.queue).toHaveLength(0);
  });

  it('removeItem with unknown id is a no-op', () => {
    const { result } = renderHook(() => useImportQueue());
    act(() => { result.current.addUrls('https://example.com'); });
    act(() => { result.current.removeItem('does-not-exist'); });
    expect(result.current.queue).toHaveLength(1);
  });

  it('toDetectPayload returns urls and base64 items', async () => {
    const { result } = renderHook(() => useImportQueue());
    const imageFile = new File([''], 'img.jpg', { type: 'image/jpeg' });
    act(() => {
      result.current.addUrls('https://a.com');
      result.current.addFiles([imageFile]);
    });
    let payload!: Awaited<ReturnType<typeof result.current.toDetectPayload>>;
    await act(async () => {
      payload = await result.current.toDetectPayload();
    });
    expect(payload.urls).toEqual(['https://a.com']);
    expect(payload.base64Items).toHaveLength(1);
    expect(payload.base64Items[0].type).toBe('image');
    expect(payload.base64Items[0].base64).toBe('base64:img.jpg');
  });
});
