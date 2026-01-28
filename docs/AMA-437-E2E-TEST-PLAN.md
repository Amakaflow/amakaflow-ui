# AMA-437 Feature Flags & Beta Rollout - E2E Test Plan

## Overview

This document provides comprehensive E2E test plans for the Feature Flags & Beta Rollout Configuration feature (AMA-437). The tests cover backend API validation (Python/pytest) and frontend UI validation (Playwright/Cypress).

---

## 1. Critical User Journeys

### Journey 1: Non-Beta User During Beta Period
**Scenario:** A user without beta access attempts to use chat during the beta period.

| Component | Expected Behavior |
|-----------|------------------|
| Frontend: ChatPanel.tsx | `useChatFeatureFlags()` returns `canAccessChat=false` |
| Frontend: UI | ComingSoonBadge renders instead of chat trigger |
| Backend: POST /api/chat | Returns SSE error event with `type="feature_disabled"` |

**Test IDs:**
- `data-testid="chat-coming-soon-badge"` - Should be visible
- `data-testid="chat-trigger-button"` - Should NOT be visible
- `data-testid="chat-panel"` - Should NOT render

---

### Journey 2: Beta User During Beta Period
**Scenario:** A user with beta access uses chat during the beta period.

| Component | Expected Behavior |
|-----------|------------------|
| Frontend: ChatPanel.tsx | `useChatFeatureFlags()` returns `canAccessChat=true`, `isBetaUser=true` |
| Frontend: UI | Chat trigger visible, BetaFeedbackWidget visible when panel open |
| Backend: POST /api/chat | Normal streaming response |

**Test IDs:**
- `data-testid="chat-trigger-button"` - Should be visible and clickable
- `data-testid="chat-panel"` - Should render when triggered
- `data-testid="beta-feedback-widget"` - Should be visible inside panel

---

### Journey 3: Any User After GA (beta_period=false)
**Scenario:** Normal operation after beta period ends.

| Component | Expected Behavior |
|-----------|------------------|
| Frontend: ChatPanel.tsx | `useChatFeatureFlags()` returns `canAccessChat=true` |
| Frontend: UI | Normal chat trigger, no beta UI elements |
| Backend: POST /api/chat | Normal streaming response |

**Test IDs:**
- `data-testid="chat-trigger-button"` - Should be visible
- `data-testid="chat-coming-soon-badge"` - Should NOT be visible
- `data-testid="beta-feedback-widget"` - Should NOT be visible (GA mode)

---

### Journey 4: Kill Switch Active (CHAT_ENABLED=false)
**Scenario:** Emergency kill switch disables chat for all users.

| Component | Expected Behavior |
|-----------|------------------|
| Frontend: ChatPanel.tsx | `useChatFeatureFlags()` returns `canAccessChat=false` |
| Frontend: UI | Chat UI completely hidden (no badge, no trigger) |
| Backend: POST /api/chat | Returns SSE error with `type="feature_disabled"` |

**Test IDs:**
- `data-testid="chat-trigger-button"` - Should NOT exist in DOM
- `data-testid="chat-coming-soon-badge"` - Should NOT exist in DOM
- `data-testid="chat-panel"` - Should NOT exist in DOM

---

### Journey 5: Beta User Submits Feedback
**Scenario:** Beta user provides feedback through the BetaFeedbackWidget.

| Step | UI Element | Action |
|------|-----------|--------|
| 1 | Chat panel open | User sees feedback widget |
| 2 | Thumbs up/down | Quick rating submitted |
| 3 | Feedback icon | Opens expanded form |
| 4 | Text area + submit | Detailed feedback stored |

**Test IDs:**
- `data-testid="beta-feedback-widget"` - Container
- `data-testid="feedback-thumbs-up"` - Quick positive rating
- `data-testid="feedback-thumbs-down"` - Quick negative rating
- `data-testid="feedback-form"` - Expanded text feedback form
- `data-testid="feedback-submit"` - Submit button

---

## 2. Playwright Test Patterns (Frontend)

### File Structure
```
e2e/
  feature-flags/
    feature-flags.spec.ts       # Main test file
    fixtures/
      feature-flag-mocks.ts     # MSW handlers for flag states
    page-objects/
      ChatPage.ts               # Chat page interactions
      FeedbackWidget.ts         # Feedback widget interactions
```

### Playwright Test Implementation

