import { expect, test } from '@playwright/test'

test('uses the ITviec crimson palette in light and dark themes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/auth/login')

  const lightTokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement)
    return {
      action: styles.getPropertyValue('--color-action').trim(),
      canvas: styles.getPropertyValue('--color-canvas').trim(),
    }
  })

  expect(lightTokens).toEqual({ action: '#EA1E30', canvas: '#F8FAFC' })

  await page.emulateMedia({ colorScheme: 'dark' })

  const darkTokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement)
    return {
      action: styles.getPropertyValue('--color-action').trim(),
      canvas: styles.getPropertyValue('--color-canvas').trim(),
    }
  })

  expect(darkTokens).toEqual({ action: '#FF385C', canvas: '#0F172A' })
})
