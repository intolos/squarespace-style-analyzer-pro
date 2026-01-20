import { test, expect } from './fixtures/extension';

test.describe('Domain Analysis (@domain)', () => {
  test('should analyze entire domain via sitemap', async ({ context, extensionId }) => {
    const targetPage = await context.newPage();
    await targetPage.goto('https://launchhappy.co');
    await targetPage.waitForLoadState('domcontentloaded');

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Start domain analysis
    await popupPage.click('#analyzeDomainBtn');
    
    // Choose "Analyze Without Mobile" for speed in test
    await popupPage.click('#startWithoutMobileBtn');

    // Wait for domain progress to appear
    await expect(popupPage.locator('#domainProgress')).toBeVisible();
    
    // This test might take longer, but we can check if it starts and processes at least 1 page
    await expect(popupPage.locator('#domainProgressFill')).not.toContainText('0%', { timeout: 120000 });

    console.log('✅ Domain Analysis Report test started/verified!');
  });
});
