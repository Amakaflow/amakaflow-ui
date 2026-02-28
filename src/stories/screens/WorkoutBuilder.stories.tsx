import type { Meta, StoryObj } from '@storybook/react-vite';
import { WorkoutBuilder } from '../../components/WorkoutBuilder';
import type { WorkoutStructure } from '../../types/workout';

const mockWorkout: WorkoutStructure = {
  title: 'Push Day',
  source: 'manual',
  blocks: [
    {
      id: 'block-1',
      label: 'Warm Up',
      structure: 'circuit',
      exercises: [
        { name: 'Jumping Jacks', sets: 2, reps: 20, type: 'HIIT' } as any,
      ],
    },
    {
      id: 'block-2',
      label: 'Main Set',
      structure: 'sets',
      exercises: [
        { name: 'Bench Press', sets: 5, reps: 5, type: 'Strength' } as any,
        { name: 'Overhead Press', sets: 4, reps: 8, type: 'Strength' } as any,
      ],
    },
  ],
};

const meta: Meta<typeof WorkoutBuilder> = {
  title: 'Screens/WorkoutBuilder',
  component: WorkoutBuilder,
  parameters: { layout: 'fullscreen' },
  args: {
    onTitleChange: (title) => console.log('Title change', title),
    onBlockSelect: (blockId) => console.log('Block select', blockId),
    onBlockDelete: (blockId) => console.log('Block delete', blockId),
  },
};

export default meta;
type Story = StoryObj<typeof WorkoutBuilder>;

export const Default: Story = {
  name: 'With 2 blocks',
  args: {
    workout: mockWorkout,
    selectedBlockId: 'block-1',
    blockIds: ['block-1', 'block-2'],
  },
};

export const EmptyWorkout: Story = {
  name: 'Empty workout',
  args: {
    workout: { title: 'New Workout', source: 'manual', blocks: [] },
    selectedBlockId: null,
    blockIds: [],
  },
};
