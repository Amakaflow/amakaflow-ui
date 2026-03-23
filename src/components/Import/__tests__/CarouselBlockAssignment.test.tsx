import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CarouselBlockAssignment } from '../CarouselBlockAssignment';
import { MOCK_CAROUSEL_POST } from '../fixtures/carousel-demo';

// Use 3 slides for most tests
const threeSlides = MOCK_CAROUSEL_POST.slides.slice(0, 3);

describe('CarouselBlockAssignment', () => {
  const defaultProps = {
    selectedSlides: threeSlides,
    onConfirm: vi.fn(),
  };

  it('renders assignment rows for each selected slide', () => {
    render(<CarouselBlockAssignment {...defaultProps} />);
    expect(screen.getByTestId('assignment-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('assignment-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('assignment-row-2')).toBeInTheDocument();
  });

  it('shows merge preview with correct block and exercise counts', () => {
    render(<CarouselBlockAssignment {...defaultProps} />);
    const preview = screen.getByTestId('merge-preview');
    // 3 blocks, 2+3+2 = 7 exercises
    expect(preview).toHaveTextContent('3 blocks');
    expect(preview).toHaveTextContent('7 exercises');
  });

  it('removes a slide when remove button clicked', () => {
    render(<CarouselBlockAssignment {...defaultProps} />);
    const removeBtn = screen.getByLabelText('Remove slide 1');
    fireEvent.click(removeBtn);
    expect(screen.queryByTestId('assignment-row-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('merge-preview')).toHaveTextContent('2 blocks');
  });

  it('shows empty state when all slides removed', () => {
    const oneSlide = MOCK_CAROUSEL_POST.slides.slice(0, 1);
    render(<CarouselBlockAssignment selectedSlides={oneSlide} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Remove slide 1'));
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('disables confirm button when no slides remain', () => {
    const oneSlide = MOCK_CAROUSEL_POST.slides.slice(0, 1);
    render(<CarouselBlockAssignment selectedSlides={oneSlide} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Remove slide 1'));
    expect(screen.getByTestId('confirm-merge-btn')).toBeDisabled();
  });

  it('calls onConfirm with merged workout data', () => {
    const onConfirm = vi.fn();
    render(<CarouselBlockAssignment selectedSlides={threeSlides} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('confirm-merge-btn'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const merged = onConfirm.mock.calls[0][0];
    expect(merged.blocks).toHaveLength(3);
    expect(merged.totalExercises).toBe(7);
    expect(merged.title).toBe('Merged Carousel Workout');
  });

  it('uses custom workout title', () => {
    const onConfirm = vi.fn();
    render(
      <CarouselBlockAssignment
        selectedSlides={threeSlides}
        workoutTitle="Morning Mobility"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByTestId('confirm-merge-btn'));
    expect(onConfirm.mock.calls[0][0].title).toBe('Morning Mobility');
  });

  it('updates block label via input', () => {
    const onConfirm = vi.fn();
    render(<CarouselBlockAssignment selectedSlides={threeSlides} onConfirm={onConfirm} />);
    const labelInput = screen.getByLabelText('Block label for slide 1');
    fireEvent.change(labelInput, { target: { value: 'My Custom Block' } });
    fireEvent.click(screen.getByTestId('confirm-merge-btn'));
    expect(onConfirm.mock.calls[0][0].blocks[0].blockLabel).toBe('My Custom Block');
  });

  it('calls onBack when Back clicked', () => {
    const onBack = vi.fn();
    render(<CarouselBlockAssignment {...defaultProps} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('shows exercise details in each row', () => {
    render(<CarouselBlockAssignment {...defaultProps} />);
    expect(screen.getByText(/90\/90 Hip Switch/)).toBeInTheDocument();
    expect(screen.getByText(/Open Book Stretch/)).toBeInTheDocument();
    expect(screen.getByText(/Wall Ankle Dorsiflexion/)).toBeInTheDocument();
  });
});
