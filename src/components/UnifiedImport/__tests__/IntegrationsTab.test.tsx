import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { IntegrationsTab } from '../IntegrationsTab';

describe('IntegrationsTab', () => {
  it('renders all integration tiles', () => {
    render(<IntegrationsTab />);
    expect(screen.getByText('Notion')).toBeInTheDocument();
    expect(screen.getByText('Strava')).toBeInTheDocument();
    expect(screen.getByText('Garmin Connect')).toBeInTheDocument();
    expect(screen.getByText('FIT / TCX files')).toBeInTheDocument();
    expect(screen.getByText('Browser Clip Queue')).toBeInTheDocument();
  });

  it('marks all tiles as coming soon', () => {
    render(<IntegrationsTab />);
    const comingSoonBadges = screen.getAllByText('Coming soon');
    expect(comingSoonBadges).toHaveLength(5);
  });
});
