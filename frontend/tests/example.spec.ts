import { test, expect } from '@playwright/test';

test('opens the real public job discovery route', async ({ page }) => {
  await page.goto('/jobs');

  await expect(page).toHaveTitle(/ITZiec Recruitment Platform/);
  await expect(page.getByRole('heading', { name: 'Find Your Next Job' })).toBeVisible();
});

test('keeps guest search filters in the URL', async ({ page }) => {
  await page.goto('/jobs');
  await page.getByLabel('Keywords').fill('TypeScript');
  await page.getByLabel('Location').fill('Da Nang');
  await page.getByLabel('Experience level').selectOption('FRESHER');
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect(page).toHaveURL(/q=TypeScript/);
  expect(JSON.parse(new URL(page.url()).searchParams.get('location') ?? '[]')).toEqual(['Da Nang']);
  expect(JSON.parse(new URL(page.url()).searchParams.get('experienceLevel') ?? '[]')).toEqual(['FRESHER']);
});

test('redirects a guest away from authenticated routes', async ({ page }) => {
  await page.goto('/notifications');
  await expect(page).toHaveURL(/\/auth\/login/);
});

test('exposes accessible login validation without calling the API', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill('invalid-email');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Invalid email address')).toBeVisible();
  await expect(page.getByText('Password is required')).toBeVisible();
});

test('reflows public discovery at 320px without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/jobs');

  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);

  for (const name of ['Preview filters', 'Apply Filters', 'Reset']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});
