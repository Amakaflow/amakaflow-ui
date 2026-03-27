/**
 * ReasoningPanel — AMA-1153: "Why this workout?" with cited sources.
 *
 * Expandable panel showing Perplexity-style AI reasoning for session placement.
 * - Summary line at top
 * - Categorised citations: Recovery, Load, Performance, Schedule
 * - Each citation: source icon + metric + value + interpretation
 * - Colour-coded confidence: green (strong), amber (moderate), red (concern)
 * - Tappable sources (future: link to raw data)
 */

import { useState } from 'react';
import {
  Brain,
  ChevronDown,
  ChevronUp,
  Activity,
  Zap,
  TrendingUp,
  CalendarDays,
  ExternalLink,
  Info,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SourceCitation {
  source: string;
  metric: string;
  value: string;
  interpretation: string;
  confidence: number;
  raw_data_url?: string | null;
}

export interface ReasoningData {
  session_id: string;
  summary: string;
  citations: SourceCitation[];
  categories: Record<string, SourceCitation[]>;
  decision_factors: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_ICONS: Record<string, { icon: typeof Activity; color: string; label: string }> = {
  garmin: { icon: Activity, color: 'text-green-400', label: 'Garmin' },
  strava: { icon: TrendingUp, color: 'text-orange-400', label: 'Strava' },
  stryd: { icon: Zap, color: 'text-blue-400', label: 'Stryd' },
  calendar: { icon: CalendarDays, color: 'text-purple-400', label: 'Calendar' },
  coach_memory: { icon: Brain, color: 'text-pink-400', label: 'Coach Memory' },
  amakaflow: { icon: Brain, color: 'text-emerald-400', label: 'AmakaFlow' },
};

const CATEGORY_META: Record<string, { icon: typeof Activity; label: string; color: string }> = {
  recovery: { icon: Activity, label: 'Recovery', color: 'text-green-400' },
  load: { icon: TrendingUp, label: 'Training Load', color: 'text-orange-400' },
  performance: { icon: Zap, label: 'Performance', color: 'text-blue-400' },
  schedule: { icon: CalendarDays, label: 'Schedule', color: 'text-purple-400' },
};

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (confidence >= 0.5) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'Strong';
  if (confidence >= 0.5) return 'Moderate';
  return 'Low';
}

// ---------------------------------------------------------------------------
// Citation card
// ---------------------------------------------------------------------------

function CitationCard({ citation }: { citation: SourceCitation }) {
  const sourceInfo = SOURCE_ICONS[citation.source] || SOURCE_ICONS.amakaflow;
  const SourceIcon = sourceInfo.icon;
  const confClass = confidenceColor(citation.confidence);

  return (
    <div
      data-testid={`citation-${citation.source}-${citation.metric}`}
      className="flex items-start gap-2.5 rounded-lg bg-foreground/[0.03] border border-foreground/[0.06] p-2.5 transition-colors hover:bg-foreground/[0.06]"
    >
      {/* Source icon */}
      <div className={`mt-0.5 shrink-0 ${sourceInfo.color}`}>
        <SourceIcon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">
            {sourceInfo.label}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {citation.metric.replace(/_/g, ' ')}
          </span>
          {/* Confidence badge */}
          <span
            className={`inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-medium ${confClass}`}
            data-testid={`confidence-badge-${citation.source}`}
          >
            {confidenceLabel(citation.confidence)} ({Math.round(citation.confidence * 100)}%)
          </span>
        </div>

        {/* Value */}
        <div className="text-sm font-medium text-foreground">{citation.value}</div>

        {/* Interpretation */}
        <div className="text-[11px] text-muted-foreground leading-relaxed">
          {citation.interpretation}
        </div>

        {/* Raw data link */}
        {citation.raw_data_url && (
          <a
            href={citation.raw_data_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
            data-testid={`source-link-${citation.source}`}
          >
            View source <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category section
// ---------------------------------------------------------------------------

function CategorySection({
  categoryKey,
  citations,
}: {
  categoryKey: string;
  citations: SourceCitation[];
}) {
  const meta = CATEGORY_META[categoryKey] || {
    icon: Info,
    label: categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1),
    color: 'text-muted-foreground',
  };
  const CategoryIcon = meta.icon;

  if (citations.length === 0) return null;

  return (
    <div data-testid={`category-${categoryKey}`} className="space-y-2">
      <div className="flex items-center gap-1.5">
        <CategoryIcon className={`h-3.5 w-3.5 ${meta.color}`} />
        <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
        <span className="text-[10px] text-muted-foreground/60">
          ({citations.length} source{citations.length !== 1 ? 's' : ''})
        </span>
      </div>
      <div className="space-y-1.5 pl-5">
        {citations.map((c, i) => (
          <CitationCard key={`${c.source}-${c.metric}-${i}`} citation={c} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ReasoningPanel
// ---------------------------------------------------------------------------

interface ReasoningPanelProps {
  reasoning: ReasoningData;
  /** Start expanded (default: false) */
  defaultExpanded?: boolean;
}

export function ReasoningPanel({ reasoning, defaultExpanded = false }: ReasoningPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const categoryOrder = ['recovery', 'load', 'performance', 'schedule'];
  const sortedCategories = categoryOrder.filter(k => reasoning.categories[k]?.length > 0);

  // Include any extra categories not in the standard order
  for (const key of Object.keys(reasoning.categories)) {
    if (!sortedCategories.includes(key) && reasoning.categories[key].length > 0) {
      sortedCategories.push(key);
    }
  }

  return (
    <div
      data-testid="reasoning-panel"
      className="rounded-lg border border-primary/20 bg-primary/[0.03] overflow-hidden"
    >
      {/* Header / summary — always visible */}
      <button
        data-testid="reasoning-toggle"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-primary/[0.06]"
      >
        <Brain className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-primary uppercase tracking-wider">
            Why this workout?
          </div>
          <div className="text-[12px] text-foreground/80 leading-snug mt-0.5 line-clamp-2">
            {reasoning.summary}
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div data-testid="reasoning-expanded" className="px-3 pb-3 space-y-4 border-t border-primary/10 pt-3">
          {/* Categorised citations */}
          {sortedCategories.map(catKey => (
            <CategorySection
              key={catKey}
              categoryKey={catKey}
              citations={reasoning.categories[catKey]}
            />
          ))}

          {/* Decision factors */}
          {reasoning.decision_factors.length > 0 && (
            <div data-testid="decision-factors" className="space-y-1.5">
              <div className="text-xs font-semibold text-foreground/70">
                Key Decision Factors
              </div>
              <ol className="space-y-1 pl-5 list-decimal list-outside text-[11px] text-muted-foreground">
                {reasoning.decision_factors.map((factor, i) => (
                  <li key={i} className="leading-relaxed">{factor}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Source count footer */}
          <div className="text-[10px] text-muted-foreground/50 text-right">
            {reasoning.citations.length} source{reasoning.citations.length !== 1 ? 's' : ''} cited
          </div>
        </div>
      )}
    </div>
  );
}
