import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ClipQueueTab } from '../ClipQueueTab';

describe('ClipQueueTab', () => {
  it('shows placeholder with extension CTA', () => {
    render(<ClipQueueTab />);
    expect(screen.getByText(/clip workouts as you browse/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get the extension/i })).toBeDisabled();
  });
});
