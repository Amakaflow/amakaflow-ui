import type { Meta, StoryObj } from '@storybook/react-vite';
import { ValidateMap } from '../../components/ValidateMap';
import type { ValidationResponse, ValidationResult } from '../../types/workout';
import type { WorkoutStructure } from '../../types/workout';

const makeResult = (
  name: string,
  status: ValidationResult['status'],
  block: string,
  index: number,
): ValidationResult => ({
  original_name: name,
  mapped_to: status === 'valid' ? name : null,
  confidence: status === 'valid' ? 0.95 : 0.4,
  description: `${name} — ${block}`,
  block,
  location: `exercises[${index}]`,
  status,
  suggestions: status !== 'valid' ? [{ name: `${name} (alt)`, confidence: 0.6 } as any] : [],
});

const mockWorkout: WorkoutStructure = {
  title: 'Push Day',
  source: 'manual',
  blocks: [
    {
      id: 'block-1',
      label: 'Main Set',
      structure: 'sets',
      exercises: [
        { name: 'Bench Press', sets: 5, reps: 5 } as any,
        { name: 'Overhead Press', sets: 4, reps: 8 } as any,
        { name: 'Tricep Pushdown', sets: 3, reps: 12 } as any,
      ],
    },
  ],
};

const mixedValidation: ValidationResponse = {
  total_exercises: 3,
  validated_exercises: [
    makeResult('Bench Press', 'valid', 'Main Set', 0),
  ],
  needs_review: [
    makeResult('Overhead Press', 'needs_review', 'Main Set', 1),
  ],
  unmapped_exercises: [
    makeResult('Tricep Pushdown', 'unmapped', 'Main Set', 2),
  ],
  can_proceed: true,
};

const allConfirmedValidation: ValidationResponse = {
  total_exercises: 3,
  validated_exercises: [
    makeResult('Bench Press', 'valid', 'Main Set', 0),
    makeResult('Overhead Press', 'valid', 'Main Set', 1),
    makeResult('Tricep Pushdown', 'valid', 'Main Set', 2),
  ],
  needs_review: [],
  unmapped_exercises: [],
  can_proceed: true,
};

const meta: Meta<typeof ValidateMap> = {
  title: 'Screens/ValidateMap',
  component: ValidateMap,
  parameters: { layout: 'fullscreen' },
  args: {
    workout: mockWorkout,
    selectedDevice: 'garmin',
    loading: false,
    onReValidate: (workout) => console.log('Re-validate', workout),
    onProcess: (workout) => console.log('Process', workout),
  },
};

export default meta;
type Story = StoryObj<typeof ValidateMap>;

export const WithResults: Story = {
  name: 'Validation results',
  args: {
    validation: mixedValidation,
  },
};

export const AllConfirmed: Story = {
  name: 'All exercises confirmed',
  args: {
    validation: allConfirmedValidation,
  },
};
