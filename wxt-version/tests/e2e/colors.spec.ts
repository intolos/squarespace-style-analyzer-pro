import { test, expect } from './fixtures/extension';
import path from 'path';

test.describe('Color Report (@colors)', () => {
  test('should analyze colors and generate a style guide', async ({ context, extensionId }) => {
    // 1. Navigate to a test page in a target tab
    const targetPage = await context.newPage();
    await targetPage.goto('https://launchhappy.co/guides');
    await targetPage.waitForLoadState('domcontentloaded');

    // 2. Trigger color analysis via the popup in a separate tab
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Select "Analyze This Page"
    await popupPage.click('#analyzeBtn'); 

    // 3. Wait for analysis to complete on the popup page
    await expect(popupPage.locator('#success')).toBeVisible({ timeout: 60000 });
    
    const exportBtn = popupPage.locator('#exportStyleGuideBtn');
    await expect(exportBtn).toBeVisible();

    // 4. Download and capture the report
    const [download] = await Promise.all([
      popupPage.waitForEvent('download'),
      exportBtn.click(),
    ]);

    const reportPath = await download.path();
    expect(reportPath).toBeTruthy();

    // 5. Verify the report content
    const reportPage = await context.newPage();
    await reportPage.goto(`file://${reportPath}`);

    // Check for key elements in the report
    await expect(reportPage.locator('h1')).toContainText('Brand Style Guide');
    await expect(reportPage.locator('.score-circle')).toBeVisible();
    await expect(reportPage.locator('#accessibility-section')).toBeVisible();

    console.log('✅ Color Report E2E test passed!');
  });
});
