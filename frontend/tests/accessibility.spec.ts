import { createRequire } from 'node:module'
import { test, expect } from '@playwright/test'

const require = createRequire(import.meta.url)
const axePath = require.resolve('axe-core/axe.min.js')

type AxeViolation = {
  id: string
  impact: string | null
  nodes: Array<{ target: string[]; failureSummary?: string }>
}

for (const colorScheme of ['light', 'dark'] as const) {
  for (const path of ['/jobs', '/auth/login', '/auth/register']) {
    test(`${path} has no serious accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      await page.goto(path)
      await page.addScriptTag({ path: axePath })
      const violations = await page.evaluate(async () => {
        const axe = (window as typeof window & {
          axe: { run: (root: Document, options: object) => Promise<{ violations: AxeViolation[] }> }
        }).axe
        const result = await axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] },
        })
        return result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      })

      expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
    })
  }
}
