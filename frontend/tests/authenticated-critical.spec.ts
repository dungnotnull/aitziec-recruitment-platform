import { test, expect, type Page } from '@playwright/test'

type TestRole = 'CANDIDATE' | 'HR' | 'ADMIN'

const credentials: Record<TestRole, { email?: string; password?: string }> = {
  CANDIDATE: { email: process.env.E2E_CANDIDATE_EMAIL, password: process.env.E2E_CANDIDATE_PASSWORD },
  HR: { email: process.env.E2E_RECRUITER_EMAIL, password: process.env.E2E_RECRUITER_PASSWORD },
  ADMIN: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD },
}

async function login(page: Page, role: TestRole) {
  const account = credentials[role]
  if (!account.email || !account.password) {
    throw new Error(`Missing real ${role} E2E credentials`)
  }
  await page.goto('/auth/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).not.toHaveURL(/\/auth\/login/)
}

test.describe('real authenticated critical routes', () => {
  test('candidate can reach profile, CV, notification, AI, and recommendation routes', async ({ page }) => {
    test.skip(!credentials.CANDIDATE.email || !credentials.CANDIDATE.password, 'Real candidate credentials are required')
    await login(page, 'CANDIDATE')

    for (const path of ['/profile', '/candidate/cvs', '/notifications', '/candidate/ai', '/candidate/recommendations']) {
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()
      await expect(page).not.toHaveURL(/\/auth\/login/)
    }
  })

  test('recruiter can reach the company and job workspaces', async ({ page }) => {
    test.skip(!credentials.HR.email || !credentials.HR.password, 'Real recruiter credentials are required')
    await login(page, 'HR')

    for (const path of ['/company', '/recruiter/workspace']) {
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()
      await expect(page).not.toHaveURL(/\/auth\/login/)
    }
  })

  test('administrator can reach moderation and redacted audit routes', async ({ page }) => {
    test.skip(!credentials.ADMIN.email || !credentials.ADMIN.password, 'Real administrator credentials are required')
    await login(page, 'ADMIN')

    for (const path of ['/admin', '/admin/audit']) {
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()
      await expect(page).not.toHaveURL(/\/auth\/login/)
    }
  })
})
