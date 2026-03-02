/**
 * Page Object for WorkoutList component.
 *
 * Encapsulates selectors and common operations for workout delete testing.
 * Use this pattern for maintainable E2E tests.
 */

import { Page, Locator, expect } from '@playwright/test';

export class WorkoutsPage {
  readonly page: Page;

  // Filter locators
  readonly searchInput: Locator;
  readonly viewModeCards: Locator;
  readonly viewModeCompact: Locator;

  // Workout list
  readonly workoutList: Locator;

  // Delete confirmation dialog (single-workout delete via AlertDialog)
  readonly deleteDialog: Locator;
  readonly deleteDialogTitle: Locator;
  readonly deleteDialogDescription: Locator;
  readonly deleteDialogCancel: Locator;
  readonly deleteDialogConfirm: Locator;

  // Bulk delete controls
  readonly selectAllCheckbox: Locator;
  readonly bulkDeleteButton: Locator;
  readonly bulkDeleteModal: Locator;
  readonly bulkDeleteModalTitle: Locator;
  readonly bulkDeleteCancelButton: Locator;
  readonly bulkDeleteConfirmButton: Locator;

  // Loading and empty states
  readonly loadingSpinner: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;

    // Filter locators
    this.searchInput = page.locator('[data-testid="workout-search-input"]');
    this.viewModeCards = page.locator('[data-testid="view-mode-cards"]');
    this.viewModeCompact = page.locator('[data-testid="view-mode-compact"]');

    // Workout list
    this.workoutList = page.locator('[data-assistant-target="library-results"]');

    // Delete confirmation dialog (single-workout)
    this.deleteDialog = page.locator('[data-testid="delete-confirmation-dialog"]');
    this.deleteDialogTitle = page.locator('[data-testid="delete-confirmation-title"]');
    this.deleteDialogDescription = page.locator('[data-testid="delete-confirmation-description"]');
    this.deleteDialogCancel = page.locator('[data-testid="delete-confirmation-cancel"]');
    this.deleteDialogConfirm = page.locator('[data-testid="delete-confirmation-confirm"]');

    // Bulk delete controls
    this.selectAllCheckbox = page.locator('[data-testid="select-all-checkbox"]');
    this.bulkDeleteButton = page.locator('[data-testid="bulk-delete-button"]');
    this.bulkDeleteModal = page.locator('[data-testid="bulk-delete-modal"]');
    this.bulkDeleteModalTitle = page.locator('[data-testid="bulk-delete-modal-title"]');
    this.bulkDeleteCancelButton = page.locator('[data-testid="bulk-delete-cancel"]');
    this.bulkDeleteConfirmButton = page.locator('[data-testid="bulk-delete-confirm"]');

    // Loading and empty states
    this.loadingSpinner = page.locator('.animate-spin').first();
    this.emptyState = page.locator('text=No workouts yet');
  }

  /**
   * Navigate to the workouts page
   */
  async goto(path = '/') {
    await this.page.goto(path);
    // Wait for either loading to finish or workouts to appear
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for workouts to load
   */
  async waitForWorkoutsLoad(timeout = 15_000) {
    // Wait for loading spinner to disappear
    const spinner = this.page.locator('.animate-spin');
    if (await spinner.first().isVisible().catch(() => false)) {
      await spinner.first().waitFor({ state: 'hidden', timeout });
    }
    
    // Then wait for workout list to be visible
    await this.workoutList.waitFor({ state: 'visible', timeout });
  }

  /**
   * Get a workout item by ID
   */
  getWorkoutItem(workoutId: string): Locator {
    return this.page.locator(`[data-testid="workout-item-${workoutId}"]`);
  }

  /**
   * Get the delete button for a specific workout
   */
  getDeleteButton(workoutId: string): Locator {
    return this.page.locator(`[data-testid="workout-delete-${workoutId}"]`);
  }

  /**
   * Click delete button for a specific workout
   */
  async clickDeleteButton(workoutId: string) {
    const deleteButton = this.getDeleteButton(workoutId);
    await deleteButton.click();
  }

  /**
   * Wait for delete dialog to appear
   */
  async waitForDeleteDialog(timeout = 5_000) {
    await this.deleteDialog.waitFor({ state: 'visible', timeout });
  }

  /**
   * Confirm delete in the dialog
   */
  async confirmDelete() {
    await this.deleteDialogConfirm.click();
  }

  /**
   * Cancel delete in the dialog
   */
  async cancelDelete() {
    await this.deleteDialogCancel.click();
  }

  /**
   * Wait for delete dialog to close
   */
  async waitForDeleteDialogClose(timeout = 5_000) {
    await this.deleteDialog.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Wait for a workout to be removed from the list
   */
  async waitForWorkoutDeleted(workoutId: string, timeout = 5_000) {
    const workoutItem = this.getWorkoutItem(workoutId);
    await workoutItem.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Search for workouts
   */
  async search(query: string) {
    await this.searchInput.fill(query);
    // Wait for results to update
    await this.page.waitForTimeout(300);
  }

  /**
   * Switch to cards view
   */
  async switchToCardsView() {
    await this.viewModeCards.click();
  }

  /**
   * Switch to compact view
   */
  async switchToCompactView() {
    await this.viewModeCompact.click();
  }

  /**
   * Get count of visible workout items
   */
  async getWorkoutCount(): Promise<number> {
    return this.workoutList.locator('[data-testid^="workout-item-"]').count();
  }

  // ---------------------------------------------------------------------------
  // Bulk selection helpers
  // ---------------------------------------------------------------------------

  /**
   * Check (select) an individual workout by ID
   */
  async checkWorkout(workoutId: string) {
    const checkbox = this.page.locator(`[data-testid="workout-checkbox-${workoutId}"]`);
    await checkbox.check();
  }

  /**
   * Uncheck (deselect) an individual workout by ID
   */
  async uncheckWorkout(workoutId: string) {
    const checkbox = this.page.locator(`[data-testid="workout-checkbox-${workoutId}"]`);
    await checkbox.uncheck();
  }

  /**
   * Click the select-all checkbox (toggles between all-selected and all-deselected)
   */
  async clickSelectAll() {
    await this.selectAllCheckbox.click();
  }

  // ---------------------------------------------------------------------------
  // Bulk delete modal helpers
  // ---------------------------------------------------------------------------

  /**
   * Click the "Delete selected" button to open the bulk-delete confirmation modal
   */
  async openBulkDeleteModal() {
    await this.bulkDeleteButton.click();
  }

  /**
   * Wait for the bulk-delete confirmation modal to be visible
   */
  async waitForBulkDeleteModal(timeout = 5_000) {
    await this.bulkDeleteModal.waitFor({ state: 'visible', timeout });
  }

  /**
   * Wait for the bulk-delete confirmation modal to close
   */
  async waitForBulkDeleteModalClosed(timeout = 5_000) {
    await this.bulkDeleteModal.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Click the Cancel button inside the bulk-delete modal
   */
  async cancelBulkDelete() {
    await this.bulkDeleteCancelButton.click();
  }

  /**
   * Click the Delete (confirm) button inside the bulk-delete modal
   */
  async confirmBulkDelete() {
    await this.bulkDeleteConfirmButton.click();
  }
}
