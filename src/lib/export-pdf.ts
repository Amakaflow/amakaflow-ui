/**
 * AMA-119: Client-side PDF export for workouts.
 *
 * Generates a printable PDF of a workout using the browser's print API.
 * Formats workout title, date, and exercises with sets/reps/weight in a clean table.
 */

import type { WorkoutStructure, Block, Exercise } from '../types/workout';

/**
 * Format an exercise row as an HTML table row.
 */
function exerciseToRow(exercise: Exercise, index: number): string {
  const sets = exercise.sets ?? '-';
  const reps = exercise.reps
    ? String(exercise.reps)
    : exercise.reps_range
      ? exercise.reps_range
      : '-';
  const duration = exercise.duration_sec
    ? `${exercise.duration_sec}s`
    : '-';
  const distance = exercise.distance_m
    ? `${exercise.distance_m}m`
    : '-';
  const rest = exercise.rest_sec
    ? `${exercise.rest_sec}s`
    : '-';
  const notes = exercise.notes ?? '';

  return `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${index + 1}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-weight:500;">${escapeHtml(exercise.name)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${sets}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${reps}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${duration}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${distance}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${rest}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${escapeHtml(notes)}</td>
    </tr>`;
}

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render a block section as HTML.
 */
function blockToHtml(block: Block): string {
  let exerciseIndex = 0;
  const rows: string[] = [];

  for (const exercise of block.exercises) {
    rows.push(exerciseToRow(exercise, exerciseIndex++));
  }

  if (block.supersets) {
    for (const superset of block.supersets) {
      for (const exercise of superset.exercises) {
        rows.push(exerciseToRow(exercise, exerciseIndex++));
      }
    }
  }

  const structureLabel = block.structure
    ? ` (${block.structure}${block.rounds ? ` x${block.rounds}` : ''})`
    : '';

  return `
    <div style="margin-bottom:24px;">
      <h2 style="font-size:16px;font-weight:600;margin:0 0 8px 0;color:#374151;">
        ${escapeHtml(block.label)}${structureLabel}
      </h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #d1d5db;">#</th>
            <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #d1d5db;">Exercise</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:2px solid #d1d5db;">Sets</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:2px solid #d1d5db;">Reps</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:2px solid #d1d5db;">Duration</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:2px solid #d1d5db;">Distance</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:2px solid #d1d5db;">Rest</th>
            <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #d1d5db;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>
    </div>`;
}

/**
 * Generate a full HTML document suitable for PDF printing.
 *
 * @param workout - The workout structure to render
 * @param date - Optional date string to display (defaults to today)
 * @returns HTML string
 */
export function generateWorkoutPdfHtml(workout: WorkoutStructure, date?: string): string {
  const displayDate = date ?? new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const blocksHtml = workout.blocks.map(blockToHtml).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(workout.title)}</title>
  <style>
    @media print {
      body { margin: 0; }
      @page { margin: 1cm; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #111827;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div style="margin-bottom:24px;border-bottom:2px solid #111827;padding-bottom:12px;">
    <h1 style="font-size:22px;font-weight:700;margin:0 0 4px 0;">${escapeHtml(workout.title)}</h1>
    <p style="font-size:13px;color:#6b7280;margin:0;">${escapeHtml(displayDate)}</p>
    ${workout.source ? `<p style="font-size:12px;color:#9ca3af;margin:4px 0 0 0;">Source: ${escapeHtml(workout.source)}</p>` : ''}
  </div>
  ${blocksHtml}
  <div style="margin-top:24px;font-size:11px;color:#9ca3af;text-align:center;">
    Generated by AmakaFlow
  </div>
</body>
</html>`;
}

/**
 * Open a print dialog to save/print a workout as PDF.
 *
 * Uses the browser's built-in print functionality which supports
 * "Save as PDF" on all major browsers.
 *
 * @param workout - The workout structure to export
 * @param date - Optional date string
 */
export function downloadWorkoutPdf(workout: WorkoutStructure, date?: string): void {
  const html = generateWorkoutPdfHtml(workout, date);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Failed to open print window. Please allow popups for this site.');
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
