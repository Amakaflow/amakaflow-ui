import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { VolumeAnalytics } from '../../components/VolumeAnalytics';

// VolumeAnalytics uses useVolumeAnalytics hook which fetches from
// MAPPER API (http://localhost:8001/progression/volume)

const MOCK_VOLUME_DATA = {
  data_points: [
    { date: '2026-02-17', muscle_group: 'Chest', totalVolume: 4800, sets: 12, reps: 60, averageWeight: 80 },
    { date: '2026-02-17', muscle_group: 'Shoulders', totalVolume: 2400, sets: 8, reps: 40, averageWeight: 60 },
    { date: '2026-02-17', muscle_group: 'Triceps', totalVolume: 1800, sets: 9, reps: 45, averageWeight: 40 },
    { date: '2026-02-19', muscle_group: 'Back', totalVolume: 5600, sets: 16, reps: 80, averageWeight: 70 },
    { date: '2026-02-19', muscle_group: 'Biceps', totalVolume: 1200, sets: 6, reps: 36, averageWeight: 33 },
    { date: '2026-02-21', muscle_group: 'Legs', totalVolume: 9000, sets: 20, reps: 80, averageWeight: 112 },
    { date: '2026-02-21', muscle_group: 'Glutes', totalVolume: 3600, sets: 12, reps: 48, averageWeight: 75 },
    { date: '2026-02-24', muscle_group: 'Chest', totalVolume: 5200, sets: 12, reps: 60, averageWeight: 87 },
    { date: '2026-02-24', muscle_group: 'Shoulders', totalVolume: 2600, sets: 8, reps: 40, averageWeight: 65 },
  ],
  summary: {
    totalVolume: 36200,
    totalSets: 103,
    totalReps: 489,
    uniqueMuscleGroups: 7,
    sessionCount: 4,
  },
  period: {
    start: '2026-02-17',
    end: '2026-02-24',
    type: 'weekly',
  },
};

const meta: Meta<typeof VolumeAnalytics> = {
  title: 'Screens/VolumeAnalytics',
  component: VolumeAnalytics,
  parameters: { layout: 'fullscreen' },
  args: {
    user: {
      id: 'user_storybook',
      name: 'David Andrews',
    },
  },
};

export default meta;
type Story = StoryObj<typeof VolumeAnalytics>;

export const Default: Story = {
  name: 'Volume analytics dashboard',
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:8001/progression/volume', () =>
          HttpResponse.json(MOCK_VOLUME_DATA)
        ),
      ],
    },
  },
};
