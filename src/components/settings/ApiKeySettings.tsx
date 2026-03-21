/**
 * ApiKeySettings component (AMA-1135)
 *
 * Settings section for BYOK (Bring Your Own Key). Lets power users
 * connect their own Anthropic or OpenAI API key for unlimited AI usage.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';
import { Loader2, Key, CheckCircle2, AlertTriangle, Trash2, Zap } from 'lucide-react';
import { useApiKey, AiProvider } from '../../hooks/useApiKey';
import { toast } from 'sonner';

const PROVIDER_OPTIONS: { value: AiProvider; label: string; placeholder: string }[] = [
  {
    value: 'anthropic',
    label: 'Anthropic (Claude)',
    placeholder: 'sk-ant-api03-...',
  },
  {
    value: 'openai',
    label: 'OpenAI (GPT)',
    placeholder: 'sk-...',
  },
];

export function ApiKeySettings() {
  const { status, isLoading, isSaving, error, saveKey, removeKey } = useApiKey();
  const [provider, setProvider] = useState<AiProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  const selectedProvider = PROVIDER_OPTIONS.find((p) => p.value === provider);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }
    if (apiKey.trim().length < 10) {
      toast.error('API key seems too short');
      return;
    }

    const success = await saveKey(provider, apiKey.trim());
    if (success) {
      toast.success(`${selectedProvider?.label} key validated and saved`);
      setApiKey('');
    } else {
      toast.error(error || 'Failed to save API key');
    }
  };

  const handleRemove = async () => {
    const success = await removeKey();
    if (success) {
      toast.success('API key removed');
      setShowRemoveDialog(false);
    } else {
      toast.error('Failed to remove API key');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading API key settings...</span>
        </CardContent>
      </Card>
    );
  }

  const hasActiveKey = status?.has_key && status?.is_valid;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Connect Your Own AI Key</CardTitle>
          </div>
          {hasActiveKey && (
            <Badge variant="default" className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Active
            </Badge>
          )}
        </div>
        <CardDescription>
          Bring your own API key for unlimited AI coaching with no rate limits.
          Your key is encrypted and stored securely.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current status */}
        {hasActiveKey && status && (
          <Alert className="bg-green-500/10 border-green-500/30">
            <Zap className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm">
              <strong>Active</strong> — using your{' '}
              <span className="capitalize">{status.provider}</span> key.
              No rate limits applied.
            </AlertDescription>
          </Alert>
        )}

        {status?.has_key && !status?.is_valid && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Your stored key is invalid or expired. Please update it below
              or remove it to use the platform key.
            </AlertDescription>
          </Alert>
        )}

        {!status?.has_key && (
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <Key className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm">
              Not set — using platform key with standard rate limits.
            </AlertDescription>
          </Alert>
        )}

        {/* Error display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {/* Key input form */}
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-provider">Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as AiProvider)}>
              <SelectTrigger id="ai-provider" data-testid="provider-select">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="api-key-input">API Key</Label>
            <Input
              id="api-key-input"
              data-testid="api-key-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={selectedProvider?.placeholder || 'Paste your API key'}
              className="font-mono text-sm"
              autoComplete="off"
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              Your key is validated with a minimal test call, then encrypted with Supabase Vault.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || !apiKey.trim()}
              data-testid="save-api-key-btn"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                'Validate & Save'
              )}
            </Button>

            {status?.has_key && (
              <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive" data-testid="remove-api-key-btn">
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove API Key?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your stored API key will be permanently deleted. You will revert
                      to the platform key with standard rate limits.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleRemove}
                      className="!bg-destructive !text-destructive-foreground"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Removing...
                        </>
                      ) : (
                        'Remove Key'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
