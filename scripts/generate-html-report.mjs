#!/usr/bin/env node
/**
 * Generate HTML test reports from JSON suite results + screenshots.
 * Creates browsable HTML pages showing step-by-step test results.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const DOCS_DIR = '/Users/davidmini/.openclaw/workspace/amakaflow-docs/test-runs';
const TIMESTAMP = '2026-03-24';

async function generateWebE2EReport() {
  const dir = path.join(DOCS_DIR, `${TIMESTAMP}-web-e2e`);
  const reportJson = JSON.parse(await readFile(path.join(dir, 'suite-report.json'), 'utf-8'));
  const files = await readdir(dir);
  const screenshots = files.filter(f => f.endsWith('.png'));

  let rows = '';
  for (const r of reportJson.results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    const desktopImg = screenshots.find(f => f === `${r.name}-desktop.png`);
    const mobileImg = screenshots.find(f => f === `${r.name}-mobile.png`);
    const errorImg = screenshots.find(f => f === `${r.name}-ERROR.png`);

    rows += `
    <div class="test-card ${r.status.toLowerCase()}">
      <h3>${icon} ${r.ticket}: ${r.name}</h3>
      <p class="status">${r.status}${r.errors?.length ? ' — ' + r.errors[0] : ''}</p>
      <div class="screenshots">
        ${desktopImg ? `<div class="shot"><p>Desktop (1440x900)</p><img src="${desktopImg}" alt="${r.name} desktop"></div>` : ''}
        ${mobileImg ? `<div class="shot"><p>Mobile (390x844)</p><img src="${mobileImg}" alt="${r.name} mobile"></div>` : ''}
        ${errorImg ? `<div class="shot error"><p>Error State</p><img src="${errorImg}" alt="${r.name} error"></div>` : ''}
      </div>
    </div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Web E2E Test Report — ${TIMESTAMP}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0d1117; color: #c9d1d9; padding: 20px; max-width: 1400px; margin: 0 auto; }
    h1 { color: #58a6ff; margin-bottom: 8px; }
    .summary { background: #161b22; border-radius: 8px; padding: 16px; margin: 16px 0; display: flex; gap: 24px; }
    .summary .stat { text-align: center; }
    .summary .stat .num { font-size: 32px; font-weight: bold; }
    .summary .pass .num { color: #3fb950; }
    .summary .fail .num { color: #f85149; }
    .summary .total .num { color: #58a6ff; }
    .test-card { background: #161b22; border-radius: 8px; padding: 16px; margin: 12px 0; border-left: 4px solid #3fb950; }
    .test-card.fail { border-left-color: #f85149; }
    .test-card h3 { color: #fff; margin-bottom: 4px; }
    .test-card .status { color: #8b949e; font-size: 14px; margin-bottom: 12px; }
    .screenshots { display: flex; gap: 16px; flex-wrap: wrap; }
    .shot { flex: 1; min-width: 300px; }
    .shot p { color: #8b949e; font-size: 12px; margin-bottom: 4px; }
    .shot img { width: 100%; border-radius: 4px; border: 1px solid #30363d; }
    .shot.error img { border-color: #f85149; }
    .timestamp { color: #8b949e; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Web E2E Test Report</h1>
  <p class="timestamp">${reportJson.timestamp} — AmakaFlow Web App</p>
  <div class="summary">
    <div class="stat total"><div class="num">${reportJson.total}</div><div>Total</div></div>
    <div class="stat pass"><div class="num">${reportJson.passed}</div><div>Passed</div></div>
    <div class="stat fail"><div class="num">${reportJson.failed}</div><div>Failed</div></div>
  </div>
  ${rows}
</body>
</html>`;

  await writeFile(path.join(dir, 'index.html'), html);
  console.log(`Web E2E report: ${dir}/index.html`);
}

async function generateGarminReport() {
  const dir = path.join(DOCS_DIR, `${TIMESTAMP}-garmin-test-suite`);
  const reportJson = JSON.parse(await readFile(path.join(dir, 'suite-report.json'), 'utf-8'));

  let rows = '';
  for (const r of reportJson.results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    rows += `
    <tr class="${r.status.toLowerCase()}">
      <td>${icon}</td>
      <td><strong>${r.ticket}</strong></td>
      <td>${r.title}</td>
      <td>${r.status}</td>
      <td>${r.stepCount ?? '—'}</td>
      <td>${r.workoutName ?? '—'}</td>
      <td>${r.errors?.length ? r.errors.join('; ') : '—'}</td>
    </tr>`;
  }

  const mockImg = 'mock-ui-all-workouts.png';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Garmin Test Suite Report — ${TIMESTAMP}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0d1117; color: #c9d1d9; padding: 20px; max-width: 1400px; margin: 0 auto; }
    h1 { color: #58a6ff; margin-bottom: 8px; }
    h2 { color: #c9d1d9; margin: 24px 0 12px; }
    .summary { background: #161b22; border-radius: 8px; padding: 16px; margin: 16px 0; display: flex; gap: 24px; }
    .summary .stat { text-align: center; }
    .summary .stat .num { font-size: 32px; font-weight: bold; }
    .summary .pass .num { color: #3fb950; }
    .summary .fail .num { color: #f85149; }
    .summary .total .num { color: #58a6ff; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th { background: #21262d; color: #58a6ff; padding: 10px; text-align: left; }
    td { padding: 8px 10px; border-bottom: 1px solid #30363d; }
    tr.pass td:first-child { color: #3fb950; }
    tr.fail td:first-child { color: #f85149; }
    .mock-ui { margin: 24px 0; }
    .mock-ui img { width: 100%; max-width: 1200px; border-radius: 8px; border: 1px solid #30363d; }
    .timestamp { color: #8b949e; font-size: 14px; }
    .note { background: #161b22; border-radius: 8px; padding: 12px; margin: 12px 0; border-left: 4px solid #58a6ff; color: #8b949e; }
  </style>
</head>
<body>
  <h1>Garmin Workout Test Suite</h1>
  <p class="timestamp">${reportJson.timestamp} — Mock Server (no real Garmin calls)</p>
  <div class="summary">
    <div class="stat total"><div class="num">${reportJson.total}</div><div>Total</div></div>
    <div class="stat pass"><div class="num">${reportJson.passed}</div><div>Passed</div></div>
    <div class="stat fail"><div class="num">${reportJson.failed}</div><div>Failed</div></div>
  </div>
  <div class="note">All tests run against local mock Garmin server. Converter runs in Docker, output validated by mock. Zero real Garmin API calls.</div>
  <table>
    <tr><th></th><th>Ticket</th><th>Workout</th><th>Status</th><th>Steps</th><th>Name on Garmin</th><th>Errors</th></tr>
    ${rows}
  </table>
  <h2>Mock Garmin Connect — All Pushed Workouts</h2>
  <div class="mock-ui">
    <img src="${mockImg}" alt="Mock Garmin Connect showing all 8 workouts">
  </div>
</body>
</html>`;

  await writeFile(path.join(dir, 'index.html'), html);
  console.log(`Garmin report: ${dir}/index.html`);
}

async function main() {
  await generateWebE2EReport();
  await generateGarminReport();
  console.log('\nDone. Open index.html files in a browser to view reports.');
}

main().catch(err => { console.error(err); process.exit(1); });
