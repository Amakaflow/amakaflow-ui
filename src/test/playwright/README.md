# Playwright E2E tests

## Tagging convention

Every smoke test (file matching `*.smoke.spec.ts`) MUST be tagged either `@blocker` or `@regression`. CI runs them as two separate jobs.

| Tag | CI job | Required? | Retries | Use for |
|---|---|---|---|---|
| `@blocker` | `playwright-blocker` | ✅ Yes — fails the PR | 0 | App boots, navigation works, no critical page crashes. Should be small, fast (<3 min total), and green 100% of the time. |
| `@regression` | `playwright-regression` | ❌ No (continue-on-error) | 1 | Feature-specific behaviour. Surfaces real bugs but doesn't gate merges. |

Apply tags via the `tag` option on `test.describe()`:

```ts
// pages-navigation.smoke.spec.ts — basic page renders
test.describe('Page Navigation Smoke Tests', { tag: ['@smoke', '@blocker'] }, () => { ... });

// instagram-apify.smoke.spec.ts — feature-specific
test.describe('Instagram Apify Smoke Tests', { tag: ['@smoke', '@regression'] }, () => { ... });
```

The `@smoke` tag is kept for back-compat with `--grep @smoke`. The `@blocker` / `@regression` tag is what the projects in `playwright.config.ts` use to split work.

## Known-broken tests: use `test.fixme()` with a ticket ref

When a test reveals a real product bug that we haven't fixed yet, **don't `test.skip()`** — `.skip` hides the signal silently. Instead:

```ts
test.describe('Foo', { tag: ['@smoke', '@regression'] }, () => {
  test.fixme(true, 'AMA-1234: thing is broken because reasons');
  // ... tests
});
```

Or per-test:

```ts
test('does the thing', async ({ page }) => {
  test.fixme(true, 'AMA-1234');
  // ...
});
```

`.fixme()` shows up in the HTML report so the bug stays visible. Once the underlying ticket lands, **delete the `test.fixme()` call** in the same PR that fixes the bug.

## Project-conditional fixme

If a test only fails in one project (e.g. an a11y violation that should still surface in the dedicated `a11y` project), gate the fixme on `testInfo.project.name`:

```ts
test.beforeEach(({}, testInfo) => {
  test.fixme(
    testInfo.project.name === 'smoke-regression',
    'AMA-1552: known a11y violation; surface in a11y project only'
  );
});
```

> Note: Playwright requires the first parameter to use object destructuring (it's the fixtures argument). `_` will error with "First argument must use the object destructuring pattern" — keep `{}`.

## Running locally

```bash
# Required check (fast, must pass)
npx playwright test --project=smoke-blocker

# Broader coverage (may show known issues)
npx playwright test --project=smoke-regression

# Just a11y
npx playwright test --project=a11y

# Single file
npx playwright test src/test/playwright/pages-navigation.smoke.spec.ts
```

## Why these settings

- **`workers: 2` in CI** — `ubuntu-latest` is 4 vCPU. Dev server + MSW worker + Chromium per worker easily oversubscribes 4 vCPU. Per [Playwright CI docs](https://playwright.dev/docs/ci).
- **`retries: 0` for blocker, `1` for regression** — `retries: 2` triples the cost of any broken test. Blockers should fail fast; regression absorbs genuine flake. Per [Playwright retries docs](https://playwright.dev/docs/test-retries).
- **`maxFailures: 5` in CI** — bails out of runaway failing runs so one broken test can't burn the whole timeout.
- **`continue-on-error: true` on regression job** — keeps PRs unblocked while the regression suite stabilises. Tracked by ticket: when regression is reliably green, remove this flag and make it required.

See AMA-1556 for the full restructure rationale and research sources.
