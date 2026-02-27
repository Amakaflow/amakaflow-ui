import type { Meta, StoryObj } from '@storybook/react-vite';
import { MixWizardModal } from '../../components/MixWizard/MixWizardModal';

const SAMPLE_WORKOUTS = [
  {
    id: 'w-1',
    userId: 'user_storybook',
    title: 'Hyrox Session',
    sport: 'HYROX',
    sourceType: 'manual' as const,
    createdAt: '2026-02-20T08:00:00Z',
    updatedAt: '2026-02-20T08:00:00Z',
    structure: {
      title: 'Hyrox Session',
      blocks: [
        {
          label: 'Main Set',
          structure: 'for time',
          rest_between_sec: null,
          default_reps_range: null,
          default_sets: null,
          time_work_sec: 2100,
          exercises: [
            { name: '1000m SkiErg', sets: 1, reps: null, distance_m: 1000, type: 'HIIT', rest_sec: null },
          ],
          supersets: [],
        },
      ],
    },
    tags: [],
  },
  {
    id: 'w-2',
    userId: 'user_storybook',
    title: 'Upper Body Strength',
    sport: 'STRENGTH',
    sourceType: 'manual' as const,
    createdAt: '2026-02-18T09:30:00Z',
    updatedAt: '2026-02-18T09:30:00Z',
    structure: {
      title: 'Upper Body Strength',
      blocks: [
        {
          label: 'Push',
          structure: '5x5',
          rest_between_sec: 90,
          default_reps_range: null,
          default_sets: null,
          time_work_sec: null,
          exercises: [
            { name: 'Bench Press', sets: 5, reps: 5, load: '80kg', type: 'Strength', rest_sec: 90 },
          ],
          supersets: [],
        },
      ],
    },
    tags: [],
  },
];

const meta: Meta<typeof MixWizardModal> = {
  title: 'Screens/MixWizard',
  component: MixWizardModal,
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    workouts: SAMPLE_WORKOUTS as any,
    onClose: () => console.log('Close'),
    onSave: (preview, title) => console.log('Save mix', title, preview),
  },
};

export default meta;
type Story = StoryObj<typeof MixWizardModal>;

export const Default: Story = {
  name: 'Open with workouts',
};

export const NoWorkouts: Story = {
  name: 'No workouts to mix',
  args: { workouts: [] },
};
