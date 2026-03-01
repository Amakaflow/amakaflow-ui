/**
 * Accessibility regression tests using axe-core (AMA-828–832)
 *
 * Runs axe against each major view in demo mode and fails if any WCAG 2.1
 * AA violations are introduced. This prevents regressions after the
 * accessibility fixes landed in PR #175.
 *
 * Tags: @smoke @a11y
 *
 * Usage:
 *   npx playwright test a11y.smoke.spec.ts
 *   npx playwright test --grep @a11y
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Views to audit. Each entry navigates to the app and activates the view
// by clicking the matching nav item (or relies on the default landing state).
const VIEWS = [
  { name: 'home',     label: null },          // default landing view
  { name: 'workouts', label: 'Library' },
  { name: 'history',  label: 'History' },
  { name: 'calendar', label: 'Calendar' },
  { name: 'analytics',label: 'Analytics' },
  { name: 'settings', label: 'Settings' },
];

// Rules that fire only due to third-party iframe content (e.g. Sentry
// feedback widget) or are intentionally deferred to a later sprint.
// Keep this list minimal and document each entry.
const EXCLUDED_RULES: string[] = [
  // No permanent exclusions yet — start clean.
];

test.describe('Accessibility smoke tests @smoke @a11y', () => {
  for (const view of VIEWS) {
    test(`${view.name} view has no WCAG 2.1 AA violations`, async ({ page }) => {
      // Navigate to app
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Activate the target view if not the default landing state
      if (view.label) {
        const navLink = page.getByRole('link', { name: view.label }).or(
          page.getByRole('button', { name: view.label })
        );
        // Only click if the nav item exists — some views may not be in nav
        const count = await navLink.count();
        if (count > 0) {
          await navLink.first().click();
          await page.waitForLoadState('networkidle');
        }
      }

      // Run axe against the full page, scoped to WCAG 2.1 AA
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(EXCLUDED_RULES)
        .analyze();

      // Report violations with human-readable output on failure
      expect(
        results.violations,
        formatViolations(results.violations)
      ).toHaveLength(0);
    });
  }
});

test.describe('Accessibility regression checks @a11y', () => {
  test('page has exactly one main landmark', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const mainLandmarks = await page.locator('[role="main"], main').count();
    expect(mainLandmarks, 'Expected exactly one main landmark on home view').toBe(1);
  });

  test('all icon-only buttons have accessible names', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to workouts view where icon buttons live
    const workoutsLink = page.getByRole('link', { name: 'Library' }).or(
      page.getByRole('button', { name: 'Library' })
    );
    if (await workoutsLink.count() > 0) {
      await workoutsLink.first().click();
      await page.waitForLoadState('networkidle');
    }

    // Find all buttons that contain only an SVG (icon-only buttons)
    const results = await new AxeBuilder({ page })
      .withRules(['button-name'])
      .analyze();

    expect(
      results.violations,
      formatViolations(results.violations)
    ).toHaveLength(0);
  });

  test('filter selects have accessible labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const workoutsLink = page.getByRole('link', { name: 'Library' }).or(
      page.getByRole('button', { name: 'Library' })
    );
    if (await workoutsLink.count() > 0) {
      await workoutsLink.first().click();
      await page.waitForLoadState('networkidle');
    }

    const results = await new AxeBuilder({ page })
      .withRules(['select-name'])
      .analyze();

    expect(
      results.violations,
      formatViolations(results.violations)
    ).toHaveLength(0);
  });

  test('text color contrast meets WCAG AA', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    expect(
      results.violations,
      formatViolations(results.violations)
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AxeViolation = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number];

function formatViolations(violations: AxeViolation[]): string {
  if (violations.length === 0) return '';
  return (
    `\n\n${violations.length} axe violation(s):\n` +
    violations
      .map(
        (v) =>
          `  [${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n` +
          v.nodes
            .slice(0, 3)
            .map((n) => `    → ${n.html}`)
            .join('\n')
      )
      .join('\n\n')
  );
}
