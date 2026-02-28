import type { Meta, StoryObj } from '@storybook/react-vite';
import { ClarificationScreen } from '../../components/ClarificationScreen';
import type { PipelinePreview } from '../../types/pipeline';

const previewWithAmbiguity: PipelinePreview = {
  preview_id: 'preview-001',
  workout: {
    name: 'Push Day',
    exercises: [
      { name: 'Bench Press', sets: 5, reps: 5 },
      { name: 'Overhead Press', sets: 4, reps: 8 },
      { name: 'Jumping Jacks', sets: 2, reps: 20 },
      { name: 'Mountain Climbers', sets: 3, reps: 15 },
    ],
    exercise_count: 4,
    block_count: 2,
  },
  needs_clarification: true,
  ambiguous_blocks: [
    {
      id: 'block-1',
      label: 'Warm Up',
      structure: null,
      structure_confidence: 0.45,
      structure_options: ['circuit', 'sets'],
      exercises: [{ name: 'Jumping Jacks' }, { name: 'Mountain Climbers' }],
    },
    {
      id: 'block-2',
      label: 'Finisher',
      structure: null,
      structure_confidence: 0.5,
      structure_options: ['amrap', 'for-time', 'rounds'],
      exercises: [{ name: 'Burpees' }, { name: 'Box Jumps' }],
    },
  ],
};

const previewNoAmbiguity: PipelinePreview = {
  preview_id: 'preview-002',
  workout: {
    name: 'Pull Day',
    exercises: [
      { name: 'Pull Ups', sets: 4, reps: 8 },
      { name: 'Barbell Row', sets: 4, reps: 8 },
    ],
    exercise_count: 2,
    block_count: 1,
  },
  needs_clarification: false,
  ambiguous_blocks: [],
};

const meta: Meta<typeof ClarificationScreen> = {
  title: 'Screens/ClarificationScreen',
  component: ClarificationScreen,
  parameters: { layout: 'fullscreen' },
  args: {
    onConfirm: (selections) => console.log('Confirm selections', selections),
    onBack: () => console.log('Back'),
  },
};

export default meta;
type Story = StoryObj<typeof ClarificationScreen>;

export const WithAmbiguity: Story = {
  name: 'Ambiguous blocks to clarify',
  args: {
    preview: previewWithAmbiguity,
  },
};

export const NoAmbiguity: Story = {
  name: 'No ambiguous blocks',
  args: {
    preview: previewNoAmbiguity,
  },
};
