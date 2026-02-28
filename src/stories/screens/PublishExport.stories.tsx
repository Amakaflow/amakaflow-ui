import type { Meta, StoryObj } from '@storybook/react-vite';
import { PublishExport } from '../../components/PublishExport';

const MOCK_WORKOUT_STRUCTURE = {
  title: 'Upper Body Strength',
  source: 'manual',
  blocks: [
    {
      label: 'Push',
      structure: '5x5' as const,
      time_work_sec: null,
      rest_between_sec: 90,
      default_reps_range: null,
      default_sets: null,
      exercises: [
        { name: 'Bench Press', sets: 5, reps: 5, load: '80kg', type: 'Strength', rest_sec: 90 },
        { name: 'Overhead Press', sets: 4, reps: 8, load: '50kg', type: 'Strength', rest_sec: 90 },
      ],
      supersets: [],
    },
  ],
};

const MOCK_VALIDATION = {
  valid: true,
  issues: [],
  warnings: [],
};

const GARMIN_EXPORTS = {
  yaml: `title: Upper Body Strength\nblocks:\n  - label: Push\n    structure: 5x5\n    exercises:\n      - name: Bench Press\n        sets: 5\n        reps: 5\n        load: 80kg`,
  fit: 'base64encodedFITdata==',
};

const APPLE_EXPORTS = {
  yaml: `title: Upper Body Strength\nblocks:\n  - label: Push\n    structure: 5x5`,
  plist: `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>title</key><string>Upper Body Strength</string></dict></plist>`,
};

const meta: Meta<typeof PublishExport> = {
  title: 'Screens/PublishExport',
  component: PublishExport,
  parameters: { layout: 'fullscreen' },
  args: {
    sources: ['manual'],
    onStartNew: () => console.log('Start new'),
    workout: MOCK_WORKOUT_STRUCTURE as any,
    validation: MOCK_VALIDATION as any,
  },
};

export default meta;
type Story = StoryObj<typeof PublishExport>;

export const GarminExport: Story = {
  name: 'Garmin FIT export ready',
  args: {
    selectedDevice: 'garmin' as any,
    userMode: 'individual',
    exports: GARMIN_EXPORTS,
  },
};

export const WatchOS: Story = {
  name: 'Apple Watch export',
  args: {
    selectedDevice: 'apple' as any,
    userMode: 'individual',
    exports: APPLE_EXPORTS,
  },
};
