/**
 * Take screenshots of the TrainingWeekView component.
 *
 * Usage: npx tsx scripts/screenshot-training-week.ts
 *
 * Requires the dev server to be running (npm run dev).
 * Alternatively starts storybook.
 *
 * This script renders the component to a temporary HTML and screenshots it.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch();

  // --- Desktop full week ---
  const desktopCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const desktopPage = await desktopCtx.newPage();

  // Render standalone component via inline HTML
  const html = `
<!DOCTYPE html>
<html class="dark">
<head>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #0a0a0a; color: #fafafa; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import React from '${BASE}/@fs/node_modules/react/index.js';
    import ReactDOM from '${BASE}/@fs/node_modules/react-dom/client.js';
    import { TrainingWeekView } from '${BASE}/src/components/Calendar/TrainingWeekView.tsx';
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(TrainingWeekView));
  </script>
</body>
</html>
`;

  console.log('Taking screenshots... ensure dev server is running at', BASE);

  await desktopPage.goto(BASE);
  await desktopPage.waitForLoadState('networkidle');

  // Navigate to calendar
  const calBtn = desktopPage.getByLabel('Calendar');
  if (await calBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await calBtn.click();
  }
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: '/tmp/ama-1126-desktop-full.png', fullPage: true });
  console.log('Saved /tmp/ama-1126-desktop-full.png');

  await desktopCtx.close();

  // --- Mobile ---
  const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto(BASE);
  await mobilePage.waitForLoadState('networkidle');
  const mCalBtn = mobilePage.getByLabel('Calendar');
  if (await mCalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await mCalBtn.click();
  }
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: '/tmp/ama-1126-mobile-view.png', fullPage: true });
  console.log('Saved /tmp/ama-1126-mobile-view.png');

  await mobileCtx.close();
  await browser.close();
  console.log('Done!');
}

main().catch(console.error);
