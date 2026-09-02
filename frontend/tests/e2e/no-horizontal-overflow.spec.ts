import { test, expect } from '@playwright/test';
import { mockGameApis } from './helpers/gameApiMocks';

// Follow-up 2 de docs/ui-ux-audit-2026-04-11.md: sin overflow horizontal
// accidental en pantallas clave, por viewport del proyecto de Playwright.
const ROUTES = ['/', '/menu', '/rankings', '/profile', '/game/single?category=FLAG'];

test.describe('sin overflow horizontal', () => {
  for (const route of ROUTES) {
    test(`ruta ${route} no desborda el viewport`, async ({ page }) => {
      await mockGameApis(page);
      await page.goto(route);

      await expect(page.locator('body')).toBeVisible();
      await page.waitForLoadState('networkidle').catch(() => {});

      const overflow = await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const docWidth = document.documentElement.scrollWidth;
        const offenders: string[] = [];
        if (docWidth > viewportWidth + 1) {
          for (const el of Array.from(document.querySelectorAll('*'))) {
            const rect = el.getBoundingClientRect();
            if (rect.right > viewportWidth + 1 && rect.width > 1) {
              offenders.push(
                `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ').slice(0, 2).join('.')}` : ''} (right=${Math.round(rect.right)})`
              );
            }
          }
        }
        return { viewportWidth, docWidth, offenders: offenders.slice(0, 5) };
      });

      expect(
        overflow.docWidth,
        `scrollWidth ${overflow.docWidth} > viewport ${overflow.viewportWidth}. Culpables: ${overflow.offenders.join(', ')}`
      ).toBeLessThanOrEqual(overflow.viewportWidth + 1);
    });
  }
});
