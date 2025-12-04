/**
 * SmartPlannerDrawer Component
 * Centered modal dialog for AI-powered weekly workout suggestions
 * Now connected to real /planner/smart-plan API
 */

import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  X,
  RefreshCw,
  Lock,
  Sparkles,
  AlertCircle,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Card } from '../ui/card';
import { format } from 'date-fns';

// Types
export interface AnchorWorkout {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: WorkoutBadgeType;
  anchorType: 'hard' | 'soft';
}

export interface SuggestedWorkout {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: WorkoutBadgeType;
  reason: string;
  selected: boolean;
  source?: string;
  block_type?: string;
  primary_muscle?: string;
  intensity?: number;
  duration?: number;
}

export interface RuleWarning {
  date: string;
  rule_id: string;
  name: string;
  reason: string;
}

export type WorkoutBadgeType =
  | 'run'
  | 'strength-lower'
  | 'strength-upper'
  | 'strength'
  | 'hyrox'
  | 'ride'
  | 'core'
  | 'mobility'
  | 'recovery'
  | 'optional';

type DrawerState = 'idle' | 'loading' | 'empty' | 'error' | 'data';

interface SmartPlannerDrawerProps {
  open: boolean;
  onClose: () => void;
  weekStart: Date;
  weekEnd: Date;
  calendarEvents: any[];
  onSaveWorkouts?: (workouts: SuggestedWorkout[]) => void;
  userId: string;
}

// Badge color configuration
const BADGE_COLORS: Record<WorkoutBadgeType, string> = {
  'run': 'bg-blue-100 text-blue-800 border-blue-200',
  'strength': 'bg-purple-100 text-purple-800 border-purple-200',
  'strength-lower': 'bg-amber-100 text-amber-800 border-amber-200',
  'strength-upper': 'bg-violet-100 text-violet-800 border-violet-200',
  'hyrox': 'bg-orange-100 text-orange-800 border-orange-200',
  'ride': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'core': 'bg-slate-100 text-slate-800 border-slate-200',
  'mobility': 'bg-teal-100 text-teal-800 border-teal-200',
  'recovery': 'bg-green-100 text-green-800 border-green-200',
  'optional': 'bg-gray-100 text-gray-800 border-gray-200',
};

const BADGE_LABELS: Record<WorkoutBadgeType, string> = {
  'run': 'Run',
  'strength': 'Strength',
  'strength-lower': 'Strength — Lower',
  'strength-upper': 'Strength — Upper',
  'hyrox': 'HYROX',
  'ride': 'Ride',
  'core': 'Core',
  'mobility': 'Mobility',
  'recovery': 'Recovery',
  'optional': 'Optional',
};

// API base URL
const API_BASE_URL = import.meta.env.VITE_CALENDAR_API_URL || 'http://localhost:8003';

// Format time helper
function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

// Format date helper
function formatDateFull(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return format(date, 'EEE MMM d');
}

// Map block_type to badge type
function mapBlockTypeToBadge(blockType: string, primaryMuscle?: string): WorkoutBadgeType {
  if (blockType === 'strength') {
    if (primaryMuscle === 'lower') return 'strength-lower';
    if (primaryMuscle === 'upper') return 'strength-upper';
    if (primaryMuscle === 'core') return 'core';
    return 'strength';
  }
  if (blockType === 'run') return 'run';
  if (blockType === 'hyrox') return 'hyrox';
  if (blockType === 'recovery') return 'recovery';
  if (blockType === 'mobility') return 'mobility';
  return 'optional';
}

// Generate a title from suggestion data
function generateTitle(suggestion: any): string {
  if (suggestion.title) return suggestion.title;
  
  const blockType = suggestion.block_type || 'workout';
  const muscle = suggestion.primary_muscle;
  const intensity = suggestion.intensity;
  
  let title = blockType.charAt(0).toUpperCase() + blockType.slice(1);
  
  if (muscle && muscle !== 'none') {
    title += ` — ${muscle.charAt(0).toUpperCase() + muscle.slice(1)}`;
  }
  
  if (intensity) {
    const intensityLabel = intensity === 1 ? 'Easy' : intensity === 2 ? 'Moderate' : 'Hard';
    title = `${intensityLabel} ${title}`;
  }
  
  return title;
}

// AnchorItem Component
interface AnchorItemProps {
  anchor: AnchorWorkout;
}

