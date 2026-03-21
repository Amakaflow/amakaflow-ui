import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectModal } from '../ConnectModal';
import type { PlatformConnection } from '../types';

const strydPlatform: PlatformConnection = {
  id: 'stryd',
  name: 'Stryd',
  icon: 'Footprints',
  color: 'orange-500',
  authMethod: 'credentials',
  status: 'disconnected',
};

const stravaPlatform: PlatformConnection = {
  id: 'strava',
  name: 'Strava',
  icon: 'Bike',
  color: 'orange-600',
  authMethod: 'oauth2',
  status: 'disconnected',
};

describe('ConnectModal', () => {
  const onOpenChange = vi.fn();
  const onConnectCredentials = vi.fn().mockResolvedValue(undefined);
  const onConnectOAuth = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders credentials form for Stryd', () => {
    render(
      <ConnectModal
        open={true}
        onOpenChange={onOpenChange}
        platform={strydPlatform}
        onConnectCredentials={onConnectCredentials}
        onConnectOAuth={onConnectOAuth}
      />
    );
    expect(screen.getByText('Connect to Stryd')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders OAuth info for Strava', () => {
    render(
      <ConnectModal
        open={true}
        onOpenChange={onOpenChange}
        platform={stravaPlatform}
        onConnectCredentials={onConnectCredentials}
        onConnectOAuth={onConnectOAuth}
      />
    );
    expect(screen.getByText('Connect to Strava')).toBeInTheDocument();
    expect(screen.getByText(/authorization page/)).toBeInTheDocument();
    expect(screen.getByText('Connect with Strava')).toBeInTheDocument();
  });

  it('submits credentials form', async () => {
    render(
      <ConnectModal
        open={true}
        onOpenChange={onOpenChange}
        platform={strydPlatform}
        onConnectCredentials={onConnectCredentials}
        onConnectOAuth={onConnectOAuth}
      />
    );
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => {
      expect(onConnectCredentials).toHaveBeenCalledWith('stryd', {
        email: 'test@example.com',
        password: 'secret123',
      });
    });
  });

  it('calls onConnectOAuth for OAuth platforms', async () => {
    render(
      <ConnectModal
        open={true}
        onOpenChange={onOpenChange}
        platform={stravaPlatform}
        onConnectCredentials={onConnectCredentials}
        onConnectOAuth={onConnectOAuth}
      />
    );
    fireEvent.click(screen.getByText('Connect with Strava'));

    await waitFor(() => {
      expect(onConnectOAuth).toHaveBeenCalledWith('strava');
    });
  });

  it('disables submit button when fields are empty', () => {
    render(
      <ConnectModal
        open={true}
        onOpenChange={onOpenChange}
        platform={strydPlatform}
        onConnectCredentials={onConnectCredentials}
        onConnectOAuth={onConnectOAuth}
      />
    );
    const connectBtn = screen.getByRole('button', { name: 'Connect' });
    expect(connectBtn).toBeDisabled();
  });

  it('returns null when platform is null', () => {
    const { container } = render(
      <ConnectModal
        open={true}
        onOpenChange={onOpenChange}
        platform={null}
        onConnectCredentials={onConnectCredentials}
        onConnectOAuth={onConnectOAuth}
      />
    );
    expect(container.innerHTML).toBe('');
  });
});
