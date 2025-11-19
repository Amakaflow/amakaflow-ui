import { supabase } from './supabase';

export type LinkedAccountProvider = 'strava' | 'relive' | 'trainingPeaks' | 'appleHealth' | 'garmin' | 'amazfit';

export type LinkedAccountStatus = {
  connected: boolean;
  connectedAt?: string;
  lastSyncAt?: string;
  expiresAt?: number;
  permissions?: string[];
  externalId?: string;
  externalUsername?: string;
};

export type LinkedAccounts = {
  [key in LinkedAccountProvider]: LinkedAccountStatus;
};

const LINKED_ACCOUNTS_KEY = 'amakaflow_linked_accounts';

// Get all linked accounts from Supabase
export async function getLinkedAccounts(profileId: string): Promise<LinkedAccounts> {
  const defaultAccounts = getDefaultLinkedAccounts();
  
  if (!profileId) {
    return defaultAccounts;
  }

  try {
    const { data, error } = await supabase
      .from('linked_accounts')
      .select('provider, external_id, external_username, connected_at, last_sync_at, expires_at, permissions')
      .eq('profile_id', profileId);

    if (error) {
      console.error('Failed to load linked accounts from Supabase:', error);
      // Fallback to localStorage if Supabase fails
      return getLinkedAccountsFromLocalStorage();
    }

    if (!data || data.length === 0) {
      return defaultAccounts;
    }

    // Convert Supabase data to LinkedAccounts format
    const accounts: LinkedAccounts = { ...defaultAccounts };
    
    data.forEach((account) => {
      const provider = account.provider as LinkedAccountProvider;
      const isExpired = account.expires_at && account.expires_at < Date.now();
      
      accounts[provider] = {
        connected: !isExpired,
        connectedAt: account.connected_at || undefined,
        lastSyncAt: account.last_sync_at || undefined,
        expiresAt: account.expires_at || undefined,
        permissions: account.permissions || [],
        externalId: account.external_id || undefined,
        externalUsername: account.external_username || undefined,
      };
    });

    return accounts;
  } catch (error) {
    console.error('Error loading linked accounts:', error);
    // Fallback to localStorage
    return getLinkedAccountsFromLocalStorage();
  }
}

// Fallback: Get linked accounts from localStorage (for backward compatibility)
function getLinkedAccountsFromLocalStorage(): LinkedAccounts {
  try {
    const stored = localStorage.getItem(LINKED_ACCOUNTS_KEY);
    if (!stored) {
      return getDefaultLinkedAccounts();
    }
    
    const accounts = JSON.parse(stored);
    return { ...getDefaultLinkedAccounts(), ...accounts };
  } catch (error) {
    console.error('Failed to load linked accounts from localStorage:', error);
    return getDefaultLinkedAccounts();
  }
}

// Default state (all disconnected)
function getDefaultLinkedAccounts(): LinkedAccounts {
  return {
    strava: { connected: false },
    relive: { connected: false },
    trainingPeaks: { connected: false },
    appleHealth: { connected: false },
    garmin: { connected: false },
    amazfit: { connected: false },
  };
}