```typescript
// e2e/feature-flags/feature-flags.spec.ts
import { test, expect } from '@playwright/test';
import { mockFeatureFlags, FeatureFlagState } from './fixtures/feature-flag-mocks';

test.describe('Feature Flags & Beta Rollout', () => {

  // =========================================================================
  // SMOKE SUITE - Run on every PR (~30 seconds)
  // =========================================================================

  test.describe('Smoke Suite', () => {

    test('kill switch hides all chat UI', async ({ page }) => {
      // Arrange: Mock feature flags with chat disabled
      await mockFeatureFlags(page, {
        chatEnabled: false,
        chatBetaPeriod: false,
        chatBetaAccess: false,
      });

      await page.goto('/dashboard');

      // Assert: No chat UI elements exist
      await expect(page.getByTestId('chat-trigger-button')).not.toBeVisible();
      await expect(page.getByTestId('chat-coming-soon-badge')).not.toBeVisible();
      await expect(page.getByTestId('chat-panel')).not.toBeAttached();
    });

    test('non-beta user during beta sees coming soon badge', async ({ page }) => {
      // Arrange: Beta period active, user has no access
      await mockFeatureFlags(page, {
        chatEnabled: true,
        chatBetaPeriod: true,
        chatBetaAccess: false,
      });

      await page.goto('/dashboard');

      // Assert: Coming soon badge visible, trigger hidden
      await expect(page.getByTestId('chat-coming-soon-badge')).toBeVisible();
      await expect(page.getByTestId('chat-trigger-button')).not.toBeVisible();
    });

    test('beta user during beta can open chat with feedback widget', async ({ page }) => {
      // Arrange: Beta period active, user has access
      await mockFeatureFlags(page, {
        chatEnabled: true,
        chatBetaPeriod: true,
        chatBetaAccess: true,
      });

      await page.goto('/dashboard');

      // Act: Open chat panel
      await page.getByTestId('chat-trigger-button').click();

      // Assert: Panel opens with feedback widget
      await expect(page.getByTestId('chat-panel')).toBeVisible();
      await expect(page.getByTestId('beta-feedback-widget')).toBeVisible();
    });

    test('any user post-GA sees normal chat without beta UI', async ({ page }) => {
      // Arrange: GA mode (beta period = false)
      await mockFeatureFlags(page, {
        chatEnabled: true,
        chatBetaPeriod: false,
        chatBetaAccess: false, // Doesn't matter post-GA
      });

      await page.goto('/dashboard');

      // Act: Open chat panel
      await page.getByTestId('chat-trigger-button').click();

      // Assert: Normal chat, no beta UI
      await expect(page.getByTestId('chat-panel')).toBeVisible();
      await expect(page.getByTestId('beta-feedback-widget')).not.toBeVisible();
      await expect(page.getByTestId('chat-coming-soon-badge')).not.toBeVisible();
    });

    test('beta user can submit quick feedback', async ({ page }) => {
      // Arrange: Beta mode with access
      await mockFeatureFlags(page, {
        chatEnabled: true,
        chatBetaPeriod: true,
        chatBetaAccess: true,
      });

      // Mock feedback API
      let feedbackSubmitted = false;
      await page.route('**/api/chat/feedback', async (route) => {
        feedbackSubmitted = true;
        await route.fulfill({ status: 200, json: { success: true } });
      });

      await page.goto('/dashboard');
      await page.getByTestId('chat-trigger-button').click();

      // Act: Submit thumbs up
      await page.getByTestId('feedback-thumbs-up').click();

      // Assert: Feedback was submitted
      await expect(feedbackSubmitted).toBe(true);
    });
  });

  // =========================================================================
  // REGRESSION SUITE - Run nightly
  // =========================================================================

  test.describe('Regression Suite', () => {

    test('rate limit error displays upgrade prompt', async ({ page }) => {
      // Arrange: Mock rate limit exceeded response
      await mockFeatureFlags(page, {
        chatEnabled: true,
        chatBetaPeriod: false,
        rateLimitTier: 'free',
      });

      await page.route('**/api/chat/stream', async (route) => {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
          body: `event: error\ndata: {"type":"rate_limit_exceeded","limit":50,"usage":50}\n\n`,
        });
      });

      await page.goto('/dashboard');
      await page.getByTestId('chat-trigger-button').click();
      await page.getByTestId('chat-input').fill('Hello');
      await page.getByTestId('chat-submit').click();

      // Assert: Rate limit message shown
      await expect(page.getByText(/monthly.*limit.*reached/i)).toBeVisible();
      await expect(page.getByText(/upgrade/i)).toBeVisible();
    });

    test('expanded feedback form submits text', async ({ page }) => {
      await mockFeatureFlags(page, {
        chatEnabled: true,
        chatBetaPeriod: true,
        chatBetaAccess: true,
      });

      let capturedFeedback: any = null;
      await page.route('**/api/chat/feedback', async (route) => {
        capturedFeedback = route.request().postDataJSON();
        await route.fulfill({ status: 200, json: { success: true } });
      });

      await page.goto('/dashboard');
      await page.getByTestId('chat-trigger-button').click();

      // Open expanded feedback form
      await page.getByTestId('feedback-expand-button').click();
      await expect(page.getByTestId('feedback-form')).toBeVisible();

      // Fill and submit
      await page.getByTestId('feedback-textarea').fill('Great feature!');
      await page.getByTestId('feedback-submit').click();

      // Assert
      expect(capturedFeedback).toMatchObject({
        feedback_type: 'text',
        text: 'Great feature!',
      });
    });

    test('flag changes update UI without refresh', async ({ page }) => {
      // Start with beta blocked
      await mockFeatureFlags(page, {
        chatEnabled: true,
        chatBetaPeriod: true,
        chatBetaAccess: false,
      });

      await page.goto('/dashboard');
      await expect(page.getByTestId('chat-coming-soon-badge')).toBeVisible();

      // Simulate flag update via polling/websocket
      await mockFeatureFlags(page, {
        chatEnabled: true,
        chatBetaPeriod: true,
        chatBetaAccess: true,
      });

      // Trigger re-fetch (depends on implementation)
      await page.waitForTimeout(5000); // Or trigger manual refresh

      // Assert: UI updated
      await expect(page.getByTestId('chat-trigger-button')).toBeVisible();
    });
  });
});
```

