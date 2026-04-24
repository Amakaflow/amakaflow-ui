/** Preview entry for the redesigned History surface. AMA-1595. */
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/redesign-tokens.css';
import { PhonePreview } from './components/redesign/preview-helpers';
import { HistoryScreen } from './components/redesign/screens/flow';

const root = document.getElementById('root');
if (root) createRoot(root).render(<PhonePreview Screen={HistoryScreen} />);