// Save linked accounts
export function saveLinkedAccounts(accounts: LinkedAccounts): void {
  try {
    localStorage.setItem(LINKED_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error('Failed to save linked accounts:', error);
  }
}

// Connect an account (for Strava, externalId should be the athlete ID)
export async function connectAccount(
  profileId: string,
  provider: LinkedAccountProvider,
  externalId: string,
  externalUsername?: string,
  permissions?: string[]
): Promise<void> {
  if (!profileId) {
    throw new Error('Profile ID is required to connect an account');
  }

  if (!externalId) {
    throw new Error(`External ID is required to connect ${provider} account`);
  }

  try {
    // Calculate expiration (90 days from now for most providers)
    const expiresAt = Date.now() + (90 * 24 * 60 * 60 * 1000);

    // Upsert the linked account in Supabase
    const { error } = await supabase
      .from('linked_accounts')
      .upsert({
        profile_id: profileId,
        provider: provider,
        external_id: externalId,
        external_username: externalUsername || null,
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
        permissions: permissions || ['read_activities', 'write_activities'],
      }, {
        onConflict: 'profile_id,provider',
      });

    if (error) {
      console.error('Failed to connect account in Supabase:', error);
      throw error;
    }

    // Also save to localStorage as backup
    const accounts = getLinkedAccountsFromLocalStorage();
    accounts[provider] = {
      connected: true,
      connectedAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString(),
      expiresAt: expiresAt,
      permissions: permissions || ['read_activities', 'write_activities'],
      externalId: externalId,
      externalUsername: externalUsername,
    };
    saveLinkedAccounts(accounts);
  } catch (error: any) {
    console.error(`Failed to connect ${provider} account:`, error);
    throw error;
  }
}

// Disconnect an account
export async function disconnectAccount(profileId: string, provider: LinkedAccountProvider): Promise<void> {
  if (!profileId) {
    throw new Error('Profile ID is required to disconnect an account');
  }

  try {
    // Delete from Supabase
    const { error } = await supabase
      .from('linked_accounts')
      .delete()
      .eq('profile_id', profileId)
      .eq('provider', provider);

    if (error) {
      console.error('Failed to disconnect account from Supabase:', error);
      throw error;
    }

    // Also remove from localStorage
    const accounts = getLinkedAccountsFromLocalStorage();
    accounts[provider] = { connected: false };
    saveLinkedAccounts(accounts);
  } catch (error: any) {
    console.error(`Failed to disconnect ${provider} account:`, error);
    throw error;
  }
}

// Check if account is connected (async version using Supabase)
export async function isAccountConnected(profileId: string, provider: LinkedAccountProvider): Promise<boolean> {
  if (!profileId) return false;

  try {
    const { data, error } = await supabase
      .from('linked_accounts')
      .select('expires_at')
      .eq('profile_id', profileId)
      .eq('provider', provider)
      .single();

    if (error || !data) {
      // Fallback to localStorage
      const accounts = getLinkedAccountsFromLocalStorage();
      const account = accounts[provider];
      if (account.connected && account.expiresAt && account.expiresAt < Date.now()) {
        return false;
      }
      return account.connected;
    }

    // Check if expired
    if (data.expires_at && data.expires_at < Date.now()) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking account connection:', error);
    // Fallback to localStorage
    const accounts = getLinkedAccountsFromLocalStorage();
    const account = accounts[provider];
    if (account.connected && account.expiresAt && account.expiresAt < Date.now()) {
      return false;
    }
    return account.connected;
  }
}

// Synchronous version for backward compatibility (uses localStorage)
// Returns false by default - should only be used as a fallback when Supabase is unavailable
export function isAccountConnectedSync(provider: LinkedAccountProvider): boolean {
  try {
    const stored = localStorage.getItem(LINKED_ACCOUNTS_KEY);
    if (!stored) {
      // No localStorage data means not connected
      return false;
    }
    
    const accounts = JSON.parse(stored);
    const account = accounts[provider];
    
    // Only return true if account exists and has actual connection data
    // Check if it has connected: true AND some connection metadata
    if (!account || !account.connected) {
      return false;
    }
    
    // Check if expired
    if (account.expiresAt && account.expiresAt < Date.now()) {
      return false;
    }
    
    // Only return true if we have actual connection data (not just default object)
    // Must have either connectedAt, externalId, or expiresAt to be considered a real connection
    if (!account.connectedAt && !account.externalId && !account.expiresAt) {
      return false;
    }
    
    return account.connected;
  } catch (error) {
    console.error('Error checking account connection from localStorage:', error);
    return false;
  }
}

// Check if token is expired
export async function isAccountExpired(profileId: string, provider: LinkedAccountProvider): Promise<boolean> {
  if (!profileId) return false;

  try {
    const { data, error } = await supabase
      .from('linked_accounts')
      .select('expires_at')
      .eq('profile_id', profileId)
      .eq('provider', provider)
      .single();

    if (error || !data) {
      // Fallback to localStorage
      const accounts = getLinkedAccountsFromLocalStorage();
      const account = accounts[provider];
      if (!account.connected) return false;
      return !!(account.expiresAt && account.expiresAt < Date.now());
    }

    return !!(data.expires_at && data.expires_at < Date.now());
  } catch (error) {
    console.error('Error checking account expiration:', error);
    // Fallback to localStorage
    const accounts = getLinkedAccountsFromLocalStorage();
    const account = accounts[provider];
    if (!account.connected) return false;
    return !!(account.expiresAt && account.expiresAt < Date.now());
  }
}

// Simulate OAuth URL generation
export function getOAuthUrl(provider: LinkedAccountProvider): string {
  const baseUrls: Record<LinkedAccountProvider, string> = {
    strava: 'https://www.strava.com/oauth/authorize',
    relive: 'https://www.relive.cc/oauth/authorize',
    trainingPeaks: 'https://oauth.trainingpeaks.com/authorize',
    appleHealth: 'app://health.apple.com/authorize',
    garmin: 'https://connect.garmin.com/oauth/authorize',
    amazfit: 'https://api.amazfit.com/oauth/authorize',
  };
  
  const clientId = 'myamaka_client_id';
  const redirectUri = `${window.location.origin}/oauth/callback/${provider}`;
  const scope = 'activity:read_all,activity:write';
  
  return `${baseUrls[provider]}?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
}

// Platform metadata
export type PlatformInfo = {
  name: string;
  subtitle: string;
  color: string;
  icon: string;
  available: boolean;
  unavailableReason?: string;
};

export const PLATFORM_INFO: Record<LinkedAccountProvider, PlatformInfo> = {
  strava: {
    name: 'Strava',
    subtitle: 'Sync activities and enhance your Strava workouts.',
    color: '#FC4C02',
    icon: 'strava',
    available: true,
  },
  relive: {
    name: 'Relive',
    subtitle: 'Sync routes and add Relive-style enhancements (future).',
    color: '#00D4AA',
    icon: 'relive',
    available: true,
  },
  trainingPeaks: {
    name: 'TrainingPeaks',
    subtitle: 'Sync structured workouts and training plans.',
    color: '#0066CC',
    icon: 'trainingPeaks',
    available: true,
  },
  appleHealth: {
    name: 'Apple Health',
    subtitle: 'Sync health and fitness data from your iPhone.',
    color: '#FF2D55',
    icon: 'appleHealth',
    available: false,
    unavailableReason: 'Available in the MyAmaka iOS App.',
  },
  garmin: {
    name: 'Garmin Connect',
    subtitle: 'Sync workouts and activities from Garmin devices.',
    color: '#007CC3',
    icon: 'garmin',
    available: true,
  },
  amazfit: {
    name: 'Amazfit',
    subtitle: 'Sync workouts from Amazfit wearables.',
    color: '#FF6900',
    icon: 'amazfit',
    available: true,
  },
};