### Page Object Pattern

```typescript
// e2e/feature-flags/page-objects/ChatPage.ts
import { Page, Locator } from '@playwright/test';

export class ChatPage {
  readonly page: Page;
  readonly triggerButton: Locator;
  readonly comingSoonBadge: Locator;
  readonly chatPanel: Locator;
  readonly feedbackWidget: Locator;
  readonly chatInput: Locator;
  readonly chatSubmit: Locator;

  constructor(page: Page) {
    this.page = page;
    this.triggerButton = page.getByTestId('chat-trigger-button');
    this.comingSoonBadge = page.getByTestId('chat-coming-soon-badge');
    this.chatPanel = page.getByTestId('chat-panel');
    this.feedbackWidget = page.getByTestId('beta-feedback-widget');
    this.chatInput = page.getByTestId('chat-input');
    this.chatSubmit = page.getByTestId('chat-submit');
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async openChat() {
    await this.triggerButton.click();
    await this.chatPanel.waitFor({ state: 'visible' });
  }

  async sendMessage(message: string) {
    await this.chatInput.fill(message);
    await this.chatSubmit.click();
  }

  async isChatAvailable(): Promise<boolean> {
    return await this.triggerButton.isVisible();
  }

  async isInBetaMode(): Promise<boolean> {
    const feedbackVisible = await this.feedbackWidget.isVisible();
    return feedbackVisible;
  }
}
```

### Feature Flag Mock Fixtures

```typescript
// e2e/feature-flags/fixtures/feature-flag-mocks.ts
import { Page } from '@playwright/test';

export interface FeatureFlagState {
  chatEnabled: boolean;
  chatBetaPeriod: boolean;
  chatBetaAccess: boolean;
  rateLimitTier?: 'free' | 'paid' | 'unlimited';
  voiceEnabled?: boolean;
}

export async function mockFeatureFlags(page: Page, flags: FeatureFlagState) {
  // Mock the feature flags API endpoint
  await page.route('**/api/feature-flags', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        chat_enabled: flags.chatEnabled,
        chat_beta_period: flags.chatBetaPeriod,
        chat_beta_access: flags.chatBetaAccess,
        chat_rate_limit_tier: flags.rateLimitTier ?? 'free',
        chat_voice_enabled: flags.voiceEnabled ?? true,
      },
    });
  });

  // Also mock Supabase RPC if used directly
  await page.route('**/rest/v1/rpc/get_user_feature_flags*', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        chat_enabled: flags.chatEnabled,
        chat_beta_period: flags.chatBetaPeriod,
        chat_beta_access: flags.chatBetaAccess,
        chat_rate_limit_tier: flags.rateLimitTier ?? 'free',
        chat_voice_enabled: flags.voiceEnabled ?? true,
      },
    });
  });
}

// Preset configurations for common scenarios
export const FLAG_PRESETS = {
  KILL_SWITCH_ON: {
    chatEnabled: false,
    chatBetaPeriod: false,
    chatBetaAccess: false,
  },
  BETA_NO_ACCESS: {
    chatEnabled: true,
    chatBetaPeriod: true,
    chatBetaAccess: false,
  },
  BETA_WITH_ACCESS: {
    chatEnabled: true,
    chatBetaPeriod: true,
    chatBetaAccess: true,
  },
  GA_MODE: {
    chatEnabled: true,
    chatBetaPeriod: false,
    chatBetaAccess: false,
  },
} as const;
```

