import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { 
  Activity,
  Mountain,
  TrendingUp,
  Smartphone,
  Watch,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  getLinkedAccounts,
  connectAccount,
  disconnectAccount,
  isAccountExpired,
  getOAuthUrl,
  PLATFORM_INFO,
  LinkedAccountProvider,
  LinkedAccountStatus,
  LinkedAccounts,
} from '../lib/linked-accounts';
import { useClerkUser } from '../lib/clerk-auth';
import { initiateStravaOAuth, getStravaAthlete } from '../lib/strava-api';

type Props = {
  onAccountsChange?: () => void;
};

export function LinkedAccounts({ onAccountsChange }: Props) {
  const { user: clerkUser } = useClerkUser();
  const profileId = clerkUser?.id || '';
  
  const [accounts, setAccounts] = useState<LinkedAccounts>({
    strava: { connected: false },
    relive: { connected: false },
    trainingPeaks: { connected: false },
    appleHealth: { connected: false },
    garmin: { connected: false },
    amazfit: { connected: false },
  });
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<LinkedAccountProvider | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Load linked accounts from Supabase
  useEffect(() => {
    const loadAccounts = async () => {
      if (!profileId) {
        setLoading(false);
        return;
      }
      
      try {
        const linkedAccounts = await getLinkedAccounts(profileId);
        setAccounts(linkedAccounts);
      } catch (error: any) {
        console.error('Failed to load linked accounts:', error);
        toast.error('Failed to load linked accounts');
      } finally {
        setLoading(false);
      }
    };
    
    loadAccounts();
  }, [profileId]);

  // Handle OAuth callback redirect
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const provider = params.get('provider');
      const status = params.get('status');
      const error = params.get('error');

      if (provider === 'strava' && status === 'success' && profileId) {
        try {
          // Get athlete info from strava-sync-api (this verifies tokens are stored)
          const athlete = await getStravaAthlete(profileId);
          
          // Update linked_accounts in Supabase with athlete ID
          await connectAccount(
            profileId,
            'strava',
            athlete.id.toString(),
            athlete.username || `${athlete.firstname || ''} ${athlete.lastname || ''}`.trim() || undefined,
            ['read_activities', 'write_activities']
          );

          // Reload accounts
          const linkedAccounts = await getLinkedAccounts(profileId);
          setAccounts(linkedAccounts);

          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);

          toast.success('Strava account connected successfully!');
          onAccountsChange?.();
        } catch (error: any) {
          console.error('Failed to sync Strava account after OAuth:', error);
          toast.error(`Connected to Strava but failed to sync: ${error.message || 'Unknown error'}`);
        }
      } else if (provider === 'strava' && status === 'error') {
        toast.error(`Failed to connect Strava: ${error || 'Unknown error'}`);
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    handleOAuthCallback();
  }, [profileId, onAccountsChange]);

  const handleConnect = async (provider: LinkedAccountProvider) => {
    if (provider === 'strava') {
      // For Strava, initiate OAuth flow
      if (!profileId) {
        toast.error('Please sign in to connect your Strava account');
        return;
      }

      try {
        setConnecting(true);
        // Initiate OAuth flow - this will return a Strava OAuth URL
        const oauthUrl = await initiateStravaOAuth(profileId);
        // Redirect user to Strava to authorize
        window.location.href = oauthUrl;
      } catch (error: any) {
        console.error('Failed to initiate Strava OAuth:', error);
        toast.error(`Failed to connect Strava: ${error.message || 'Unknown error'}`);
        setConnecting(false);
      }
    } else {
      // For other providers, use OAuth flow (future implementation)
      const oauthUrl = getOAuthUrl(provider);
      console.log('Redirecting to OAuth URL:', oauthUrl);
      toast.info(`${PLATFORM_INFO[provider].name} OAuth flow not yet implemented`);
    }
  };


  const handleManage = (provider: LinkedAccountProvider) => {
    setSelectedProvider(provider);
    setShowManageModal(true);
  };

  const handleDisconnect = async () => {
    if (!selectedProvider || !profileId) return;
    
    try {
      await disconnectAccount(profileId, selectedProvider);
      
      // Reload accounts
      const linkedAccounts = await getLinkedAccounts(profileId);
      setAccounts(linkedAccounts);
      
      setShowManageModal(false);
      toast.success(PLATFORM_INFO[selectedProvider].name + ' disconnected.');
      onAccountsChange?.();
    } catch (error: any) {
      console.error('Failed to disconnect account:', error);
      toast.error(error.message || 'Failed to disconnect account');
    }
  };

  const handleReconnect = (provider: LinkedAccountProvider) => {
    handleConnect(provider);
  };

  const getProviderIcon = (provider: LinkedAccountProvider) => {
    const iconMap = {
      strava: Activity,
      relive: Mountain,
      trainingPeaks: TrendingUp,
      appleHealth: Smartphone,
      garmin: Watch,
      amazfit: Watch,
    };
    
    const Icon = iconMap[provider];
    return <Icon className="w-5 h-5" />;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderAccountCard = (provider: LinkedAccountProvider, status: LinkedAccountStatus) => {
    const info = PLATFORM_INFO[provider];
    // Check if expired based on expiresAt timestamp
    const isExpired = status.connected && status.expiresAt && status.expiresAt < Date.now();
    
    return (
      <Card key={provider} className={!info.available ? 'opacity-60' : ''}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: info.color + '20' }}
              >
                <div style={{ color: info.color }}>
                  {getProviderIcon(provider)}
                </div>
              </div>
              <div>
                <CardTitle className="text-base">{info.name}</CardTitle>
                <CardDescription className="text-sm mt-1">{info.subtitle}</CardDescription>
              </div>
            </div>
            
            {/* Status Badge */}
            {info.available && (
              <div>
                {status.connected && !isExpired && (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                )}
                {status.connected && isExpired && (
                  <Badge variant="destructive">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Expired
                  </Badge>
                )}
                {!status.connected && (
                  <Badge variant="secondary">Not Connected</Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {!info.available && info.unavailableReason && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {info.unavailableReason}
              </AlertDescription>
            </Alert>
          )}
          
          {info.available && (
            <div className="space-y-3">
              {/* Connection Info */}
              {status.connected && !isExpired && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Connected on:</span>
                    <span>{formatDate(status.connectedAt)}</span>
                  </div>
                  {status.lastSyncAt && (
                    <div className="flex items-center justify-between">
                      <span>Last synced:</span>
                      <span>{formatDate(status.lastSyncAt)}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                {!status.connected && (
                  <Button
                    onClick={() => handleConnect(provider)}
                    className="w-full"
                    style={{ backgroundColor: info.color }}
                  >
                    Connect {info.name}
                  </Button>
                )}
                
                {status.connected && isExpired && (
                  <Button
                    onClick={() => handleReconnect(provider)}
                    variant="default"
                    className="w-full"
                  >
                    Reconnect {info.name}
                  </Button>
                )}
                
                {status.connected && !isExpired && (
                  <Button
                    onClick={() => handleManage(provider)}
                    variant="outline"
                    className="w-full"
                  >
                    Manage Connection
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl mb-2">Linked Accounts</h2>
          <p className="text-muted-foreground">
            Manage your connected apps and authorize MyAmaka to enhance your workouts.
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl mb-2">Linked Accounts</h2>
        <p className="text-muted-foreground">
          Manage your connected apps and authorize MyAmaka to enhance your workouts.
        </p>
      </div>

      {/* Accounts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(PLATFORM_INFO) as LinkedAccountProvider[]).map((provider) => 
          renderAccountCard(provider, accounts[provider])
        )}
      </div>

      {/* Manage Connection Modal */}
      {selectedProvider && (
        <Dialog open={showManageModal} onOpenChange={setShowManageModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage {PLATFORM_INFO[selectedProvider].name} Connection</DialogTitle>
              <DialogDescription>
                View connection details and manage authorization
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-medium">Connected and Active</span>
              </div>

              {/* Connection Details */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">Connected on:</span>
                  <span>{formatDate(accounts[selectedProvider].connectedAt)}</span>
                </div>

                {accounts[selectedProvider].lastSyncAt && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-muted-foreground">Last synced:</span>
                    <span>{formatDate(accounts[selectedProvider].lastSyncAt)}</span>
                  </div>
                )}

                {accounts[selectedProvider].expiresAt && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-muted-foreground">Expires on:</span>
                    <span>
                      {new Date(accounts[selectedProvider].expiresAt!).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Permissions */}
              {accounts[selectedProvider].permissions && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">Permissions:</span>
                  <div className="flex flex-wrap gap-2">
                    {accounts[selectedProvider].permissions?.map((permission) => (
                      <Badge key={permission} variant="secondary" className="text-xs">
                        {permission.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Warning */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Disconnecting MyAmaka from {PLATFORM_INFO[selectedProvider].name} will remove all access. You can reconnect anytime.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                className="w-full sm:w-auto"
              >
                Revoke Authorization
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowManageModal(false)}
                className="w-full sm:w-auto"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}