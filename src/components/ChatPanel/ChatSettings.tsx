/**
 * ChatSettings — AI coach preference form (AMA-1422).
 *
 * Displayed inside the chat panel settings drawer when the user clicks
 * the gear icon. Loads preferences on mount and saves on "Save" click.
 *
 * Preferences:
 *   Tone            — Casual / Professional / Coach
 *   Focus areas     — multi-select chips
 *   Experience      — Beginner / Intermediate / Advanced
 *   Style           — Brief / Detailed / Conversational
 */

import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import {
  getChatSettings,
  updateChatSettings,
  DEFAULT_CHAT_PREFERENCES,
  type ChatPreferences,
  type ChatTone,
  type ChatFocusArea,
  type ChatExperienceLevel,
  type ChatPreferredStyle,
} from '../../lib/chat-settings-api';

// ---------------------------------------------------------------------------
// Option definitions
// ---------------------------------------------------------------------------

const TONE_OPTIONS: { value: ChatTone; label: string; description: string }[] = [
  { value: 'casual', label: 'Casual', description: 'Friendly and relaxed' },
  { value: 'professional', label: 'Professional', description: 'Formal and structured' },
  { value: 'coach', label: 'Coach', description: 'Motivating and direct' },
];

const FOCUS_OPTIONS: { value: ChatFocusArea; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'running', label: 'Running' },
  { value: 'hyrox', label: 'HYROX' },
  { value: 'general', label: 'General Fitness' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'swimming', label: 'Swimming' },
];

const EXPERIENCE_OPTIONS: { value: ChatExperienceLevel; label: string; description: string }[] = [
  { value: 'beginner', label: 'Beginner', description: 'New to structured training' },
  { value: 'intermediate', label: 'Intermediate', description: '1-3 years of training' },
  { value: 'advanced', label: 'Advanced', description: '3+ years, performance-focused' },
];

const STYLE_OPTIONS: { value: ChatPreferredStyle; label: string; description: string }[] = [
  { value: 'brief', label: 'Brief', description: 'Short, punchy answers' },
  { value: 'detailed', label: 'Detailed', description: 'Comprehensive explanations' },
  { value: 'conversational', label: 'Conversational', description: 'Natural back-and-forth' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface RadioGroupProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; description: string }[];
  onChange: (v: T) => void;
}

function RadioGroup<T extends string>({ label, value, options, onChange }: RadioGroupProps<T>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'flex flex-col items-center justify-center rounded-md border px-2 py-2 text-center transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === opt.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-foreground hover:bg-muted',
            ].join(' ')}
            aria-pressed={value === opt.value}
          >
            <span className="text-xs font-semibold leading-tight">{opt.label}</span>
            <span className="mt-0.5 text-[10px] leading-tight text-muted-foreground line-clamp-1">
              {opt.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ChatSettingsProps {
  onClose?: () => void;
}

export function ChatSettings({ onClose }: ChatSettingsProps) {
  const [prefs, setPrefs] = useState<ChatPreferences>(DEFAULT_CHAT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load on mount
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getChatSettings()
      .then((data) => {
        if (!cancelled) setPrefs(data);
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[ChatSettings] Failed to load preferences:', err);
          // Keep defaults — non-fatal
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleToggleFocus = (area: ChatFocusArea) => {
    setPrefs((prev) => {
      const already = prev.focus_areas.includes(area);
      if (already) {
        // Keep at least one selected
        if (prev.focus_areas.length === 1) return prev;
        return { ...prev, focus_areas: prev.focus_areas.filter((a) => a !== area) };
      }
      return { ...prev, focus_areas: [...prev.focus_areas, area] };
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      const updated = await updateChatSettings(prefs);
      setPrefs(updated);
      setSaved(true);
      toast.success('Chat settings saved');
      setTimeout(() => setSaved(false), 2000);
      onClose?.();
    } catch (err) {
      console.error('[ChatSettings] Save failed:', err);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="chat-settings-form">
      {/* Tone */}
      <RadioGroup
        label="Tone"
        value={prefs.tone}
        options={TONE_OPTIONS}
        onChange={(v) => { setPrefs((p) => ({ ...p, tone: v })); setSaved(false); }}
      />

      {/* Focus areas — multi-select chips */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Focus Areas
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {FOCUS_OPTIONS.map((opt) => {
            const active = prefs.focus_areas.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleToggleFocus(opt.value)}
                className={[
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:bg-muted',
                ].join(' ')}
                aria-pressed={active}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Experience level */}
      <RadioGroup
        label="Experience Level"
        value={prefs.experience_level}
        options={EXPERIENCE_OPTIONS}
        onChange={(v) => { setPrefs((p) => ({ ...p, experience_level: v })); setSaved(false); }}
      />

      {/* Preferred style */}
      <RadioGroup
        label="Response Style"
        value={prefs.preferred_style}
        options={STYLE_OPTIONS}
        onChange={(v) => { setPrefs((p) => ({ ...p, preferred_style: v })); setSaved(false); }}
      />

      {/* Save */}
      <Button
        size="sm"
        className="w-full"
        onClick={handleSave}
        disabled={isSaving}
        data-testid="chat-settings-save-button"
      >
        {isSaving ? (
          <>
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            Saving…
          </>
        ) : saved ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            Saved
          </>
        ) : (
          <>
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save preferences
          </>
        )}
      </Button>
    </div>
  );
}
