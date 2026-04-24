/** Preview entry for the redesigned Paywall surface. AMA-1595.
 * Mobile by default; append ?desktop=1 to see the desktop variant. */
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/redesign-tokens.css';
import { PhonePreview, DesktopPreview } from './components/redesign/preview-helpers';
import { PaywallMobile, PaywallDesktop } from './components/redesign/screens/marketing';

const isDesktop = new URLSearchParams(window.location.search).get('desktop') === '1';
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    isDesktop
      ? <DesktopPreview Screen={PaywallDesktop} />
      : <PhonePreview Screen={PaywallMobile} />
  );
}
