/**
 * Standalone preview entry point for ShoeComparisonPage.
 * Served at /shoe-comparison-preview.html during dev.
 *
 * AMA-1112: Renders shoe performance comparison for Playwright screenshots.
 */
import { createRoot } from 'react-dom/client';
import './index.css';
import { ShoeComparisonPage } from './components/Analytics/ShoeComparison/ShoeComparisonPage';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <ShoeComparisonPage />
      </div>
    </div>
  );
}

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<App />);
