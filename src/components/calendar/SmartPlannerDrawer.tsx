/**
 * SmartPlannerDrawer Component
 * Centered modal dialog for AI-powered weekly workout suggestions
 */

import { useState } from 'react';
import { Button } from '../ui/button';
import { 
  X, 
  RefreshCw, 
  Lock, 
  Sparkles,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Card } from '../ui/card';
import { format, addDays } from 'date-fns';

// Types
export interface AnchorWorkout {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: WorkoutBadgeType;
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
  source?: string; // e.g. "AmakaFlow History", "Template", "Coach Plan"
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
  | 'optional';

type DrawerState = 'idle' | 'loading' | 'empty' | 'error' | 'data';

interface SmartPlannerDrawerProps {
  open: boolean;
  onClose: () => void;
  weekStart: Date;
  weekEnd: Date;
  calendarEvents: any[]; // CalendarEvent[] from parent
  onSaveWorkouts?: (workouts: SuggestedWorkout[]) => void;
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
  'mobility': 'bg-slate-100 text-slate-800 border-slate-200',
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
  'optional': 'Optional',
};

// Mock data
const MOCK_ANCHORS: AnchorWorkout[] = [
  {
    id: 'anchor-1',
    title: 'Long Run',
    date: '2025-11-23',
    startTime: '06:00',
    endTime: '08:00',
    type: 'run',
  },
  {
    id: 'anchor-2',
    title: 'Easy Run',
    date: '2025-11-25',
    startTime: '06:00',
    endTime: '07:00',
    type: 'run',
  },
  {
    id: 'anchor-3',
    title: 'Tempo Run',
    date: '2025-11-27',
    startTime: '06:00',
    endTime: '07:00',
    type: 'run',
  },
  {
    id: 'anchor-4',
    title: 'Trainer — Heavy Lower Body',
    date: '2025-11-27',
    startTime: '11:00',
    endTime: '12:00',
    type: 'strength-lower',
  },
  {
    id: 'anchor-5',
    title: 'Zwift Recovery Ride',
    date: '2025-11-28',
    startTime: '06:00',
    endTime: '06:45',
    type: 'ride',
  },
  {
    id: 'anchor-6',
    title: 'Trainer — Upper Body',
    date: '2025-11-29',
    startTime: '11:00',
    endTime: '12:00',
    type: 'strength-upper',
  },
];

const MOCK_SUGGESTIONS: SuggestedWorkout[] = [
  {
    id: 'suggestion-1',
    title: 'PM Mobility Recovery',
    date: '2025-11-23',
    startTime: '17:00',
    endTime: '17:20',
    type: 'mobility',
    reason: 'Post–long run mobility to speed up recovery and avoid stiffness.',
    selected: false,
    source: 'AmakaFlow History',
  },
  {
    id: 'suggestion-2',
    title: 'Lower Body Strength — Light Runner-Friendly',
    date: '2025-11-24',
    startTime: '17:00',
    endTime: '18:00',
    type: 'strength-lower',
    reason: 'Light lower day placed 24h after long run.',
    selected: false,
    source: 'AmakaFlow History',
  },
  {
    id: 'suggestion-3',
    title: 'Abs Only — 12 Minutes',
    date: '2025-11-25',
    startTime: '17:00',
    endTime: '17:15',
    type: 'core',
    reason: 'Light day after easy run; avoids loading legs before tempo day.',
    selected: false,
    source: 'AmakaFlow History',
  },
  {
    id: 'suggestion-4',
    title: 'Upper Body Hypertrophy',
    date: '2025-11-26',
    startTime: '17:00',
    endTime: '18:00',
    type: 'strength-upper',
    reason: 'Upper day avoids legs before heavy lower session.',
    selected: false,
    source: 'AmakaFlow History',
  },
  {
    id: 'suggestion-5',
    title: 'Optional PM Abs Circuit (15 min)',
    date: '2025-11-28',
    startTime: '17:00',
    endTime: '17:15',
    type: 'optional',
    reason: 'Pairs well with recovery ride; keeps day low intensity.',
    selected: false,
    source: 'AmakaFlow History',
  },
];

// Format time helper
function formatTime(time: string): string {
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

// AnchorItem Component
interface AnchorItemProps {
  anchor: AnchorWorkout;
}

function AnchorItem({ anchor }: AnchorItemProps) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Lock className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="font-medium">{anchor.title}</div>
        <div className="text-sm text-muted-foreground">
          {formatDateFull(anchor.date)} — {formatTime(anchor.startTime)}–{formatTime(anchor.endTime)}
        </div>
        <Badge 
          variant="outline" 
          className={BADGE_COLORS[anchor.type]}
        >
          {BADGE_LABELS[anchor.type]}
        </Badge>
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
            {formatDateFull(suggestion.date)} — {formatTime(suggestion.startTime)}–{formatTime(suggestion.endTime)}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge 
              variant="outline" 
              className={BADGE_COLORS[suggestion.type]}
            >
              {BADGE_LABELS[suggestion.type]}
            </Badge>
            {suggestion.source && (
              <Badge 
                variant="secondary" 
                className="bg-blue-50 text-blue-700 border-blue-200"
              >
                From: {suggestion.source}
              </Badge>
            )}
          </div>
          <p className="reason-text text-[13px] leading-[18px] text-[#6B7280]">
            {suggestion.reason}
          </p>
        </div>
      </div>
    </Card>
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
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
        <AlertCircle className="h-8 w-8 text-red-600" />
      </div>
      <div className="text-center space-y-2">
        <p className="font-medium">Could not generate plan</p>
        <p className="text-sm text-muted-foreground">
          Something went wrong while analyzing your schedule.
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
  onSaveWorkouts
}: SmartPlannerDrawerProps) {
  const [state, setState] = useState<DrawerState>('idle');
  const [suggestions, setSuggestions] = useState<SuggestedWorkout[]>(MOCK_SUGGESTIONS);
  const [showDataPreview, setShowDataPreview] = useState(false);

  // Derive anchors from real calendar events
  const anchors: AnchorWorkout[] = calendarEvents
    .filter(event => event.is_anchor === true)
    .map(event => {
      // Map calendar event to anchor workout format
      const typeMap: Record<string, WorkoutBadgeType> = {
        'run': 'run',
        'strength': event.primary_muscle === 'lower' ? 'strength-lower' : 
                   event.primary_muscle === 'upper' ? 'strength-upper' : 'strength',
        'recovery': 'ride',
        'mobility': 'mobility',
        'hyrox': 'hyrox'
      };
      
      return {
        id: event.id,
        title: event.title,
        date: event.date,
        startTime: event.start_time?.substring(0, 5) || '00:00', // HH:MM
        endTime: event.end_time?.substring(0, 5) || '00:00',
        type: typeMap[event.type] || 'strength'
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const handleRegenerate = () => {
    setState('loading');
    setTimeout(() => {
      setState('idle');
      setSuggestions(MOCK_SUGGESTIONS.map(s => ({ ...s, selected: false })));
    }, 2000);
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
      <div className="bg-background rounded-lg shadow-lg flex flex-col border" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "580px", maxHeight: "80vh", zIndex: 50 }}>
        {/* Header */}
        <div className="p-6 pb-4 border-b space-y-1 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-semibold">Smart Planner</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Week of {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
              </p>
            </div>
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
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="p-6 space-y-6">
            {state === 'loading' ? (
              <LoadingState />
            ) : state === 'empty' ? (
              <EmptyState />
            ) : state === 'error' ? (
              <ErrorState onRetry={handleRegenerate} />
            ) : (
              <>
                {/* Anchors Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Anchors (Locked)</h3>
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

                {/* Suggestions Section */}
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

                {/* Data Preview Toggle (Debug) */}
                {process.env.NODE_ENV === 'development' && (
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
                        {JSON.stringify(
                          {
                            anchors: anchors,
                            suggestions: suggestions,
                          },
                          null,
                          2
                        )}
                      </pre>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer Actions (Fixed) */}
        {state === 'idle' && (
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