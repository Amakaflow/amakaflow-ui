/**
 * Tests for ClarificationScreen component.
 * AMA-716: Clarification flow — 12 test cases.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClarificationScreen } from '../ClarificationScreen';
import type { PipelinePreview, PipelineAmbiguousBlock } from '../../../types/pipeline';

const makeBlock = (overrides: Partial<PipelineAmbiguousBlock> = {}): PipelineAmbiguousBlock => ({
  id: 'block-1',
  label: 'Main Block',
  structure: 'circuit',
  structure_confidence: 0.4,
  structure_options: ['circuit', 'straight_sets'],
  exercises: [{ name: 'Push-ups' }, { name: 'Squats' }],
  ...overrides,
});

const makePreview = (overrides: Partial<PipelinePreview> = {}): PipelinePreview => ({
  preview_id: 'prev-1',
  workout: { name: 'Test Workout', exercises: [] },
  needs_clarification: true,
  ambiguous_blocks: [makeBlock()],
  ...overrides,
});

describe('ClarificationScreen', () => {
  // Test 1: renders clarification-screen when needs_clarification true and ambiguous_blocks non-empty
  it('renders clarification-screen when needs_clarification: true and ambiguous_blocks is non-empty', () => {
    render(
      <ClarificationScreen
        preview={makePreview()}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId('clarification-screen')).toBeInTheDocument();
    expect(screen.getByTestId('clarification-card')).toBeInTheDocument();
  });

  // Test 2: does not render any cards for blocks with structure_confidence >= 0.8
  it('does not render any cards for blocks with structure_confidence >= 0.8', () => {
    const highConfidenceBlock = makeBlock({ structure_confidence: 0.9 });
    render(
      <ClarificationScreen
        preview={makePreview({ ambiguous_blocks: [highConfidenceBlock] })}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('clarification-card')).not.toBeInTheDocument();
  });

  // Test 3: does not render any cards for blocks with empty structure_options
  it('does not render any cards for blocks with empty structure_options', () => {
    const noOptionsBlock = makeBlock({ structure_options: [] });
    render(
      <ClarificationScreen
        preview={makePreview({ ambiguous_blocks: [noOptionsBlock] })}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('clarification-card')).not.toBeInTheDocument();
  });

  // Test 4: AI guess is pre-selected — the option matching block.structure has aria-checked="true"
  it('AI guess is pre-selected — option matching block.structure has aria-checked="true"', () => {
    render(
      <ClarificationScreen
        preview={makePreview()}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    // block.structure = 'circuit', so circuit should be selected
    const circuitOption = screen.getByTestId('structure-option-circuit');
    expect(circuitOption).toHaveAttribute('aria-checked', 'true');

    const straightSetsOption = screen.getByTestId('structure-option-straight_sets');
    expect(straightSetsOption).toHaveAttribute('aria-checked', 'false');
  });

  // Test 5: Selecting a different option — click a non-selected StructureOption tile
  it('selecting a different option updates aria-checked state correctly', () => {
    render(
      <ClarificationScreen
        preview={makePreview()}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const circuitOption = screen.getByTestId('structure-option-circuit');
    const straightSetsOption = screen.getByTestId('structure-option-straight_sets');

    // Initially circuit is selected
    expect(circuitOption).toHaveAttribute('aria-checked', 'true');
    expect(straightSetsOption).toHaveAttribute('aria-checked', 'false');

    // Click straight_sets
    fireEvent.click(straightSetsOption);

    // Now straight_sets should be selected, circuit deselected
    expect(straightSetsOption).toHaveAttribute('aria-checked', 'true');
    expect(circuitOption).toHaveAttribute('aria-checked', 'false');
  });

  // Test 6: "Save to Library" disabled when a block has structure: null (no pre-selection)
  it('"Save to Library" is disabled when a block has structure: null', () => {
    const nullStructureBlock = makeBlock({ structure: null });
    render(
      <ClarificationScreen
        preview={makePreview({ ambiguous_blocks: [nullStructureBlock] })}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const saveButton = screen.getByRole('button', { name: /save to library/i });
    expect(saveButton).toBeDisabled();
  });

  // Test 7: "Save to Library" enabled when all blocks have a structure
  it('"Save to Library" is enabled when all blocks have a structure selected', () => {
    // block.structure = 'circuit' so it's pre-selected
    render(
      <ClarificationScreen
        preview={makePreview()}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const saveButton = screen.getByRole('button', { name: /save to library/i });
    expect(saveButton).not.toBeDisabled();
  });

  // Test 8: Skip calls onConfirm with the current (AI-guessed) selections
  it('Skip calls onConfirm with current AI-guessed selections', () => {
    const onConfirm = vi.fn();
    render(
      <ClarificationScreen
        preview={makePreview()}
        onConfirm={onConfirm}
        onBack={vi.fn()}
      />,
    );

    const skipButton = screen.getByRole('button', { name: /skip/i });
    fireEvent.click(skipButton);

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledWith({ 'block-1': 'circuit' });
  });

  // Test 9: Save to Library calls onConfirm with current selections
  it('"Save to Library" calls onConfirm with current selections', () => {
    const onConfirm = vi.fn();
    render(
      <ClarificationScreen
        preview={makePreview()}
        onConfirm={onConfirm}
        onBack={vi.fn()}
      />,
    );

    const saveButton = screen.getByRole('button', { name: /save to library/i });
    fireEvent.click(saveButton);

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledWith({ 'block-1': 'circuit' });
  });

  // Test 10: Back button with no changes — calls onBack without showing warning
  it('Back button with no changes calls onBack without showing warning', () => {
    const onBack = vi.fn();
    render(
      <ClarificationScreen
        preview={makePreview()}
        onConfirm={vi.fn()}
        onBack={onBack}
      />,
    );

    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.queryByText(/you'll lose your changes/i)).not.toBeInTheDocument();
  });

  // Test 11: Back button after changing selection — shows inline warning text
  it('Back button after changing selection shows inline warning text', () => {
    const onBack = vi.fn();
    render(
      <ClarificationScreen
        preview={makePreview()}
        onConfirm={vi.fn()}
        onBack={onBack}
      />,
    );

    // Change the selection to something different
    const straightSetsOption = screen.getByTestId('structure-option-straight_sets');
    fireEvent.click(straightSetsOption);

    // Now click back
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    // Should show warning, not call onBack immediately
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText(/you'll lose your changes/i)).toBeInTheDocument();
  });

  // Test 12: "Go back" link in warning calls onBack
  it('"Go back" link in warning calls onBack', () => {
    const onBack = vi.fn();
    render(
      <ClarificationScreen
        preview={makePreview()}
        onConfirm={vi.fn()}
        onBack={onBack}
      />,
    );

    // Change selection to trigger dirty state
    const straightSetsOption = screen.getByTestId('structure-option-straight_sets');
    fireEvent.click(straightSetsOption);

    // Click back to show warning
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    // Click "Go back" link in the warning
    const goBackLink = screen.getByRole('button', { name: /go back/i });
    fireEvent.click(goBackLink);

    expect(onBack).toHaveBeenCalledOnce();
  });
});
