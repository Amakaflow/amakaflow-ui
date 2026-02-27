import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { MobileCompanion } from '../../components/MobileCompanion';

// MobileCompanion uses MAPPER API (http://localhost:8001/mobile/pairing/*)

const meta: Meta<typeof MobileCompanion> = {
  title: 'Screens/MobileCompanion',
  component: MobileCompanion,
  parameters: { layout: 'fullscreen' },
  args: {
    userId: 'user_storybook',
    onBack: () => console.log('Back'),
  },
};

export default meta;
type Story = StoryObj<typeof MobileCompanion>;

export const Default: Story = {
  name: 'Mobile companion setup',
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:8001/mobile/pairing/devices', () =>
          HttpResponse.json({
            devices: [
              {
                id: 'device-1',
                platform: 'ios',
                device_name: 'iPhone 15 Pro',
                paired_at: '2026-02-01T10:00:00Z',
                last_seen_at: '2026-02-26T18:30:00Z',
              },
            ],
          })
        ),
        http.post('http://localhost:8001/mobile/pairing/generate', () =>
          HttpResponse.json({
            token: 'ABC123XYZ',
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            qr_code_url: null,
          })
        ),
        http.post('http://localhost:8001/mobile/pairing/revoke', () =>
          HttpResponse.json({ success: true })
        ),
      ],
    },
  },
};
