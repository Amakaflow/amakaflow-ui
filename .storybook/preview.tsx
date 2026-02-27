import React from 'react';
import type { Preview, Decorator } from '@storybook/react-vite';
import { initialize as mswInitialize, mswLoader } from 'msw-storybook-addon';
import { Toaster } from 'sonner';
import { handlers } from '../src/stories/mocks/handlers';
import '../src/index.css';

// Initialize MSW with global handlers — unhandled requests pass through to the network
mswInitialize({ onUnhandledRequest: 'bypass' }, handlers);

// ============================================================================
// Global Decorator
// ============================================================================
// Wraps every story with Toaster (needed by components that call toast())
// @clerk/clerk-react is mocked via the Vite alias in main.ts — no ClerkProvider needed

const withGlobalProviders: Decorator = (Story) => (
  <>
    <Story />
    <Toaster richColors position="top-right" />
  </>
);

// ============================================================================
// Preview Config
// ============================================================================

const preview: Preview = {
  decorators: [withGlobalProviders],
  loaders: [mswLoader],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'fullscreen',
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#0f0f0f' },
      ],
    },
  },
};

export default preview;
