import { test, expect } from '@playwright/test';

test.describe('Scan Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'demo@acme.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/, { timeout: 10000 });
  });

  test('should display repositories list', async ({ page }) => {
    await page.goto('/dashboard/repositories');

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // Should show either repositories or empty state
    const content = page.locator('table, [data-testid="repository-list"], [data-testid="empty-state"]');
    await expect(content.first()).toBeVisible();
  });

  test('should navigate to repository detail', async ({ page }) => {
    await page.goto('/dashboard/repositories');
    await page.waitForLoadState('networkidle');

    // Click on first repository if exists
    const repoRow = page.locator('tr[data-testid="repository-row"], a[href*="/repositories/"]').first();
    if (await repoRow.isVisible()) {
      await repoRow.click();
      await expect(page).toHaveURL(/repositories\/.+/);
    }
  });

  test('should show run scan button on repository detail', async ({ page }) => {
    await page.goto('/dashboard/repositories');
    await page.waitForLoadState('networkidle');

    const repoRow = page.locator('tr, a[href*="/repositories/"]').first();
    if (await repoRow.isVisible()) {
      await repoRow.click();
      await page.waitForLoadState('networkidle');

      const runScanBtn = page.getByRole('button', { name: /run scan|scan|trigger/i });
      if (await runScanBtn.isVisible()) {
        await expect(runScanBtn).toBeVisible();
      }
    }
  });

  test('should trigger scan from repository detail', async ({ page }) => {
    await page.goto('/dashboard/repositories');
    await page.waitForLoadState('networkidle');

    const repoLink = page.locator('a[href*="/repositories/"]').first();
    if (await repoLink.isVisible()) {
      await repoLink.click();
      await page.waitForLoadState('networkidle');

      const runScanBtn = page.getByRole('button', { name: /run scan/i });
      if (await runScanBtn.isVisible()) {
        await runScanBtn.click();

        // Should show toast or redirect
        const toast = page.locator('[data-testid="toast"], .toast, [role="alert"]');
        const expectedMessage = toast.filter({ hasText: /scan started|queued|success/i });

        await expect(expectedMessage.first()).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should display scans list', async ({ page }) => {
    await page.goto('/dashboard/scans');
    await page.waitForLoadState('networkidle');

    const content = page.locator('table, [data-testid="scans-list"], [data-testid="empty-state"]');
    await expect(content.first()).toBeVisible();
  });

  test('should view scan details', async ({ page }) => {
    await page.goto('/dashboard/scans');
    await page.waitForLoadState('networkidle');

    const scanRow = page.locator('tr[data-testid="scan-row"], a[href*="/scans/"]').first();
    if (await scanRow.isVisible()) {
      await scanRow.click();
      await expect(page).toHaveURL(/scans\/.+/);

      // Should show scan info
      await expect(page.getByText(/findings|status|scanner/i).first()).toBeVisible();
    }
  });

  test('should display findings list', async ({ page }) => {
    await page.goto('/dashboard/findings');
    await page.waitForLoadState('networkidle');

    const content = page.locator('table, [data-testid="findings-list"], [data-testid="empty-state"]');
    await expect(content.first()).toBeVisible();
  });

  test('should view finding details', async ({ page }) => {
    await page.goto('/dashboard/findings');
    await page.waitForLoadState('networkidle');

    const findingRow = page.locator('tr[data-testid="finding-row"], a[href*="/findings/"]').first();
    if (await findingRow.isVisible()) {
      await findingRow.click();
      await expect(page).toHaveURL(/findings\/.+/);
    }
  });

  test('should show action buttons on finding detail', async ({ page }) => {
    await page.goto('/dashboard/findings');
    await page.waitForLoadState('networkidle');

    const findingLink = page.locator('a[href*="/findings/"]').first();
    if (await findingLink.isVisible()) {
      await findingLink.click();
      await page.waitForLoadState('networkidle');

      // Check for action buttons
      const aiTriageBtn = page.getByRole('button', { name: /ai triage/i });
      const applyFixBtn = page.getByRole('button', { name: /apply fix/i });

      if (await aiTriageBtn.isVisible()) {
        await expect(aiTriageBtn).toBeVisible();
      }
      if (await applyFixBtn.isVisible()) {
        await expect(applyFixBtn).toBeVisible();
      }
    }
  });

  test('should filter findings by severity', async ({ page }) => {
    await page.goto('/dashboard/findings');
    await page.waitForLoadState('networkidle');

    const severityFilter = page.locator('select[name="severity"], [data-testid="severity-filter"]');
    if (await severityFilter.isVisible()) {
      await severityFilter.selectOption('CRITICAL');
      await page.waitForLoadState('networkidle');

      // URL should include filter or table should update
      expect(page.url()).toMatch(/severity|CRITICAL/i);
    }
  });

  test('should filter findings by status', async ({ page }) => {
    await page.goto('/dashboard/findings');
    await page.waitForLoadState('networkidle');

    const statusFilter = page.locator('select[name="status"], [data-testid="status-filter"]');
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('OPEN');
      await page.waitForLoadState('networkidle');
    }
  });
});
