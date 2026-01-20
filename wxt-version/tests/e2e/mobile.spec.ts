import { test, expect } from './fixtures/extension';

test.describe('Mobile Report (@mobile)', () => {
  test('should analyze mobile usability', async ({ context, extensionId }) => {
    const targetPage = await context.newPage();
    await targetPage.goto('https://launchhappy.co/guides');
    await targetPage.waitForLoadState('domcontentloaded');

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.click('#analyzeBtn'); 

    await expect(popupPage.locator('#success')).toBeVisible({ timeout: 120000 });
    
    const exportBtn = popupPage.locator('#exportMobileReportBtn');
    await expect(exportBtn).toBeVisible();

    const [download] = await Promise.all([
      popupPage.waitForEvent('download'),
      exportBtn.click(),
    ]);

    expect(await download.path()).toBeTruthy();
    console.log('✅ Mobile Usability Report test passed!');
  });
});
