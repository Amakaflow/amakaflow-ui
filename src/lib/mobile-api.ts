/**
 * Mobile Pairing API (AMA-61)
 *
 * Client functions for iOS Companion App authentication via QR/short code pairing.
 */

import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';

// Use centralized API config
const MAPPER_API_BASE_URL = API_URLS.MAPPER;

// Types for pairing flow
export interface GeneratePairingResponse {
  token: string;
  shortCode: string;
  qrData: string;
  expiresAt: string;
}

export interface PairingStatusResponse {
  paired: boolean;
  expired: boolean;
  pairedAt: string | null;
}

// Types for paired devices (AMA-184)
export interface PairedDeviceInfo {
  device?: string;
  os?: string;
  app_version?: string;
  device_id?: string;
}

export interface PairedDevice {
  id: string;
  deviceInfo: PairedDeviceInfo;
  pairedAt: string;
  createdAt: string;
}

/**
 * Generate a new pairing token for iOS Companion App authentication.
 *
 * Returns a secure token (for QR code) and human-readable short code (for manual entry).
 * Both expire after 5 minutes.
 *
 * @deprecated userId parameter is no longer used - user is identified via JWT
 */
export async function generatePairingToken(
  _userId?: string
): Promise<GeneratePairingResponse> {
  const response = await authenticatedFetch(`${MAPPER_API_BASE_URL}/mobile/pairing/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to generate pairing token: ${response.status}`);
  }

  // Backend returns snake_case, transform to camelCase for frontend
  const data = await response.json();
  return {
    token: data.token,
    shortCode: data.short_code,
    qrData: data.qr_data,
    expiresAt: data.expires_at,
  };
}

/**
 * Check if a pairing token has been used (web app polling endpoint).
 *
 * The web app polls this endpoint after displaying the QR code to detect
 * when the iOS app has successfully completed pairing.
 *
 * @param token - The pairing token to check
 */
export async function checkPairingStatus(
  token: string
): Promise<PairingStatusResponse> {
  const response = await authenticatedFetch(
    `${MAPPER_API_BASE_URL}/mobile/pairing/status/${encodeURIComponent(token)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to check pairing status: ${response.status}`);
  }

  return response.json();
}

/**
 * Revoke all active pairing tokens for the authenticated user.
 *
 * Call this if the user wants to cancel pairing or generate a fresh token.
 *
 * @deprecated userId parameter is no longer used - user is identified via JWT
 */
export async function revokePairingTokens(
  _userId?: string
): Promise<{ success: boolean; revokedCount: number }> {
  const response = await authenticatedFetch(`${MAPPER_API_BASE_URL}/mobile/pairing/revoke`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to revoke pairing tokens: ${response.status}`);
  }

  const result = await response.json();
  return {
    success: result.success,
    revokedCount: result.revoked_count,
  };
}

// ============================================================================
// Paired Devices Management (AMA-184)
// ============================================================================

/**
 * Get all paired iOS devices for the authenticated user.
 *
 * Returns a list of devices that have successfully completed pairing,
 * including device info (model, OS version) and when they were paired.
 */
export async function getPairedDevices(): Promise<PairedDevice[]> {
  const response = await authenticatedFetch(`${MAPPER_API_BASE_URL}/mobile/pairing/devices`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to get paired devices: ${response.status}`);
  }

  const result = await response.json();

  // Transform snake_case to camelCase
  return (result.devices || []).map((device: any) => ({
    id: device.id,
    deviceInfo: device.device_info || {},
    pairedAt: device.paired_at,
    createdAt: device.created_at,
  }));
}

/**
 * Revoke a specific paired device.
 *
 * This removes the device's pairing, requiring the user to re-pair
 * if they want to use the iOS app on that device again.
 *
 * @param deviceId - The device/token ID to revoke
 */
export async function revokeDevice(deviceId: string): Promise<{ success: boolean; message: string }> {
  const response = await authenticatedFetch(
    `${MAPPER_API_BASE_URL}/mobile/pairing/devices/${encodeURIComponent(deviceId)}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to revoke device: ${response.status}`);
  }

  return response.json();
}