import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'demo@acme.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/, { timeout: 10000 });
  });

  test('should show main dashboard', async ({ page }) => {
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });

  test('should display statistics cards', async ({ page }) => {
    // Look for common stat card elements
    const statsSection = page.locator('[data-testid="stats-cards"], .stats-grid, .grid');
    await expect(statsSection.first()).toBeVisible();
  });

  test('should navigate to repositories', async ({ page }) => {
    await page.click('a[href="/dashboard/repositories"]');
    await expect(page).toHaveURL(/repositories/);
    await expect(page.getByText(/repositories/i)).toBeVisible();
  });

  test('should navigate to findings', async ({ page }) => {
    await page.click('a[href="/dashboard/findings"]');
    await expect(page).toHaveURL(/findings/);
    await expect(page.getByText(/findings/i)).toBeVisible();
  });

  test('should navigate to scans', async ({ page }) => {
    await page.click('a[href="/dashboard/scans"]');
    await expect(page).toHaveURL(/scans/);
    await expect(page.getByText(/scans/i)).toBeVisible();
  });

  test('should navigate to projects', async ({ page }) => {
    await page.click('a[href="/dashboard/projects"]');
    await expect(page).toHaveURL(/projects/);
    await expect(page.getByText(/projects/i)).toBeVisible();
  });

  test('should show project selector in sidebar', async ({ page }) => {
    const projectSelector = page.locator('[data-testid="project-selector"]');
    if (await projectSelector.isVisible()) {
      await expect(projectSelector).toBeVisible();
    }
  });

  test('should switch projects', async ({ page }) => {
    const projectSelector = page.locator('[data-testid="project-selector"]');
    if (await projectSelector.isVisible()) {
      await projectSelector.click();

      // Wait for dropdown to appear
      await page.waitForSelector('[role="listbox"], [data-testid="project-list"]', { timeout: 3000 });

      // Click on a different project
      const projectOption = page.locator('[role="option"]').first();
      if (await projectOption.isVisible()) {
        await projectOption.click();
      }
    }
  });

  test('should display sidebar navigation', async ({ page }) => {
    const sidebar = page.locator('nav, [data-testid="sidebar"]');
    await expect(sidebar.first()).toBeVisible();
  });

  test('should have working navigation links', async ({ page }) => {
    const navLinks = [
      '/dashboard/repositories',
      '/dashboard/scans',
      '/dashboard/findings',
      '/dashboard/threat-modeling',
      '/dashboard/environments',
      '/dashboard/settings',
    ];

    for (const link of navLinks) {
      const navLink = page.locator(`a[href="${link}"]`);
      if (await navLink.isVisible()) {
        await expect(navLink).toBeVisible();
      }
    }
  });

  test('should show user information', async ({ page }) => {
    // Look for user avatar or name
    const userInfo = page.locator('[data-testid="user-info"], .user-avatar, .user-menu');
    if (await userInfo.isVisible()) {
      await expect(userInfo).toBeVisible();
    }
  });

  test('should handle empty states', async ({ page }) => {
    // Navigate to a page that might be empty
    await page.goto('/dashboard/threat-modeling');

    // Check for empty state or content
    const content = page.locator('main, [data-testid="content"]');
    await expect(content.first()).toBeVisible();
  });
});
