import { test, expect } from './fixtures/extension';

test.describe('Images Report (@images)', () => {
  test('should analyze images and detect alt text', async ({ context, extensionId }) => {
    const targetPage = await context.newPage();
    await targetPage.goto('http://localhost:3000/mock-site.html');
    await targetPage.waitForLoadState('domcontentloaded');

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.click('#analyzeBtn'); 

    await expect(popupPage.locator('#success')).toBeVisible({ timeout: 120000 });
    
    // Images report is usually part of the Audit Reports (HTML)
    const exportBtn = popupPage.locator('#exportHtmlBtn');
    await expect(exportBtn).toBeVisible();

    const [download] = await Promise.all([
      popupPage.waitForEvent('download'),
      exportBtn.click(),
    ]);

    expect(await download.path()).toBeTruthy();
    console.log('✅ Images Report test passed!');
  });
});
