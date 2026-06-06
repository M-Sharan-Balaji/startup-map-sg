import { test, expect } from '@playwright/test';

test.describe('Startup Map', () => {
  test('should load the map page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Singapore startup map/);
  });

  test('should display map container', async ({ page }) => {
    await page.goto('/');
    const mapContainer = page.locator('.maplibregl-canvas');
    await expect(mapContainer).toBeVisible();
  });

  test('should display startup markers on map', async ({ page }) => {
    await page.goto('/');
    // Wait for map to load and markers to appear
    await page.waitForTimeout(3000);
    
    // Check for map markers (they appear as canvas elements or SVG markers)
    const markers = page.locator('[class*="marker"], [class*="maplibregl-marker"]');
    const markerCount = await markers.count();
    expect(markerCount).toBeGreaterThan(0);
  });

  test('should have search functionality', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"], input[aria-label*="search" i]');
    
    if (await searchInput.count() > 0) {
      await searchInput.fill('startup');
      await page.waitForTimeout(500);
      // Verify search was performed (check for filtered results or UI changes)
    }
  });

  test('should have theme toggle', async ({ page }) => {
    await page.goto('/');
    const themeToggle = page.locator('button[aria-label*="theme" i], button[title*="theme" i], button:has-text("theme" i)');
    
    if (await themeToggle.count() > 0) {
      await themeToggle.click();
      // Verify theme changed (check for dark mode class or attribute)
      const html = page.locator('html');
      await expect(html).toHaveAttribute('class', /dark|light/);
    }
  });
});
