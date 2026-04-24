/**
 * Standalone preview entry point for the redesigned Pairing surface.
 * Served at /redesign-pairing-preview.html during dev.
 *
 * AMA-1595 pre-staged shell — empty landing zone for the Claude Design
 * → Claude Code handoff. Claude Code should replace this placeholder
 * with the redesigned Pairing component driven by seed data only.
 *
 * Description: Garmin 6-digit pair flow
 */
import { createRoot } from 'react-dom/client';
import './index.css';

function RedesignPreviewShell() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#0a0a0a',
      color: '#f5f5f5',
    }}>
      <div style={{ maxWidth: 560, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎨</div>
        <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem' }}>
          Redesign placeholder — Pairing
        </h1>
        <p style={{ color: '#a0a0a0', margin: '0 0 1.5rem' }}>
          Garmin 6-digit pair flow
        </p>
        <p style={{ fontSize: '0.875rem', color: '#707070' }}>
          This shell is waiting for the Claude Design → Claude Code handoff
          (AMA-1595). Replace the body of this component with the redesigned
          Pairing UI, driven by seed data only (no backend wiring).
        </p>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<RedesignPreviewShell />);
}
