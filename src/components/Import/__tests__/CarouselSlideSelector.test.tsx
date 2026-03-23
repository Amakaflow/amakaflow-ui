import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CarouselSlideSelector } from '../CarouselSlideSelector';
import { MOCK_CAROUSEL_POST } from '../fixtures/carousel-demo';

describe('CarouselSlideSelector', () => {
  const defaultProps = {
    post: MOCK_CAROUSEL_POST,
    onContinue: vi.fn(),
  };

  it('renders all slide cards', () => {
    render(<CarouselSlideSelector {...defaultProps} />);
    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`slide-card-${i}`)).toBeInTheDocument();
    }
  });

  it('shows correct slide count in header', () => {
    render(<CarouselSlideSelector {...defaultProps} />);
    expect(screen.getByText(/6 slides detected/)).toBeInTheDocument();
  });

  it('shows username', () => {
    render(<CarouselSlideSelector {...defaultProps} />);
    expect(screen.getByText(/@move\.daily/)).toBeInTheDocument();
  });

  it('selects all slides by default', () => {
    render(<CarouselSlideSelector {...defaultProps} />);
    expect(screen.getByTestId('selected-count')).toHaveTextContent('6 of 6 slides selected');
  });

  it('respects initialSelected prop', () => {
    render(<CarouselSlideSelector {...defaultProps} initialSelected={[0, 2]} />);
    expect(screen.getByTestId('selected-count')).toHaveTextContent('2 of 6 slides selected');
  });

  it('toggles a slide off when clicked', () => {
    render(<CarouselSlideSelector {...defaultProps} />);
    fireEvent.click(screen.getByTestId('slide-card-0'));
    expect(screen.getByTestId('selected-count')).toHaveTextContent('5 of 6 slides selected');
  });

  it('toggles a slide back on when clicked again', () => {
    render(<CarouselSlideSelector {...defaultProps} initialSelected={[1, 2]} />);
    fireEvent.click(screen.getByTestId('slide-card-0'));
    expect(screen.getByTestId('selected-count')).toHaveTextContent('3 of 6 slides selected');
  });

  it('Deselect All clears all selections', () => {
    render(<CarouselSlideSelector {...defaultProps} />);
    fireEvent.click(screen.getByTestId('deselect-all-btn'));
    expect(screen.getByTestId('selected-count')).toHaveTextContent('0 of 6 slides selected');
  });

  it('Select All re-selects all slides', () => {
    render(<CarouselSlideSelector {...defaultProps} initialSelected={[0]} />);
    fireEvent.click(screen.getByTestId('select-all-btn'));
    expect(screen.getByTestId('selected-count')).toHaveTextContent('6 of 6 slides selected');
  });

  it('disables Continue when nothing is selected', () => {
    render(<CarouselSlideSelector {...defaultProps} initialSelected={[]} />);
    expect(screen.getByTestId('continue-btn')).toBeDisabled();
  });

  it('calls onContinue with selected slides when Continue clicked', () => {
    const onContinue = vi.fn();
    render(
      <CarouselSlideSelector
        post={MOCK_CAROUSEL_POST}
        initialSelected={[0, 3]}
        onContinue={onContinue}
      />,
    );
    fireEvent.click(screen.getByTestId('continue-btn'));
    expect(onContinue).toHaveBeenCalledTimes(1);
    const passedSlides = onContinue.mock.calls[0][0];
    expect(passedSlides).toHaveLength(2);
    expect(passedSlides[0].slideIndex).toBe(0);
    expect(passedSlides[1].slideIndex).toBe(3);
  });

  it('shows exercise count per slide', () => {
    render(<CarouselSlideSelector {...defaultProps} />);
    // Slide 0 has 2 exercises, Slide 1 has 3
    const card0 = screen.getByTestId('slide-card-0');
    expect(within(card0).getByText('2 exercises')).toBeInTheDocument();
    const card1 = screen.getByTestId('slide-card-1');
    expect(within(card1).getByText('3 exercises')).toBeInTheDocument();
  });

  it('shows exercise names in preview', () => {
    render(<CarouselSlideSelector {...defaultProps} />);
    expect(screen.getByText(/90\/90 Hip Switch/)).toBeInTheDocument();
    expect(screen.getByText(/Open Book Stretch/)).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<CarouselSlideSelector {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows total exercise count for selected slides', () => {
    // All 6 slides: 2+3+2+3+2+2 = 14 exercises
    render(<CarouselSlideSelector {...defaultProps} />);
    expect(screen.getByTestId('selected-count')).toHaveTextContent('14 exercises');
  });
});
