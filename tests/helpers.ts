import type { Page } from '@playwright/test';

export async function tapCanvas(page: Page, x: number, y: number) {
  const bounds = await page.locator('#game-canvas').boundingBox();
  if (!bounds) throw new Error('The game canvas is not visible');
  const px = bounds.x + x / 720 * bounds.width;
  const py = bounds.y + y / 640 * bounds.height;
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
    await page.touchscreen.tap(px, py);
  } else {
    await page.mouse.click(px, py);
  }
}
