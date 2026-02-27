import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { Calendar } from '../../components/Calendar';

const meta: Meta<typeof Calendar> = {
  title: 'Screens/Calendar',
  component: Calendar,
  parameters: { layout: 'fullscreen' },
  args: {
    userId: 'user_storybook',
    userLocation: undefined,
  },
};

export default meta;
type Story = StoryObj<typeof Calendar>;

export const Default: Story = {
  name: 'With events',
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:8003/events', () =>
          HttpResponse.json({
            events: [
              {
                id: 'ev-1',
                title: 'Hyrox Session',
                date: '2026-02-28',
                type: 'workout',
              },
              {
                id: 'ev-2',
                title: 'Rest Day',
                date: '2026-03-01',
                type: 'rest',
              },
            ],
          })
        ),
      ],
    },
  },
};

export const Empty: Story = {
  name: 'Empty calendar',
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:8003/events', () =>
          HttpResponse.json({ events: [] })
        ),
      ],
    },
  },
};
