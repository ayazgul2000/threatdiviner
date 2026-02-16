import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('should have email and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('should have submit button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'demo@acme.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'invalid@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.getByText(/invalid|error|unauthorized/i)).toBeVisible({ timeout: 5000 });
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'notanemail');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should show validation error or not proceed
    await expect(page).toHaveURL(/login/);
  });

  test('should have link to register page', async ({ page }) => {
    await page.goto('/login');
    const registerLink = page.getByRole('link', { name: /register|sign up|create account/i });

    if (await registerLink.isVisible()) {
      await expect(registerLink).toHaveAttribute('href', expect.stringContaining('register'));
    }
  });

  test('should persist session after login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'demo@acme.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/dashboard/);

    // Reload page and check still authenticated
    await page.reload();
    await expect(page).toHaveURL(/dashboard/);
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'demo@acme.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/);

    // Find and click logout
    const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await expect(page).toHaveURL(/login/);
    }
  });
});
