import { test, expect } from './fixtures/extension';

test.describe('Popup UI Elements (@popup)', () => {
  test('subscription buttons should be visible and clickable', async ({ context, extensionId }) => {
    // 1. Navigate to any page first (required for extension context)
    const targetPage = await context.newPage();
    await targetPage.goto('https://example.com');
    await targetPage.waitForLoadState('domcontentloaded');

    // 2. Open the popup
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

    // 3. Wait for the main interface to load
    await popupPage.waitForSelector('#mainInterface', { state: 'visible', timeout: 10000 });

    // 4. Check that both upgrade buttons are visible
    const yearlyBtn = popupPage.locator('#upgradeButton');
    const lifetimeBtn = popupPage.locator('#upgradeButtonLifetime');

    await expect(yearlyBtn).toBeVisible();
    await expect(lifetimeBtn).toBeVisible();

    // 5. Verify button text content
    await expect(yearlyBtn).toContainText('$19.99/Year');
    await expect(lifetimeBtn).toContainText('$29.99 Lifetime');

    // 6. Verify buttons are enabled (not disabled)
    await expect(yearlyBtn).not.toBeDisabled();
    await expect(lifetimeBtn).not.toBeDisabled();

    console.log('✅ Subscription buttons visibility test passed!');
  });

  test('check premium status button should be visible', async ({ context, extensionId }) => {
    const targetPage = await context.newPage();
    await targetPage.goto('https://example.com');
    await targetPage.waitForLoadState('domcontentloaded');

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

    await popupPage.waitForSelector('#mainInterface', { state: 'visible', timeout: 10000 });

    const checkStatusBtn = popupPage.locator('#checkStatusButton');
    await expect(checkStatusBtn).toBeVisible();
    await expect(checkStatusBtn).toContainText('Check Premium Status');

    console.log('✅ Check Premium Status button test passed!');
  });

  test('analyze buttons should be visible on popup load', async ({ context, extensionId }) => {
    const targetPage = await context.newPage();
    await targetPage.goto('https://example.com');
    await targetPage.waitForLoadState('domcontentloaded');

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

    await popupPage.waitForSelector('#mainInterface', { state: 'visible', timeout: 10000 });

    const analyzeBtn = popupPage.locator('#analyzeBtn');
    const analyzeDomainBtn = popupPage.locator('#analyzeDomainBtn');

    await expect(analyzeBtn).toBeVisible();
    await expect(analyzeDomainBtn).toBeVisible();

    await expect(analyzeBtn).toContainText('Analyze This Page');
    await expect(analyzeDomainBtn).toContainText('Analyze Entire Domain');

    console.log('✅ Analyze buttons visibility test passed!');
  });

  test('reset button should be visible after results exist', async ({ context, extensionId }) => {
    // This test verifies the reset button is present in the results section
    const targetPage = await context.newPage();
    await targetPage.goto('https://launchhappy.co');
    await targetPage.waitForLoadState('domcontentloaded');

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

    // Start analysis
    await popupPage.click('#analyzeBtn');

    // Wait for analysis to complete
    await expect(popupPage.locator('#success')).toBeVisible({ timeout: 60000 });

    // Check reset button is visible
    const resetBtn = popupPage.locator('#resetBtn');
    await expect(resetBtn).toBeVisible();
    await expect(resetBtn).toContainText('Reset');

    console.log('✅ Reset button visibility test passed!');
  });
});
