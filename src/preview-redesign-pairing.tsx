/** Preview entry for the redesigned Pairing surface. AMA-1595. */
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/redesign-tokens.css';
import { PhonePreview } from './components/redesign/preview-helpers';
import { PairingScreen } from './components/redesign/screens/flow';

const root = document.getElementById('root');
if (root) createRoot(root).render(<PhonePreview Screen={PairingScreen} />);