function AnchorItem({ anchor }: AnchorItemProps) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Lock className={`h-4 w-4 mt-1 flex-shrink-0 ${anchor.anchorType === 'hard' ? 'text-red-500' : 'text-amber-500'}`} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="font-medium">{anchor.title}</div>
        <div className="text-sm text-muted-foreground">
          {formatDateFull(anchor.date)}
          {anchor.startTime && ` — ${formatTime(anchor.startTime)}`}
          {anchor.endTime && `–${formatTime(anchor.endTime)}`}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={BADGE_COLORS[anchor.type]}>
            {BADGE_LABELS[anchor.type]}
          </Badge>
          <Badge variant="outline" className={anchor.anchorType === 'hard' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
            {anchor.anchorType === 'hard' ? '🔒 Fixed' : '⚡ Flexible'}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// SuggestionCard Component
interface SuggestionCardProps {
  suggestion: SuggestedWorkout;
  onToggle: (id: string) => void;
}

function SuggestionCard({ suggestion, onToggle }: SuggestionCardProps) {
  return (
    <Card className="p-3 border hover:border-primary/50 transition-colors">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={suggestion.selected}
          onCheckedChange={() => onToggle(suggestion.id)}
          className="mt-1"
        />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="font-medium">{suggestion.title}</div>
          <div className="text-sm text-muted-foreground">
            {formatDateFull(suggestion.date)}
            {suggestion.startTime && ` — ${formatTime(suggestion.startTime)}–${formatTime(suggestion.endTime)}`}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={BADGE_COLORS[suggestion.type]}>
              {BADGE_LABELS[suggestion.type]}
            </Badge>
            {suggestion.source && (
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                {suggestion.source}
              </Badge>
            )}
          </div>
          <p className="text-[13px] leading-[18px] text-[#6B7280]">
            {suggestion.reason}
          </p>
        </div>
      </div>
    </Card>
  );
}

// Warning Card Component
function WarningCard({ warning }: { warning: RuleWarning }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-amber-800">{warning.name}</div>
        <div className="text-xs text-amber-600">{formatDateFull(warning.date)}</div>
        <p className="text-xs text-amber-700 mt-1">{warning.reason}</p>
      </div>
    </div>
  );
}

// Loading State
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="text-center space-y-2">
        <p className="font-medium">Generating your plan…</p>
        <p className="text-sm text-muted-foreground">
          Analyzing your schedule and recovery needs
        </p>
      </div>
      <div className="space-y-3 w-full mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-24 bg-muted rounded-lg"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Empty State
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
        <Sparkles className="h-8 w-8 text-green-600" />
      </div>
      <div className="text-center space-y-2">
        <p className="font-medium">Your week is already balanced</p>
        <p className="text-sm text-muted-foreground">
          Your current schedule looks optimized for recovery and performance.
        </p>
      </div>
    </div>
  );
}

// Error State
function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
        <AlertCircle className="h-8 w-8 text-red-600" />
      </div>
      <div className="text-center space-y-2">
        <p className="font-medium">Could not generate plan</p>
        <p className="text-sm text-muted-foreground">
          {message || 'Something went wrong while analyzing your schedule.'}
        </p>
      </div>
      <Button onClick={onRetry} variant="outline">
        Try Again
      </Button>
    </div>
  );
}

