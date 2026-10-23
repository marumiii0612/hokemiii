import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

test('standalone HTML needs no external assets and supports failure, restart and records offline', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  const networkRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.resourceType() !== 'document' && /^https?:/.test(request.url())) networkRequests.push(request.url()); });
  await page.addInitScript(() => { Math.random = () => 0; });
  // The managed test browser blocks file:// navigation. Fulfill only the HTML
  // document from disk; keep networking offline so external assets cannot load.
  const html = await readFile(resolve('dist/play.html'), 'utf8');
  const url = 'http://127.0.0.1:5173/offline-game.html';
  await page.route(url, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await page.context().setOffline(true);
  await page.goto(url);
  await expect(page.getByRole('button', { name: 'はじめる', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await expect(page.locator('#transition')).toBeHidden();
  await page.locator('#controls').getByRole('button', { name: '滋賀県' }).click();
  await expect(page.locator('#result-screen h1')).toHaveText('任務失敗。');
  await page.getByRole('button', { name: 'もう一度、潜入する' }).click();
  await expect(page.locator('#transition')).toBeHidden();
  await page.locator('#controls').getByRole('button', { name: '四国' }).click();
  await expect(page.locator('#transition-title')).toHaveText('任務完了');
  await page.reload();
  await expect(page.locator('#title-best')).toHaveText('01');
  expect(networkRequests).toEqual([]);
  expect(errors).toEqual([]);
});