---

## 3. Cypress Test Patterns (Alternative)

```typescript
// cypress/e2e/feature-flags.cy.ts

describe('Feature Flags & Beta Rollout', () => {

  beforeEach(() => {
    cy.intercept('GET', '/api/feature-flags', { fixture: 'flags-ga.json' }).as('getFlags');
  });

  describe('Smoke Suite', { tags: '@smoke' }, () => {

    it('kill switch hides all chat UI', () => {
      cy.intercept('GET', '/api/feature-flags', {
        chat_enabled: false,
        chat_beta_period: false,
        chat_beta_access: false,
      }).as('getFlags');

      cy.visit('/dashboard');
      cy.wait('@getFlags');

      cy.getByTestId('chat-trigger-button').should('not.exist');
      cy.getByTestId('chat-coming-soon-badge').should('not.exist');
    });

    it('non-beta user during beta sees coming soon', () => {
      cy.intercept('GET', '/api/feature-flags', {
        chat_enabled: true,
        chat_beta_period: true,
        chat_beta_access: false,
      }).as('getFlags');

      cy.visit('/dashboard');
      cy.wait('@getFlags');

      cy.getByTestId('chat-coming-soon-badge').should('be.visible');
      cy.getByTestId('chat-trigger-button').should('not.exist');
    });

    it('beta user can open chat and see feedback widget', () => {
      cy.intercept('GET', '/api/feature-flags', {
        chat_enabled: true,
        chat_beta_period: true,
        chat_beta_access: true,
      }).as('getFlags');

      cy.visit('/dashboard');
      cy.wait('@getFlags');

      cy.getByTestId('chat-trigger-button').click();
      cy.getByTestId('chat-panel').should('be.visible');
      cy.getByTestId('beta-feedback-widget').should('be.visible');
    });

    it('beta user can submit quick feedback', () => {
      cy.intercept('GET', '/api/feature-flags', {
        chat_enabled: true,
        chat_beta_period: true,
        chat_beta_access: true,
      }).as('getFlags');

      cy.intercept('POST', '/api/chat/feedback', {
        statusCode: 200,
        body: { success: true },
      }).as('submitFeedback');

      cy.visit('/dashboard');
      cy.getByTestId('chat-trigger-button').click();
      cy.getByTestId('feedback-thumbs-up').click();

      cy.wait('@submitFeedback').its('request.body').should('have.property', 'feedback_type', 'thumbs_up');
    });
  });
});

// cypress/support/commands.ts
Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-testid="${testId}"]`);
});
```

---

## 4. Stable Selector Strategy

### Selector Hierarchy (Priority Order)

1. **Test IDs (Highest Priority)**
   ```typescript
   // Preferred - stable across refactors
   page.getByTestId('chat-trigger-button')
   ```

2. **Accessible Roles + Names**
   ```typescript
   // Good for accessibility testing
   page.getByRole('button', { name: 'Open chat' })
   ```

3. **Text Content (Use Sparingly)**
   ```typescript
   // Acceptable for static text
   page.getByText('Coming Soon')
   ```

4. **CSS Selectors (Avoid)**
   ```typescript
   // AVOID - brittle
   page.locator('.chat-btn.primary')
   ```

### Required Test IDs for AMA-437

| Component | Test ID | Purpose |
|-----------|---------|---------|
| Chat Trigger | `chat-trigger-button` | Main entry point |
| Coming Soon | `chat-coming-soon-badge` | Beta placeholder |
| Chat Panel | `chat-panel` | Main chat container |
| Chat Input | `chat-input` | Message input field |
| Chat Submit | `chat-submit` | Send message button |
| Feedback Widget | `beta-feedback-widget` | Beta feedback container |
| Thumbs Up | `feedback-thumbs-up` | Quick positive rating |
| Thumbs Down | `feedback-thumbs-down` | Quick negative rating |
| Feedback Form | `feedback-form` | Expanded text form |
| Feedback Textarea | `feedback-textarea` | Text input |
| Feedback Submit | `feedback-submit` | Submit button |

### Anti-Patterns to Avoid

```typescript
// BAD: CSS class selectors
page.locator('.MuiButton-root.chat-trigger')

