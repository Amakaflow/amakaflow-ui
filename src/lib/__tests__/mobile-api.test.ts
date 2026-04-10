import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../authenticated-fetch', () => ({ authenticatedFetch: vi.fn() }));
vi.mock('../demo-mode', () => ({ isDemoMode: false }));

import { generatePairingToken, checkPairingStatus, getPairedDevices, revokeDevice } from '../mobile-api';
import { authenticatedFetch } from '../authenticated-fetch';

const mockFetch = vi.mocked(authenticatedFetch);

describe('mobile-api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('generatePairingToken returns token data', async () => {
    mockFetch.mockResolvedValue({
      ok: true, json: () => Promise.resolve({ token: 'abc', short_code: '1234', qr_data: 'qr://abc', expires_at: '2026-04-10' }),
    } as any);
    const result = await generatePairingToken();
    expect(result.token).toBe('abc');
    expect(result.shortCode).toBe('1234');
  });

  it('checkPairingStatus returns status', async () => {
    mockFetch.mockResolvedValue({
      ok: true, json: () => Promise.resolve({ paired: true, expired: false, pairedAt: '2026-04-10' }),
    } as any);
    const result = await checkPairingStatus('token-123');
    expect(result.paired).toBe(true);
  });

  it('getPairedDevices returns array', async () => {
    mockFetch.mockResolvedValue({
      ok: true, json: () => Promise.resolve({ devices: [{ id: 'd1', device_info: {}, paired_at: '2026-04-10', created_at: '2026-04-10' }] }),
    } as any);
    const result = await getPairedDevices();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('d1');
  });

  it('revokeDevice sends DELETE', async () => {
    mockFetch.mockResolvedValue({
      ok: true, json: () => Promise.resolve({ success: true, message: 'Revoked' }),
    } as any);
    const result = await revokeDevice('d1');
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/d1'), expect.objectContaining({ method: 'DELETE' }));
  });
});
