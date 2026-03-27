import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { ProgramDetail } from '../../components/ProgramDetail';
import { ProgramDetailProvider } from '../../context/ProgramDetailContext';

// ProgramDetail uses ProgramDetailContext and fetches from CALENDAR API
// (http://localhost:8003/training-programs/:id)

const SAMPLE_PROGRAM = {
  id: 'prog-1',
  title: '12-Week Strength Builder',
  description: 'Progressive overload strength program focused on the big three lifts.',
  sport: 'STRENGTH',
  duration_weeks: 12,
  current_week: 3,
  status: 'active',
  workouts_per_week: 4,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-02-20T10:00:00Z',
  weeks: [
    {
      week_number: 1,
      theme: 'Foundation',
      total_volume: 28000,
      workouts: [
        {
          id: 'pw-1',
          day_of_week: 1,
          title: 'Upper A',
          sport: 'STRENGTH',
          estimated_duration_minutes: 60,
          status: 'completed',
          workout_structure: null,
        },
        {
          id: 'pw-2',
          day_of_week: 3,
          title: 'Lower A',
          sport: 'STRENGTH',
          estimated_duration_minutes: 60,
          status: 'completed',
          workout_structure: null,
        },
        {
          id: 'pw-3',
          day_of_week: 5,
          title: 'Upper B',
          sport: 'STRENGTH',
          estimated_duration_minutes: 60,
          status: 'completed',
          workout_structure: null,
        },
        {
          id: 'pw-4',
          day_of_week: 6,
          title: 'Lower B',
          sport: 'STRENGTH',
          estimated_duration_minutes: 60,
          status: 'completed',
          workout_structure: null,
        },
      ],
    },
    {
      week_number: 2,
      theme: 'Building',
      total_volume: 30000,
      workouts: [
        {
          id: 'pw-5',
          day_of_week: 1,
          title: 'Upper A',
          sport: 'STRENGTH',
          estimated_duration_minutes: 65,
          status: 'completed',
          workout_structure: null,
        },
        {
          id: 'pw-6',
          day_of_week: 3,
          title: 'Lower A',
          sport: 'STRENGTH',
          estimated_duration_minutes: 65,
          status: 'completed',
          workout_structure: null,
        },
        {
          id: 'pw-7',
          day_of_week: 5,
          title: 'Upper B',
          sport: 'STRENGTH',
          estimated_duration_minutes: 65,
          status: 'completed',
          workout_structure: null,
        },
        {
          id: 'pw-8',
          day_of_week: 6,
          title: 'Lower B',
          sport: 'STRENGTH',
          estimated_duration_minutes: 65,
          status: 'completed',
          workout_structure: null,
        },
      ],
    },
    {
      week_number: 3,
      theme: 'Intensity',
      total_volume: null,
      workouts: [
        {
          id: 'pw-9',
          day_of_week: 1,
          title: 'Upper A',
          sport: 'STRENGTH',
          estimated_duration_minutes: 70,
          status: 'pending',
          workout_structure: null,
        },
        {
          id: 'pw-10',
          day_of_week: 3,
          title: 'Lower A',
          sport: 'STRENGTH',
          estimated_duration_minutes: 70,
          status: 'pending',
          workout_structure: null,
        },
        {
          id: 'pw-11',
          day_of_week: 5,
          title: 'Upper B',
          sport: 'STRENGTH',
          estimated_duration_minutes: 70,
          status: 'pending',
          workout_structure: null,
        },
        {
          id: 'pw-12',
          day_of_week: 6,
          title: 'Lower B',
          sport: 'STRENGTH',
          estimated_duration_minutes: 70,
          status: 'pending',
          workout_structure: null,
        },
      ],
    },
  ],
};

const meta: Meta<typeof ProgramDetail> = {
  title: 'Screens/ProgramDetail',
  component: ProgramDetail,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ProgramDetailProvider>
        <Story />
      </ProgramDetailProvider>
    ),
  ],
  args: {
    programId: 'prog-1',
    userId: 'user_storybook',
    onBack: () => console.log('Back'),
    onDeleted: () => console.log('Deleted'),
    onStartWorkout: (workout) => console.log('Start workout', workout),
  },
};

export default meta;
type Story = StoryObj<typeof ProgramDetail>;

export const Default: Story = {
  name: 'Program detail view',
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:8003/training-programs/:id', () =>
          HttpResponse.json(SAMPLE_PROGRAM)
        ),
        http.put('http://localhost:8003/training-programs/:id/status', () =>
          HttpResponse.json({ success: true })
        ),
        http.post('http://localhost:8003/training-programs/workouts/:id/complete', () =>
          HttpResponse.json({ success: true })
        ),
      ],
    },
  },
};
