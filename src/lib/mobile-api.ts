/**
 * Mobile Pairing API (AMA-61)
 *
 * Client functions for iOS Companion App authentication via QR/short code pairing.
 */

// API base URL - defaults to localhost:8001 (mapper-api)
const MAPPER_API_BASE_URL =
  import.meta.env.VITE_MAPPER_API_URL || 'http://localhost:8001';

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

/**
 * Generate a new pairing token for iOS Companion App authentication.
 *
 * Returns a secure token (for QR code) and human-readable short code (for manual entry).
 * Both expire after 5 minutes.
 *
 * @param userId - The authenticated Clerk user ID
 */
export async function generatePairingToken(
  userId: string
): Promise<GeneratePairingResponse> {
  const response = await fetch(`${MAPPER_API_BASE_URL}/mobile/pairing/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to generate pairing token: ${response.status}`);
  }

  return response.json();
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
  const response = await fetch(
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
 * @param userId - The authenticated Clerk user ID
 */
export async function revokePairingTokens(
  userId: string
): Promise<{ success: boolean; revokedCount: number }> {
  const response = await fetch(`${MAPPER_API_BASE_URL}/mobile/pairing/revoke`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
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