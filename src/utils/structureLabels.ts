export const STRUCTURE_LABELS: Record<string, { label: string; description: string }> = {
  circuit:       { label: 'Circuit',       description: 'All exercises repeat together for N rounds' },
  straight_sets: { label: 'Straight Sets', description: 'Each exercise runs independently' },
  superset:      { label: 'Superset',      description: 'Exercises paired together' },
  rounds:        { label: 'Rounds',        description: 'Repeated for N rounds' },
  amrap:         { label: 'AMRAP',         description: 'As many rounds as possible' },
  emom:          { label: 'EMOM',          description: 'Every minute on the minute' },
  tabata:        { label: 'Tabata',        description: '20s work / 10s rest intervals' },
  'for-time':    { label: 'For Time',      description: 'Complete as fast as possible' },
  sets:          { label: 'Sets',          description: 'Standard sets' },
  regular:       { label: 'Regular',       description: 'Standard format' },
};

export function getStructureLabel(key: string): { label: string; description: string } {
  return STRUCTURE_LABELS[key] ?? {
    label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: '',
  };
}
