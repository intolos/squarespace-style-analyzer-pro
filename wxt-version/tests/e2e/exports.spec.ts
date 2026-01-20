import { test, expect } from './fixtures/extension';

test.describe('Export Formats (@exports)', () => {
  test('should verify all export buttons generate files', async ({ context, extensionId }) => {
    const targetPage = await context.newPage();
    await targetPage.goto('https://launchhappy.co/guides');
    await targetPage.waitForLoadState('domcontentloaded');

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.click('#analyzeBtn'); 

    await expect(popupPage.locator('#success')).toBeVisible({ timeout: 120000 });

    const formats = [
      { id: '#exportHtmlBtn', name: 'Audit Report' },
      { id: '#exportStyleGuideBtn', name: 'Style Guide' },
      { id: '#exportMobileReportBtn', name: 'Mobile Report' },
      { id: '#exportCsvBtn', name: 'CSV Export' }
    ];

    for (const format of formats) {
      const btn = popupPage.locator(format.id);
      await expect(btn).toBeVisible();
      
      const [download] = await Promise.all([
        popupPage.waitForEvent('download'),
        btn.click(),
      ]);
      
      expect(await download.path()).toBeTruthy();
      console.log(`✅ ${format.name} exported successfully!`);
    }

    console.log('✅ All Export Formats test passed!');
  });
});
