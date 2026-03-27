/**
 * Standalone preview entry point for ApiKeySettings (BYOK).
 * Served at /api-key-preview.html during dev.
 *
 * AMA-1135: Renders the API key settings in various states for screenshots.
 *
 * Modes (via ?mode= query param):
 * - not-set: Default state, no key stored (default)
 * - active: Key is active and valid
 * - invalid: Key is stored but marked invalid
 * - saving: Shows saving/validating spinner
 */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import './index.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
import { Alert, AlertDescription } from './components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';
import { Loader2, Key, CheckCircle2, AlertTriangle, Trash2, Zap } from 'lucide-react';

// =============================================================================
// Static preview (does not call API, renders fixed states)
// =============================================================================

type PreviewMode = 'not-set' | 'active' | 'invalid' | 'saving';

function getMode(): PreviewMode {
  const params = new URLSearchParams(window.location.search);
  return (params.get('mode') as PreviewMode) || 'not-set';
}

function ApiKeySettingsPreview({ mode }: { mode: PreviewMode }) {
  const hasActiveKey = mode === 'active';
  const hasInvalidKey = mode === 'invalid';
  const isSaving = mode === 'saving';
  const hasKey = hasActiveKey || hasInvalidKey;

  return (
    <Card className="max-w-lg">
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
        {/* Active status */}
        {hasActiveKey && (
          <Alert className="bg-green-500/10 border-green-500/30">
            <Zap className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm">
              <strong>Active</strong> — using your Anthropic key. No rate limits applied.
            </AlertDescription>
          </Alert>
        )}

        {/* Invalid key warning */}
        {hasInvalidKey && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Your stored key is invalid or expired. Please update it below
              or remove it to use the platform key.
            </AlertDescription>
          </Alert>
        )}

        {/* Not set info */}
        {!hasKey && (
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <Key className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm">
              Not set — using platform key with standard rate limits.
            </AlertDescription>
          </Alert>
        )}

        {/* Key input form */}
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-provider">Provider</Label>
            <Select defaultValue="anthropic">
              <SelectTrigger id="ai-provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                <SelectItem value="openai">OpenAI (GPT)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="api-key-input">API Key</Label>
            <Input
              id="api-key-input"
              type="password"
              placeholder="sk-ant-api03-..."
              className="font-mono text-sm"
              autoComplete="off"
              disabled={isSaving}
              defaultValue={isSaving ? 'sk-ant-api03-abcdef1234567890' : ''}
            />
            <p className="text-xs text-muted-foreground">
              Your key is validated with a minimal test call, then encrypted with Supabase Vault.
            </p>
          </div>

          <div className="flex gap-2">
            <Button disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                'Validate & Save'
              )}
            </Button>

            {hasKey && (
              <Button variant="outline" className="text-destructive">
                <Trash2 className="w-4 h-4 mr-1" />
                Remove
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// App root: show all states or single mode
// =============================================================================

function App() {
  const mode = getMode();

  if (mode !== 'not-set') {
    return (
      <div className="min-h-screen bg-background p-8 flex items-start justify-center">
        <ApiKeySettingsPreview mode={mode} />
      </div>
    );
  }

  // Show all states stacked for quick visual review
  return (
    <div className="min-h-screen bg-background p-8 space-y-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-4">BYOK API Key Settings (AMA-1135)</h1>

      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Not Set</h2>
      <ApiKeySettingsPreview mode="not-set" />

      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide pt-4">Active Key</h2>
      <ApiKeySettingsPreview mode="active" />

      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide pt-4">Invalid Key</h2>
      <ApiKeySettingsPreview mode="invalid" />

      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide pt-4">Saving</h2>
      <ApiKeySettingsPreview mode="saving" />
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
