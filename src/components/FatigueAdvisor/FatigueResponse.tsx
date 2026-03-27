/**
 * FatigueResponse — displays structured fatigue advice in formatted sections.
 *
 * AMA-1114: Shows cause, recovery, programming suggestions, related exercises,
 * and rest recommendation in a clean card layout.
 */

import type { FatigueAdvice } from './hooks/useFatigueAdvisor';

// =============================================================================
// Section Components
// =============================================================================

function SectionHeader({ icon, title, color }: { icon: string; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className={`flex h-6 w-6 items-center justify-center rounded-md text-xs ${color}`}>
        {icon}
      </span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function ListSection({
  icon,
  title,
  items,
  color,
  testId,
}: {
  icon: string;
  title: string;
  items: string[];
  color: string;
  testId: string;
}) {
  return (
    <div data-testid={testId} className="rounded-xl border border-border/40 bg-card p-4">
      <SectionHeader icon={icon} title={title} color={color} />
      <ul className="space-y-1.5 ml-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

interface FatigueResponseProps {
  advice: FatigueAdvice;
}

export function FatigueResponse({ advice }: FatigueResponseProps) {
  return (
    <div data-testid="fatigue-response" className="flex flex-col gap-3">
      {/* Likely Cause */}
      <div data-testid="fatigue-cause" className="rounded-xl border border-border/40 bg-card p-4">
        <SectionHeader
          icon="?"
          title="Likely Cause"
          color="bg-amber-500/10 text-amber-500"
        />
        <p className="text-sm text-muted-foreground leading-relaxed">
          {advice.likely_cause}
        </p>
      </div>

      {/* Immediate Recovery */}
      <ListSection
        icon="+"
        title="Immediate Recovery"
        items={advice.immediate_recovery}
        color="bg-emerald-500/10 text-emerald-500"
        testId="fatigue-recovery"
      />

      {/* Programming Suggestions */}
      <ListSection
        icon="^"
        title="Programming Suggestions"
        items={advice.programming_suggestions}
        color="bg-blue-500/10 text-blue-500"
        testId="fatigue-programming"
      />

      {/* Related Exercises */}
      <div data-testid="fatigue-exercises" className="rounded-xl border border-border/40 bg-card p-4">
        <SectionHeader
          icon="~"
          title="Related Exercises"
          color="bg-purple-500/10 text-purple-500"
        />
        <div className="flex flex-wrap gap-2">
          {advice.related_exercises.map((exercise, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full bg-muted/50 px-3 py-1 text-xs font-medium text-foreground"
            >
              {exercise}
            </span>
          ))}
        </div>
      </div>

      {/* Rest Recommendation */}
      <div data-testid="fatigue-rest" className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <SectionHeader
          icon="!"
          title="Rest Recommendation"
          color="bg-amber-500/10 text-amber-500"
        />
        <p className="text-sm text-muted-foreground leading-relaxed">
          {advice.rest_recommendation}
        </p>
      </div>
    </div>
  );
}
