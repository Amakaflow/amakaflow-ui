import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { ProgramsList } from '../../components/ProgramsList';

// ProgramsList fetches from CALENDAR API (http://localhost:8003/training-programs)
const SAMPLE_PROGRAMS = [
  {
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
    weeks: [],
  },
  {
    id: 'prog-2',
    title: 'Hyrox 8-Week Prep',
    description: 'Competition preparation program designed for Hyrox athletes.',
    sport: 'HYROX',
    duration_weeks: 8,
    current_week: 1,
    status: 'draft',
    workouts_per_week: 5,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    weeks: [],
  },
  {
    id: 'prog-3',
    title: '5K Running Plan',
    description: 'Build your base for a 5K race over 6 weeks.',
    sport: 'RUNNING',
    duration_weeks: 6,
    current_week: 6,
    status: 'completed',
    workouts_per_week: 3,
    created_at: '2025-12-01T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    weeks: [],
  },
];

const meta: Meta<typeof ProgramsList> = {
  title: 'Screens/ProgramsList',
  component: ProgramsList,
  parameters: { layout: 'fullscreen' },
  args: {
    userId: 'user_storybook',
    onViewProgram: (programId) => console.log('View program', programId),
  },
};

export default meta;
type Story = StoryObj<typeof ProgramsList>;

export const WithPrograms: Story = {
  name: 'Programs list',
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:8003/training-programs', () =>
          HttpResponse.json({ programs: SAMPLE_PROGRAMS, total: SAMPLE_PROGRAMS.length })
        ),
        http.get('http://localhost:8003/training-programs/:id', () =>
          HttpResponse.json(SAMPLE_PROGRAMS[0])
        ),
        http.delete('http://localhost:8003/training-programs/:id', () =>
          HttpResponse.json({ success: true })
        ),
      ],
    },
  },
};

export const Empty: Story = {
  name: 'No programs yet',
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:8003/training-programs', () =>
          HttpResponse.json({ programs: [], total: 0 })
        ),
      ],
    },
  },
};
