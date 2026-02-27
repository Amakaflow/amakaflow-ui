import type { Meta, StoryObj } from '@storybook/react-vite';
import { Analytics } from '../../components/Analytics';

const mockUser = {
  name: 'David Andrews',
  subscription: 'Pro',
  workoutsThisWeek: 4,
};

const mockHistory = [
  {
    id: 'h-1',
    title: 'Hyrox Session',
    timestamp: new Date('2026-02-20').toISOString(),
    sources: [],
    structure: { title: 'Hyrox Session', blocks: [] } as any,
    profileId: 'user_storybook',
  },
  {
    id: 'h-2',
    title: 'Upper Body',
    timestamp: new Date('2026-02-18').toISOString(),
    sources: [],
    structure: { title: 'Upper Body', blocks: [] } as any,
    profileId: 'user_storybook',
  },
  {
    id: 'h-3',
    title: '5K Run',
    timestamp: new Date('2026-02-15').toISOString(),
    sources: [],
    structure: { title: '5K Run', blocks: [] } as any,
    profileId: 'user_storybook',
  },
];

const meta: Meta<typeof Analytics> = {
  title: 'Screens/Analytics',
  component: Analytics,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof Analytics>;

export const Default: Story = {
  name: 'With history',
  args: { user: mockUser, history: mockHistory },
};

export const Empty: Story = {
  name: 'Empty state',
  args: { user: { ...mockUser, workoutsThisWeek: 0 }, history: [] },
};
