import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { BulkImport } from '../../components/BulkImport';
import { BulkImportProvider } from '../../context/BulkImportContext';

// BulkImport uses BulkImportContext. Wrap with BulkImportProvider.
// autoRestore=false prevents reading from localStorage in Storybook.

const meta: Meta<typeof BulkImport> = {
  title: 'Screens/BulkImport',
  component: BulkImport,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <BulkImportProvider autoRestore={false}>
        <Story />
      </BulkImportProvider>
    ),
  ],
  args: {
    userId: 'user_storybook',
    onBack: () => console.log('Back'),
    onViewCalendar: () => console.log('View calendar'),
    onViewPrograms: () => console.log('View programs'),
  },
};

export default meta;
type Story = StoryObj<typeof BulkImport>;

export const Default: Story = {
  name: 'Bulk import — detect step',
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:8004/workouts/bulk', () =>
          HttpResponse.json({
            workouts: [
              {
                title: 'Monday Push',
                source: 'file',
                blocks: [
                  {
                    label: 'Push',
                    structure: '4x10',
                    exercises: [
                      { name: 'Bench Press', sets: 4, reps: 10, load: '70kg', type: 'Strength' },
                      { name: 'Incline Dumbbell Press', sets: 4, reps: 10, load: '30kg', type: 'Strength' },
                    ],
                    supersets: [],
                  },
                ],
              },
            ],
            total: 1,
          })
        ),
        http.post('http://localhost:8001/map', () =>
          HttpResponse.json({
            mappings: [
              { source_name: 'Bench Press', device_name: 'Bench Press', confidence: 0.99 },
              { source_name: 'Incline Dumbbell Press', device_name: 'Incline DB Press', confidence: 0.93 },
            ],
          })
        ),
        http.post('http://localhost:8004/workouts', () =>
          HttpResponse.json({ id: 'workout-bulk-1', created_at: new Date().toISOString() }, { status: 201 })
        ),
      ],
    },
  },
};
