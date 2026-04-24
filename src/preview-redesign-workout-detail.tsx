/** Preview entry for the redesigned Workout Detail surface. AMA-1595. */
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/redesign-tokens.css';
import { PhonePreview } from './components/redesign/preview-helpers';
import { DetailScreen } from './components/redesign/screens/main';

const root = document.getElementById('root');
if (root) createRoot(root).render(<PhonePreview Screen={DetailScreen} />);
