/**
 * Playwright screenshot script for ActivityFeed (AMA-1124).
 *
 * Takes desktop (1280x800) and mobile (375x812) screenshots.
 * Renders a standalone HTML page with the ActivityFeed mock data
 * so no dev server is needed.
 */

import { chromium } from '@playwright/test';

const MOCK_HTML = `
<!DOCTYPE html>
<html lang="en" class="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Activity Feed - AMA-1124</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --background: 0 0% 100%;
      --foreground: 0 0% 3.9%;
      --card: 0 0% 100%;
      --card-foreground: 0 0% 3.9%;
      --muted: 0 0% 96.1%;
      --muted-foreground: 0 0% 45.1%;
      --border: 0 0% 89.8%;
      --primary: 24 95% 50%;
      --primary-foreground: 0 0% 98%;
      --secondary: 0 0% 96.1%;
      --secondary-foreground: 0 0% 9%;
      --destructive: 0 84.2% 60.2%;
      --radius: 0.75rem;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: hsl(var(--background));
      color: hsl(var(--foreground));
      line-height: 1.5;
    }
    .container { max-width: 640px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
    .subtitle { font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin-bottom: 16px; }
    .card {
      background: hsl(var(--card));
      border: 1px solid hsl(var(--border));
      border-radius: var(--radius);
      margin-bottom: 8px;
    }
    .card-content { display: flex; gap: 12px; padding: 12px 16px; }
    .status-icon {
      flex-shrink: 0;
      width: 24px; height: 24px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: bold;
      margin-top: 2px;
    }
    .status-approved { background: #dcfce7; color: #15803d; }
    .status-pending { background: #fef3c7; color: #b45309; }
    .status-rejected { background: #fee2e2; color: #b91c1c; }
    .status-undone { background: #f3f4f6; color: #6b7280; }
    .content { flex: 1; min-width: 0; }
    .header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .action-type { font-size: 0.875rem; font-weight: 500; }
    .badge {
      display: inline-flex; align-items: center;
      background: hsl(var(--secondary));
      color: hsl(var(--secondary-foreground));
      font-size: 0.75rem; font-weight: 500;
      padding: 1px 8px; border-radius: 6px;
    }
    .time { margin-left: auto; font-size: 0.75rem; color: hsl(var(--muted-foreground)); white-space: nowrap; }
    .rationale { margin-top: 4px; font-size: 0.875rem; color: hsl(var(--muted-foreground)); line-height: 1.5; }
    .actions { margin-top: 8px; display: flex; gap: 8px; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 0.875rem; font-weight: 500;
      padding: 6px 12px; border-radius: 6px;
      border: none; cursor: pointer;
    }
    .btn-primary { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }
    .btn-outline { background: transparent; border: 1px solid hsl(var(--border)); color: hsl(var(--foreground)); }
    .btn-ghost { background: transparent; color: hsl(var(--muted-foreground)); font-size: 0.813rem; padding: 4px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Agent Activity</h1>
    <p class="subtitle">Actions proposed and taken by your AI agents. Review, approve, or undo.</p>

    <!-- Approved: Enrich Title -->
    <div class="card">
      <div class="card-content">
        <div class="status-icon status-approved">&#10003;</div>
        <div class="content">
          <div class="header">
            <span class="action-type">Enrich Title</span>
            <span class="badge">Strava</span>
            <span class="time">1h ago</span>
          </div>
          <p class="rationale">Added descriptive title based on Strava activity type and heart rate data.</p>
          <div class="actions">
            <button class="btn btn-ghost">&#8617; Undo</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pending: Restructure Week -->
    <div class="card" style="border-left: 3px solid #f59e0b;">
      <div class="card-content">
        <div class="status-icon status-pending">!</div>
        <div class="content">
          <div class="header">
            <span class="action-type">Restructure Week</span>
            <span class="badge">Scheduler</span>
            <span class="time">2h ago</span>
          </div>
          <p class="rationale">Your acute:chronic ratio is 1.4 (above 1.3 threshold). Recommending moving Thursday tempo to Tuesday to spread load.</p>
          <div class="actions">
            <button class="btn btn-primary">Approve</button>
            <button class="btn btn-outline">Reject</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Approved: Push to Garmin -->
    <div class="card">
      <div class="card-content">
        <div class="status-icon status-approved">&#10003;</div>
        <div class="content">
          <div class="header">
            <span class="action-type">Push to Garmin</span>
            <span class="badge">Garmin</span>
            <span class="time">2h ago</span>
          </div>
          <p class="rationale">Pushed structured interval workout to your Garmin Forerunner 265.</p>
          <div class="actions">
            <button class="btn btn-ghost">&#8617; Undo</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Approved: Add HR Zone -->
    <div class="card">
      <div class="card-content">
        <div class="status-icon status-approved">&#10003;</div>
        <div class="content">
          <div class="header">
            <span class="action-type">Add HR Zone</span>
            <span class="badge">Stryd</span>
            <span class="time">1d ago</span>
          </div>
          <p class="rationale">Added heart rate zone data (Z2, avg 142bpm) from Stryd power file.</p>
        </div>
      </div>
    </div>

    <!-- Rejected: Delete Session -->
    <div class="card">
      <div class="card-content">
        <div class="status-icon status-rejected">&#10005;</div>
        <div class="content">
          <div class="header">
            <span class="action-type">Delete Session</span>
            <span class="badge">Scheduler</span>
            <span class="time">1d ago</span>
          </div>
          <p class="rationale">Detected a duplicate easy run session on Wednesday. Recommending removal.</p>
        </div>
      </div>
    </div>

    <!-- Undone: Reschedule Session -->
    <div class="card" style="opacity: 0.6;">
      <div class="card-content">
        <div class="status-icon status-undone">&#8617;</div>
        <div class="content">
          <div class="header">
            <span class="action-type">Reschedule Session</span>
            <span class="badge">Scheduler</span>
            <span class="time">1d ago</span>
          </div>
          <p class="rationale">Moved Friday long run to Saturday due to low readiness score (35/100). <em>(Undone)</em></p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

async function main() {
  const browser = await chromium.launch();

  // Desktop screenshot (1280x800)
  const desktopCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const desktopPage = await desktopCtx.newPage();
  await desktopPage.setContent(MOCK_HTML);
  await desktopPage.waitForTimeout(500);
  await desktopPage.screenshot({
    path: '/tmp/ama-1124-activity-feed-desktop.png',
    fullPage: true,
  });
  console.log('Desktop screenshot: /tmp/ama-1124-activity-feed-desktop.png');
  await desktopCtx.close();

  // Mobile screenshot (375x812)
  const mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
  });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.setContent(MOCK_HTML);
  await mobilePage.waitForTimeout(500);
  await mobilePage.screenshot({
    path: '/tmp/ama-1124-activity-feed-mobile.png',
    fullPage: true,
  });
  console.log('Mobile screenshot: /tmp/ama-1124-activity-feed-mobile.png');
  await mobileCtx.close();

  await browser.close();
  console.log('Done! Screenshots saved to /tmp/');
}

main().catch(console.error);
