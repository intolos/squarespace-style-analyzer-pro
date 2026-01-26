import { test, expect } from './fixtures/extension';
import path from 'path';

test.describe('Content Report (@content)', () => {
  test('should analyze headings and generate an audit report', async ({ context, extensionId }) => {
    // 1. Navigate to a test page
    const targetPage = await context.newPage();
    await targetPage.goto('http://localhost:3000/mock-site.html');
    await targetPage.waitForLoadState('domcontentloaded');

    // 2. Trigger analysis
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.click('#analyzeBtn'); 

    // 3. Wait for analysis to complete
    await expect(popupPage.locator('#success')).toBeVisible({ timeout: 60000 });
    
    // Check if headings were actually found
    const headingsCount = await popupPage.locator('#headingsCount').textContent();
    expect(parseInt(headingsCount || '0')).toBeGreaterThan(0);

    // 4. Export the Audit Report
    const exportBtn = popupPage.locator('#exportHtmlBtn');
    await expect(exportBtn).toBeVisible();

    const [download] = await Promise.all([
      popupPage.waitForEvent('download'),
      exportBtn.click(),
    ]);

    const reportPath = await download.path();
    expect(reportPath).toBeTruthy();

    // 5. Verify the report content
    const reportPage = await context.newPage();
    await reportPage.goto(`file://${reportPath}`);

    // The audit report is a bit different, it might contain a combined view
    await expect(reportPage.locator('h1')).toContainText('Analysis Report');
    await expect(reportPage.locator('text=Quality Checks')).toBeVisible();

    console.log('✅ Content Report E2E test passed!');
  });
});
