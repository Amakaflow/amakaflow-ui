import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { StravaEnhance } from '../../components/StravaEnhance';

// StravaEnhance uses strava-api lib which calls linked-accounts and Strava OAuth.
// MSW intercepts the OAuth URL fetch and Strava API calls.

const meta: Meta<typeof StravaEnhance> = {
  title: 'Screens/StravaEnhance',
  component: StravaEnhance,
  parameters: { layout: 'fullscreen' },
  args: {
    onClose: () => console.log('Close'),
  },
};

export default meta;
type Story = StoryObj<typeof StravaEnhance>;

export const Default: Story = {
  name: 'Strava enhance connect',
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:8006/strava/auth-url', () =>
          HttpResponse.json({ url: 'https://www.strava.com/oauth/authorize?client_id=demo' })
        ),
        http.get('http://localhost:8006/strava/athlete', () =>
          HttpResponse.json({
            id: 12345678,
            username: 'alex.runner',
            firstname: 'Alex',
            lastname: 'Runner',
            profile: 'https://placehold.co/100x100',
            city: 'London',
            country: 'GB',
          })
        ),
        http.get('http://localhost:8006/strava/activities', () =>
          HttpResponse.json({
            activities: [
              {
                id: 'act-1',
                name: 'Morning Run',
                type: 'Run',
                sport_type: 'Run',
                distance: 5032,
                moving_time: 1620,
                elapsed_time: 1650,
                start_date: '2026-02-25T07:00:00Z',
                total_elevation_gain: 45,
                average_speed: 3.1,
                max_speed: 4.2,
              },
              {
                id: 'act-2',
                name: 'Easy Recovery Run',
                type: 'Run',
                sport_type: 'Run',
                distance: 3500,
                moving_time: 1260,
                elapsed_time: 1280,
                start_date: '2026-02-23T08:00:00Z',
                total_elevation_gain: 20,
                average_speed: 2.78,
                max_speed: 3.5,
              },
            ],
          })
        ),
      ],
    },
  },
};