// BAD: Complex XPath
page.locator('//div[@class="chat"]/button[1]')

// BAD: Index-based selectors
page.locator('button').nth(3)

// BAD: Unstable text that might be localized
page.getByText('Click here to chat with our AI assistant')
```

---

## 5. Data Seeding Approach

### Backend Test Data (Python/pytest)

```python
# tests/e2e/conftest.py - Feature flag configurations

@dataclass
class FakeFeatureFlagService:
    """In-memory feature flag service for E2E tests."""

    chat_enabled: bool = True
    chat_beta_period: bool = False
    user_beta_access: Dict[str, bool] = field(default_factory=dict)
    user_rate_tiers: Dict[str, str] = field(default_factory=dict)

    def configure_kill_switch(self, enabled: bool = False):
        """Configure kill switch state."""
        self.chat_enabled = enabled

    def configure_beta_period(self, active: bool, users: List[str] = None):
        """Configure beta period with specific beta users."""
        self.chat_beta_period = active
        if users:
            for user_id in users:
                self.user_beta_access[user_id] = True

    def configure_rate_tier(self, user_id: str, tier: str):
        """Set rate limit tier for a user."""
        self.user_rate_tiers[user_id] = tier
```

### Frontend Test Data (Playwright)

```typescript
// e2e/fixtures/test-users.ts

export const TEST_USERS = {
  BETA_USER: {
    id: 'user_beta_test_001',
    email: 'beta@test.amakaflow.com',
    hasBetaAccess: true,
  },
  NON_BETA_USER: {
    id: 'user_regular_test_002',
    email: 'regular@test.amakaflow.com',
    hasBetaAccess: false,
  },
  PAID_USER: {
    id: 'user_paid_test_003',
    email: 'paid@test.amakaflow.com',
    rateTier: 'paid',
  },
} as const;

// Mock user auth state
export async function loginAsUser(page: Page, user: typeof TEST_USERS[keyof typeof TEST_USERS]) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      json: { user: { id: user.id, email: user.email } },
    });
  });
}
```

### Database Seeding for Integration Tests

```sql
-- migrations/seed_test_feature_flags.sql

-- Global flags (for test environment)
INSERT INTO feature_flags (flag_key, flag_value, scope, environment)
VALUES
  ('chat_enabled', 'true', 'global', 'test'),
  ('chat_beta_period', 'true', 'global', 'test')
ON CONFLICT (flag_key, scope, user_id) DO UPDATE SET flag_value = EXCLUDED.flag_value;

-- Beta user flags
INSERT INTO feature_flags (flag_key, flag_value, scope, user_id, environment)
VALUES
  ('chat_beta_access', 'true', 'user', 'user_beta_test_001', 'test')
ON CONFLICT (flag_key, scope, user_id) DO UPDATE SET flag_value = EXCLUDED.flag_value;
```

---

## 6. Smoke vs Regression Suite Split

### Smoke Suite (PR Checks)
**Target:** 5-7 tests, < 30 seconds total

| Test | Journey | Priority |
|------|---------|----------|
| Kill switch blocks all chat UI | #4 | P0 |
| Non-beta user sees coming soon | #1 | P0 |
| Beta user can open chat | #2 | P0 |
| Beta user sees feedback widget | #2 | P0 |
| Post-GA user sees normal chat | #3 | P0 |

### Regression Suite (Nightly)
**Target:** 20+ tests, < 5 minutes total

| Test Category | Count | Coverage |
|---------------|-------|----------|
| Kill switch edge cases | 3 | Re-enable, override beta |
| Beta period transitions | 4 | Grant/revoke access, period end |
| Rate limit tiers | 5 | Free/paid/unlimited, upgrades |
| Feedback submission | 4 | Thumbs, text, multiple |
| Error recovery | 2 | Flag service failure |
| Flag combinations | 3 | Complex state combinations |

### pytest Markers

```ini
# pytest.ini
markers =
    smoke: Critical path tests for PR checks (fast)
    feature_flags: Full feature flag test suite (nightly)
    beta_rollout: Beta period specific tests
    rate_limits: Rate limit tier tests
