/**
 * ModalOutlet — renders modal routes on top of the background location.
 *
 * Phase 4: When a link navigates with `state: { backgroundLocation }`,
 * the parent Routes renders at the backgroundLocation and this outlet
 * renders the modal route on top.
 *
 * Modal routes:
 *   /workouts/:id       -> workout detail overlay
 *   /calendar/generate  -> generate-week preview
 *   /calendar/plan-preview -> plan preview overlay
 *
 * Closing the modal calls navigate(-1) to go back.
 */
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';

export function ModalOutlet() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { backgroundLocation?: Location } | null;

  // Only render if we arrived here with a backgroundLocation in state
  if (!state?.backgroundLocation) return null;

  const handleClose = () => {
    navigate(-1);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <Routes location={location}>
        <Route
          path="/workouts/:id"
          element={
            <ModalContainer onClose={handleClose}>
              <WorkoutDetailModal onClose={handleClose} />
            </ModalContainer>
          }
        />
        <Route
          path="/calendar/generate"
          element={
            <ModalContainer onClose={handleClose}>
              <GenerateWeekModal onClose={handleClose} />
            </ModalContainer>
          }
        />
        <Route
          path="/calendar/plan-preview"
          element={
            <ModalContainer onClose={handleClose}>
              <PlanPreviewModal onClose={handleClose} />
            </ModalContainer>
          }
        />
      </Routes>
    </div>
  );
}

/** Shared modal wrapper — centered panel with close affordance */
function ModalContainer({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  // Close on Escape
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen p-4"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        className="relative bg-background rounded-xl shadow-2xl border w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1 rounded-md hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}

/**
 * Placeholder modal route components.
 * These will be wired to real data via route params + context.
 */
function WorkoutDetailModal({ onClose: _onClose }: { onClose: () => void }) {
  // In a full implementation this would use useParams() to load workout by ID
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Workout Detail</h2>
      <p className="text-muted-foreground">
        This modal will display the full workout detail when navigated to /workouts/:id.
        The parent workouts list remains visible in the background.
      </p>
    </div>
  );
}

function GenerateWeekModal({ onClose: _onClose }: { onClose: () => void }) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Generate Training Week</h2>
      <p className="text-muted-foreground">
        This modal will host the generate-week form when navigated to /calendar/generate.
        The calendar remains visible in the background.
      </p>
    </div>
  );
}

function PlanPreviewModal({ onClose: _onClose }: { onClose: () => void }) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Plan Preview</h2>
      <p className="text-muted-foreground">
        This modal will display the plan preview when navigated to /calendar/plan-preview.
        The calendar remains visible in the background.
      </p>
    </div>
  );
}

/**
 * Helper to create a link state that opens a modal on top of the current page.
 *
 * Usage in any component:
 *   navigate('/workouts/abc', { state: modalLinkState(location) })
 */
export function modalLinkState(currentLocation: Location) {
  return { backgroundLocation: currentLocation };
}
