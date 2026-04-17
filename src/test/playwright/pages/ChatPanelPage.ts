/**
 * Page Object for ChatPanel component.
 *
 * Encapsulates selectors and common operations for voice input testing.
 * Use this pattern for maintainable E2E tests.
 */

import { Page, Locator, expect } from '@playwright/test';

export type VoiceState = 'idle' | 'requesting' | 'recording' | 'processing' | 'error';

export class ChatPanelPage {
  readonly page: Page;

  // Locators
  readonly triggerButton: Locator;
  readonly voiceButton: Locator;
  readonly textarea: Locator;
  readonly sendButton: Locator;
  readonly rateLimitIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.triggerButton = page.locator('[data-testid="chat-trigger-button"]');
    this.voiceButton = page.locator('[data-testid="chat-voice-button"]');
    this.textarea = page.locator('[data-testid="chat-input-textarea"]');
    this.sendButton = page.locator('[data-testid="chat-send-button"]');
    this.rateLimitIndicator = page.locator('[data-testid="chat-rate-limit"]');
  }

  /**
   * Open the ChatPanel if it's currently closed. ChatPanel is collapsed by
   * default — the trigger FAB toggles it. Idempotent: safe to call when
   * already open.
   */
  async openPanel(timeout = 15_000) {
    // The trigger FAB only exists while the panel is closed. Wait for EITHER
    // the FAB or the already-open voice button so we're resilient to both
    // states and to React-mount timing races.
    await this.page.locator(
      '[data-testid="chat-trigger-button"], [data-testid="chat-voice-button"]',
    ).first().waitFor({ state: 'visible', timeout });
    if (await this.triggerButton.isVisible().catch(() => false)) {
      // DevSystemStatus pill (position: fixed; bottom: 8; left: 8; z: 9999)
      // overlaps the FAB's click point on Desktop Chrome, so Playwright's
      // normal actionability check retries forever. Force-click since we
      // already confirmed visibility above.
      await this.triggerButton.click({ force: true });
    }
    await this.voiceButton.waitFor({ state: 'visible', timeout });
  }

  /**
   * Navigate to the app, open the ChatPanel, and wait for the voice button.
   */
  async goto() {
    await this.page.goto('/');
    await this.openPanel();
  }

  /**
   * Get current voice button state
   */
  async getVoiceState(): Promise<VoiceState> {
    return (await this.voiceButton.getAttribute('data-state')) as VoiceState;
  }

  /**
   * Wait for voice button to reach specific state
   */
  async waitForVoiceState(state: VoiceState, timeout = 10_000) {
    await expect(this.voiceButton)
      .toHaveAttribute('data-state', state, { timeout });
  }

  /**
   * Start voice recording
   */
  async startRecording() {
    await this.waitForVoiceState('idle');
    await this.voiceButton.click();
    await this.waitForVoiceState('recording');
  }

  /**
   * Stop voice recording and wait for processing to complete
   */
  async stopRecording() {
    await this.voiceButton.click();
    await this.waitForVoiceState('processing');
  }

  /**
   * Complete a full recording cycle
   */
  async completeRecording(recordDurationMs = 300) {
    await this.startRecording();
    await this.page.waitForTimeout(recordDurationMs);
    await this.stopRecording();
    await this.waitForVoiceState('idle');
  }

  /**
   * Cancel recording via right-click
   */
  async cancelRecording() {
    await this.voiceButton.click({ button: 'right' });
    await this.waitForVoiceState('idle');
  }

  /**
   * Get textarea value
   */
  async getTextareaValue(): Promise<string> {
    return this.textarea.inputValue();
  }

  /**
   * Set textarea value
   */
  async setTextareaValue(text: string) {
    await this.textarea.fill(text);
  }

  /**
   * Send the current message
   */
  async sendMessage() {
    await this.sendButton.click();
  }

  /**
   * Type and send a message
   */
  async sendMessageWithText(text: string) {
    await this.textarea.fill(text);
    await this.sendButton.click();
  }

  /**
   * Check if voice button is enabled
   */
  async isVoiceButtonEnabled(): Promise<boolean> {
    return this.voiceButton.isEnabled();
  }

  /**
   * Check if send button is enabled
   */
  async isSendButtonEnabled(): Promise<boolean> {
    return this.sendButton.isEnabled();
  }

  /**
   * Get voice button tooltip/title
   */
  async getVoiceButtonTooltip(): Promise<string | null> {
    return this.voiceButton.getAttribute('title');
  }

  /**
   * Check if voice button is visible (for browser support tests)
   */
  async isVoiceButtonVisible(): Promise<boolean> {
    return this.voiceButton.isVisible();
  }

  /**
   * Assert textarea has focus
   */
  async assertTextareaFocused() {
    await expect(this.textarea).toBeFocused();
  }

  /**
   * Assert recording indicator is visible
   */
  async assertRecordingIndicatorVisible() {
    await expect(this.voiceButton.locator('.animate-ping')).toBeVisible();
  }

  /**
   * Assert processing spinner is visible
   */
  async assertProcessingSpinnerVisible() {
    await expect(this.voiceButton.locator('.animate-spin')).toBeVisible();
  }

  /**
   * Mock the voice transcribe endpoint
   */
  async mockTranscribeEndpoint(response: object, options?: { status?: number; delay?: number }) {
    const { status = 200, delay = 0 } = options || {};

    await this.page.route('**/voice/transcribe', async (route) => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }

  /**
   * Intercept chat requests to detect if message was sent
   */
  async interceptChatRequests(): Promise<{ wasChatSent: () => boolean }> {
    let chatSent = false;

    await this.page.route('**/chat/**', async (route) => {
      chatSent = true;
      await route.continue();
    });

    return {
      wasChatSent: () => chatSent,
    };
  }
}