```

### CI Configuration

```yaml
# .github/workflows/pr-checks.yml
jobs:
  smoke-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Smoke Tests
        run: pytest -m smoke --timeout=60 -x
        timeout-minutes: 2

# .github/workflows/nightly.yml
jobs:
  regression-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Full Regression
        run: pytest -m feature_flags --timeout=300
        timeout-minutes: 10
```

---

## 7. Flake Prevention Strategies

### Wait Patterns (DO)

```typescript
// GOOD: Explicit waits for conditions
await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 5000 });

// GOOD: Wait for network idle after navigation
await page.goto('/dashboard', { waitUntil: 'networkidle' });

// GOOD: Wait for specific API response
await page.waitForResponse(resp => resp.url().includes('/api/feature-flags'));
```

### Anti-Patterns (DON'T)

```typescript
// BAD: Arbitrary sleeps
await page.waitForTimeout(2000); // NEVER DO THIS

// BAD: Assuming immediate state changes
await button.click();
expect(panel).toBeVisible(); // May race!

// BAD: Not handling loading states
// Missing: await page.waitForLoadState('networkidle');
```

### Backend Flake Prevention

```python
# GOOD: Deterministic fake services
class FakeAIClient:
    def __init__(self):
        self.response_events = None  # Configure per test

    def stream_chat(self, ...):
        if self.response_events:
            yield from self.response_events
        # Never random, always deterministic

# BAD: Time-dependent assertions
import time
start = time.time()
# ... do something
assert time.time() - start < 1.0  # Flaky on slow CI!
```

---

## 8. Test Environment Requirements

### Environment Variables

```bash
# .env.test
ENVIRONMENT=test
SUPABASE_URL=https://test.supabase.co
SUPABASE_SERVICE_ROLE_KEY=test-key
CHAT_ENABLED=true  # Can be overridden per test
```

### Required Services

| Service | Test Mode | Notes |
|---------|-----------|-------|
| Supabase | Mocked (in-memory fakes) | No real DB calls |
| Anthropic API | Mocked (FakeAIClient) | Deterministic responses |
| Feature Flags | Mocked (FakeFeatureFlagService) | Configurable per test |

### Secrets Management

```yaml
# GitHub Actions secrets required
TEST_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
TEST_SUPABASE_KEY: ${{ secrets.TEST_SUPABASE_KEY }}
# Note: Production keys NEVER used in tests
```

---

## 9. Implementation Files

### Backend Tests
- `/Users/davidandrews/dev/AmakaFlow/amakaflow-dev-workspace/chat-api/tests/e2e/test_feature_flags_e2e.py`

### Key Components Referenced
- `/Users/davidandrews/dev/AmakaFlow/amakaflow-dev-workspace/chat-api/backend/services/feature_flag_service.py`
- `/Users/davidandrews/dev/AmakaFlow/amakaflow-dev-workspace/chat-api/application/use_cases/stream_chat.py`
- `/Users/davidandrews/dev/AmakaFlow/amakaflow-dev-workspace/chat-api/api/deps.py`

### Test Infrastructure
- `/Users/davidandrews/dev/AmakaFlow/amakaflow-dev-workspace/chat-api/tests/e2e/conftest.py`
- `/Users/davidandrews/dev/AmakaFlow/amakaflow-dev-workspace/chat-api/pytest.ini`

---

## 10. Appendix: Test Matrix

### Feature Flag State Matrix

| chat_enabled | chat_beta_period | chat_beta_access | Expected UI | Expected API |
|--------------|------------------|------------------|-------------|--------------|
| false | * | * | No UI | feature_disabled |
| true | false | * | Normal chat | Normal response |
| true | true | false | Coming soon badge | feature_disabled |
| true | true | true | Chat + feedback | Normal response |

### Rate Limit Tier Matrix

| Tier | Limit | At Limit Behavior |
|------|-------|-------------------|
| free | 50 | rate_limit_exceeded error |
| paid | 500 | rate_limit_exceeded error |
| unlimited | 999999 | Never blocked |
