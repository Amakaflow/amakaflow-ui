/**
 * BodyMapSelector — simple body outline for tapping muscle groups.
 *
 * AMA-1114: Optional component that lets users tap muscle groups
 * to pre-fill a fatigue question. Uses a simple front/back body
 * diagram with clickable regions.
 */

import { useState } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface MuscleGroup {
  id: string;
  label: string;
  questionTemplate: string;
}

interface BodyMapSelectorProps {
  onSelect: (question: string) => void;
  selectedId?: string | null;
}

// =============================================================================
// Muscle Group Data
// =============================================================================

const MUSCLE_GROUPS: MuscleGroup[] = [
  { id: 'neck', label: 'Neck', questionTemplate: 'My neck feels tight and fatigued' },
  { id: 'shoulders', label: 'Shoulders', questionTemplate: 'My shoulders are fatigued and sore' },
  { id: 'chest', label: 'Chest', questionTemplate: 'My chest muscles are fatigued after training' },
  { id: 'biceps', label: 'Biceps', questionTemplate: 'My biceps are fatigued from pulling exercises' },
  { id: 'forearms', label: 'Forearms', questionTemplate: 'My forearms are fatigued and grip is weak' },
  { id: 'core', label: 'Core / Abs', questionTemplate: 'My core and abs are fatigued' },
  { id: 'hip-flexors', label: 'Hip Flexors', questionTemplate: 'My hip flexors feel tight and fatigued' },
  { id: 'quads', label: 'Quadriceps', questionTemplate: 'My quadriceps are fatigued after leg training' },
  { id: 'inner-thigh', label: 'Inner Thighs', questionTemplate: 'My inner thighs are fatigued after lunges' },
  { id: 'calves', label: 'Calves', questionTemplate: 'My calves are fatigued and tight from running' },
  { id: 'upper-back', label: 'Upper Back', questionTemplate: 'My upper back and traps are fatigued' },
  { id: 'lower-back', label: 'Lower Back', questionTemplate: 'My lower back feels fatigued and stiff' },
  { id: 'glutes', label: 'Glutes', questionTemplate: 'My glutes are fatigued from hip-dominant exercises' },
  { id: 'hamstrings', label: 'Hamstrings', questionTemplate: 'My hamstrings are fatigued from deadlifts and running' },
];

// =============================================================================
// Component
// =============================================================================

export function BodyMapSelector({ onSelect, selectedId }: BodyMapSelectorProps) {
  const [activeId, setActiveId] = useState<string | null>(selectedId ?? null);

  const handleSelect = (group: MuscleGroup) => {
    setActiveId(group.id);
    onSelect(group.questionTemplate);
  };

  // Group into front and back
  const frontGroups = MUSCLE_GROUPS.filter((g) =>
    ['neck', 'shoulders', 'chest', 'biceps', 'forearms', 'core', 'hip-flexors', 'quads', 'inner-thigh', 'calves'].includes(g.id),
  );
  const backGroups = MUSCLE_GROUPS.filter((g) =>
    ['upper-back', 'lower-back', 'glutes', 'hamstrings'].includes(g.id),
  );

  return (
    <div data-testid="body-map-selector" className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground text-center">
        Tap a muscle group to ask about fatigue
      </p>

      <div className="grid grid-cols-2 gap-4">
        {/* Front */}
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-1">
            Front
          </h4>
          {frontGroups.map((group) => (
            <button
              key={group.id}
              data-testid={`muscle-group-${group.id}`}
              onClick={() => handleSelect(group)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left ${
                activeId === group.id
                  ? 'border-violet-500 bg-violet-500/10 text-violet-400'
                  : 'border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>

        {/* Back */}
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-1">
            Back
          </h4>
          {backGroups.map((group) => (
            <button
              key={group.id}
              data-testid={`muscle-group-${group.id}`}
              onClick={() => handleSelect(group)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left ${
                activeId === group.id
                  ? 'border-violet-500 bg-violet-500/10 text-violet-400'
                  : 'border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