// Main Component
export function SmartPlannerDrawer({
  open,
  onClose,
  weekStart,
  weekEnd,
  calendarEvents,
  onSaveWorkouts,
  userId
}: SmartPlannerDrawerProps) {
  const [state, setState] = useState<DrawerState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [suggestions, setSuggestions] = useState<SuggestedWorkout[]>([]);
  const [anchors, setAnchors] = useState<AnchorWorkout[]>([]);
  const [warnings, setWarnings] = useState<RuleWarning[]>([]);
  const [showDataPreview, setShowDataPreview] = useState(false);

  // Fetch smart plan when drawer opens
  useEffect(() => {
    if (open && userId) {
      fetchSmartPlan();
    }
  }, [open, userId, weekStart]);

  const fetchSmartPlan = async () => {
    setState('loading');
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/planner/smart-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({
          week_start: format(weekStart, 'yyyy-MM-dd'),
          user_goals: ['running', 'strength'],
          include_llm_suggestions: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Process anchors
      const processedAnchors: AnchorWorkout[] = [
        ...data.hard_anchors.map((a: any) => ({
          id: a.id,
          title: a.title,
          date: a.date,
          startTime: a.start_time?.substring(0, 5) || '',
          endTime: a.end_time?.substring(0, 5) || '',
          type: mapBlockTypeToBadge(a.block_type || a.type, a.primary_muscle),
          anchorType: 'hard' as const,
        })),
        ...data.soft_anchors.map((a: any) => ({
          id: a.id,
          title: a.title,
          date: a.date,
          startTime: a.start_time?.substring(0, 5) || '',
          endTime: a.end_time?.substring(0, 5) || '',
          type: mapBlockTypeToBadge(a.block_type || a.type, a.primary_muscle),
          anchorType: 'soft' as const,
        })),
      ].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

      // Process suggestions
      const processedSuggestions: SuggestedWorkout[] = data.suggestions
        .filter((s: any) => s.block_type) // Filter out action-only suggestions
        .map((s: any, index: number) => ({
          id: `suggestion-${index}`,
          title: generateTitle(s),
          date: s.date,
          startTime: s.time_of_day === 'pm' ? '17:00' : '07:00',
          endTime: s.time_of_day === 'pm' ? '18:00' : '08:00',
          type: mapBlockTypeToBadge(s.block_type, s.primary_muscle),
          reason: s.reason,
          selected: false,
          source: s.source,
          block_type: s.block_type,
          primary_muscle: s.primary_muscle,
          intensity: s.intensity,
          duration: s.duration,
        }));

      setAnchors(processedAnchors);
      setSuggestions(processedSuggestions);
      setWarnings(data.warnings || []);

      if (processedSuggestions.length === 0 && processedAnchors.length === 0) {
        setState('empty');
      } else {
        setState('data');
      }

    } catch (error: any) {
      console.error('Smart planner error:', error);
      setErrorMessage(error.message || 'Failed to fetch smart plan');
      setState('error');
    }
  };

  const handleRegenerate = () => {
    fetchSmartPlan();
  };

  const handleToggleSuggestion = (id: string) => {
    setSuggestions(prev =>
      prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s)
    );
  };

  const handleSaveSelected = () => {
    const selected = suggestions.filter(s => s.selected);

    if (selected.length > 0 && onSaveWorkouts) {
      onSaveWorkouts(selected);
    }

    // Reset selections and close
    setSuggestions(prev => prev.map(s => ({ ...s, selected: false })));
    onClose();
  };

  const selectedCount = suggestions.filter(s => s.selected).length;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div 
        className="bg-background rounded-lg shadow-lg flex flex-col border"
        style={{ 
          position: "fixed", 
          top: "50%", 
          left: "50%", 
          transform: "translate(-50%, -50%)", 
          width: "580px", 
          maxHeight: "80vh", 
          zIndex: 50 
        }}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b space-y-1 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Smart Planner
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Week of {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={state === 'loading'}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${state === 'loading' ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {state === 'loading' ? (
              <LoadingState />
            ) : state === 'empty' ? (
              <EmptyState />
            ) : state === 'error' ? (
              <ErrorState onRetry={handleRegenerate} message={errorMessage} />
            ) : (
              <>
                {/* Warnings Section */}
                {warnings.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Warnings
                    </h3>
                    <div className="space-y-2">
                      {warnings.slice(0, 3).map((warning, idx) => (
                        <WarningCard key={idx} warning={warning} />
                      ))}
                      {warnings.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{warnings.length - 3} more warnings
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Anchors Section */}
                {anchors.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Anchors</h3>
                      <span className="text-sm text-muted-foreground">
                        {anchors.length} workouts
                      </span>
                    </div>
                    <div className="divide-y">
                      {anchors.map((anchor) => (
                        <AnchorItem key={anchor.id} anchor={anchor} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions Section */}
                {suggestions.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Suggested Workouts</h3>
                      <span className="text-sm text-muted-foreground">
                        {selectedCount} selected
                      </span>
                    </div>
                    <div className="space-y-3">
                      {suggestions.map((suggestion) => (
                        <SuggestionCard
                          key={suggestion.id}
                          suggestion={suggestion}
                          onToggle={handleToggleSuggestion}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* No Content */}
                {anchors.length === 0 && suggestions.length === 0 && (
                  <EmptyState />
                )}

                {/* Data Preview Toggle (Debug) */}
                {import.meta.env.DEV && (
                  <div className="pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDataPreview(!showDataPreview)}
                      className="w-full"
                    >
                      {showDataPreview ? 'Hide' : 'Show'} Data Preview
                    </Button>
                    {showDataPreview && (
                      <pre className="mt-3 p-4 bg-muted rounded-lg text-xs overflow-auto max-h-64">
                        {JSON.stringify({ anchors, suggestions, warnings }, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer Actions (Fixed) */}
        {state === 'data' && suggestions.length > 0 && (
          <div className="flex-shrink-0 p-6 pt-4 border-t flex items-center gap-3 bg-background">
            <Button
              variant="ghost"
              onClick={onClose}
              className="flex-1 h-11"
            >
              Discard
            </Button>
            <Button
              onClick={handleSaveSelected}
              disabled={selectedCount === 0}
              className="flex-1 h-11 font-semibold"
            >
              Save Selected ({selectedCount})
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
