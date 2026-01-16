User-Facing (HTML/UI):
For the file: entrypoints/popup/index.html

1. In this file, at the very bottom section it states "from Squarespace Tools". Remove that wording for the Squarespace Style Analyzer Pro extension.

2. Without the above wording that last section reads:
Title: "Independent Developer of Squarespace Websites and This Browser Extension"
"This browser extension, Squarespace Style Analyzer Pro, was created by Ed Mass, an independent developer of Squarespace websites and browser extensions, who has no employee or contractual affiliation with Squarespace. Ed Mass is a member of Squarespace Circle, a designation for Squarespace website developers."

For the Website Style Analyzer Pro, change it to:
Title:  "Independent Developer of Websites and This Browser Extension"
"This browser extension, Website Style Analyzer Pro, was created by Ed Mass, an independent developer of websites and browser extensions."

3. <p>Professional Squarespace Design Audit</p>

For the Website Style Analyzer Pro, change it to:
<p>Professional Website Design Audit</p>

4. For the Website Style Analyzer Pro, do not show this:
<div id="notSquarespace" class="not-squarespace" style="display: none;">
<strong>⚠️ Not a Squarespace Site</strong>
This extension works on all websites. However, it has over 15 Squarespace-specific factors...
checkIfSquarespace logic (in script, see below).
    
5. <div class="use-cases-section"> <h4>Why Would You Use Squarespace Style Analyzer Pro?</h4>

For the Website Style Analyzer Pro, change it to:
<div class="use-cases-section"> <h4>Why Would You Use Website Style Analyzer Pro?</h4>

6. For the Website Style Analyzer Pro, do not show this:
<h5>Quick Squarespace Detection</h5>
<p>Super quick to see if any website is a Squarespace site...</p>

Other Changes in the code:
7. src/export/htmlReports.ts:
Report Title generating: title: "Squarespace Style Analysis Report"

For the Website Style Analyzer Pro, change it to:
Report Title generating: title: "Website Style Analysis Report"

8. Do all exported filenames use the following format with a variable for the second portion?: [domain name] [variable here] [report name]
And the variable for Squarespace Style Analyzer Pro extension is: "squarespace", is that correct?

For the Website Style Analyzer Pro, is there currently a variable indicated? If so, what is it? If not, let's make it "style-analyzer"

9. In licensemanager.ts, there is a section for Squarespace Style Analyzer Pro:
export const LicenseManager = {
  // Configuration
  API_BASE: 'https://squarespace-style-analyzer-pro.eamass.workers.dev',
  PRODUCT_ID_YEARLY: 'prod_TOjJHIVm4hIXW0',
  PRICE_ID_YEARLY: 'price_1SRvr6Aoq9jsK93OKp1jn8d3',
  PRODUCT_ID_LIFETIME: 'prod_TbiIroZ9oKQ8cT',
  PRICE_ID_LIFETIME: 'price_1SeUs2Aoq9jsK93OqaZJ8YIg',
  SUCCESS_URL_YEARLY:
    'https://intolos.github.io/squarespace-style-analyzer-pro/benefits/success-yearly.html?session_id={CHECKOUT_SESSION_ID}',
  SUCCESS_URL_LIFETIME:
    'https://intolos.github.io/squarespace-style-analyzer-pro/benefits/success-lifetime.html?session_id={CHECKOUT_SESSION_ID}',
  CANCEL_URL: 'https://intolos.github.io/squarespace-style-analyzer-pro/benefits/cancel.html',

For the Website Style Analyzer Pro, this section is:
const LicenseManager = {
  // ============================================
  // EXTENSION-SPECIFIC CONFIGURATION
  // Change these values for each extension
  // ============================================
  API_BASE: "https://squarespace-style-analyzer-pro.eamass.workers.dev",
  // Product 1: Website Style Analyzer Pro (Yearly - $19.99/year)
  PRODUCT_ID_YEARLY: "prod_TbGKBwiTIidhEo",
  PRICE_ID_YEARLY: "price_1Se3o8Aoq9jsK93OSBuD5Y0M",
  // Product 2: Website Style Analyzer Pro, Lifetime ($29.99 one-time)
  PRODUCT_ID_LIFETIME: "prod_TbiWgdYfr2C63y",
  PRICE_ID_LIFETIME: "price_1SeV5CAoq9jsK93OBZEQvb2q",
  // Legacy: Keep the following line for backward compatibility
  PRODUCT_ID: "website-style-analyzer",
  SUCCESS_URL_YEARLY: "https://intolos.github.io/website-style-analyzer-pro/benefits/success-yearly.html?session_id={CHECKOUT_SESSION_ID}",
  SUCCESS_URL_LIFETIME: "https://intolos.github.io/website-style-analyzer-pro/benefits/success-lifetime.html?session_id={CHECKOUT_SESSION_ID}",
  CANCEL_URL: "https://intolos.github.io/website-style-analyzer-pro/benefits/cancel.html",



If there is anything in all of the above that is unclear ask me about it before taking action.



