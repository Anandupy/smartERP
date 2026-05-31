import { test, expect } from '@playwright/test';

/**
 * E2E tests for authentication flows.
 * These tests require the backend to be running.
 * Run with: pnpm test:e2e
 */

test.describe('Authentication', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');

    // Check page title
    await expect(page).toHaveTitle(/Sign In | EduOS/);

    // Check key elements
    await expect(page.getByRole('heading', { name: 'Welcome to EduOS' })).toBeVisible();
    await expect(page.getByLabel(/Email \/ Username \/ Phone/i)).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('shows validation errors on empty submit', async ({ page }) => {
    await page.goto('/login');

    // Submit without filling
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Validation errors should appear
    await expect(
      page.getByText('Email, username, or phone is required'),
    ).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('forgot password page renders', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    // Note: form is disabled (no backend endpoint)
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeDisabled();
  });

  test('unauthenticated user redirected from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to login (with redirect param)
    await expect(page).toHaveURL(/\/login/);
  });

  test('maintenance page is accessible without auth', async ({ page }) => {
    await page.goto('/maintenance');
    await expect(page.getByRole('heading', { name: 'System Maintenance' })).toBeVisible();
  });
});
