import { expect, test } from '@playwright/test'

test('uses the owner-approved green palette in light and dark themes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/auth/login')

  const lightTokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement)
    return {
      action: styles.getPropertyValue('--color-action').trim(),
      canvas: styles.getPropertyValue('--color-canvas').trim(),
    }
  })

  expect(lightTokens).toEqual({ action: '#16A34A', canvas: '#F0FDF4' })

  await page.emulateMedia({ colorScheme: 'dark' })

  const darkTokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement)
    return {
      action: styles.getPropertyValue('--color-action').trim(),
      canvas: styles.getPropertyValue('--color-canvas').trim(),
    }
  })

  expect(darkTokens).toEqual({ action: '#4ADE80', canvas: '#022C22' })
})
