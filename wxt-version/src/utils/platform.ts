export const isSqs = import.meta.env.VITE_IS_SQS_VERSION === 'true';

export const platformStrings = {
  productName: isSqs ? 'Squarespace Style Analyzer Pro' : 'Website Style Analyzer Pro',
  productNameShort: isSqs ? 'Squarespace Style Analyzer' : 'Website Style Analyzer',
  platformName: isSqs ? 'Squarespace' : 'Website',
  auditTitle: isSqs ? 'Professional Squarespace Design Audit' : 'Professional Website Design Audit',
  notSqsTitle: isSqs ? '⚠️ Not a Squarespace Site' : '',
  notSqsDescription: isSqs
    ? 'This extension works on all websites. However, it has 40 Squarespace-specific factors.'
    : '',
  showNotSqsWarning: isSqs,
  useCaseTitle: isSqs
    ? 'Why Would You Use Squarespace Style Analyzer Pro?'
    : 'Why Would You Use Website Style Analyzer Pro?',
  developerPlatform: isSqs ? 'Squarespace developer platform' : 'website CMS platform',
  detectionTitle: isSqs ? 'Quick Squarespace Detection' : '',
  showQuickDetection: isSqs,
  siteType: isSqs ? 'Squarespace site' : 'website',
  toolsBrand: isSqs ? 'Squarespace Tools' : 'Website Tools',
  benefitsUrl: isSqs
    ? 'https://intolos.github.io/squarespace-style-analyzer-pro/'
    : 'https://intolos.github.io/website-style-analyzer-pro/',
  shareUrl: isSqs
    ? 'https://chromewebstore.google.com/detail/squarespace-style-analyze/gmbkgehkgbgbdbiojcjgeipmcadbeopi'
    : 'https://chromewebstore.google.com/detail/website-style-analyzer/YOUR_GENERIC_ID_HERE',
  questionsEmail: isSqs ? 'webbyinsights+squarespace@gmail.com' : 'webbyinsights+website@gmail.com',
  developerBioTitle: isSqs
    ? 'Independent Developer of Squarespace Websites and This Browser Extension'
    : 'Independent Developer of Websites and This Browser Extension',
  developerBioBody: isSqs
    ? 'This browser extension, Squarespace Style Analyzer Pro, was created by Ed Mass, an independent developer of Squarespace websites and browser extensions, who has no employee or contractual affiliation with Squarespace. Ed Mass is a member of Squarespace Circle, a designation for Squarespace website developers.'
    : 'This browser extension, Website Style Analyzer Pro, was created by Ed Mass, an independent developer of websites and browser extensions.',
  filenameVariable: isSqs ? 'squarespace' : 'style-analyzer',
  reportTitle: isSqs ? 'Squarespace Style Analysis Report' : 'Website Style Analysis Report',
  stripe: isSqs
    ? {
        apiBase: 'https://squarespace-style-analyzer-pro.eamass.workers.dev',
        productIdYearly: 'prod_TOjJHIVm4hIXW0',
        priceIdYearly: 'price_1SRvr6Aoq9jsK93OKp1jn8d3',
        productIdLifetime: 'prod_TbiIroZ9oKQ8cT',
        priceIdLifetime: 'price_1SeUs2Aoq9jsK93OqaZJ8YIg',
        successUrlYearly:
          'https://intolos.github.io/squarespace-style-analyzer-pro/benefits-sqs/success-yearly.html?session_id={CHECKOUT_SESSION_ID}',
        successUrlLifetime:
          'https://intolos.github.io/squarespace-style-analyzer-pro/benefits-sqs/success-lifetime.html?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl:
          'https://intolos.github.io/squarespace-style-analyzer-pro/benefits-sqs/cancel.html',
      }
    : {
        apiBase: 'https://squarespace-style-analyzer-pro.eamass.workers.dev',
        productIdYearly: 'prod_TbGKBwiTIidhEo',
        priceIdYearly: 'price_1Se3o8Aoq9jsK93OSBuD5Y0M',
        productIdLifetime: 'prod_TbiWgdYfr2C63y',
        priceIdLifetime: 'price_1SeV5CAoq9jsK93OBZEQvb2q',
        successUrlYearly:
          'https://intolos.github.io/website-style-analyzer-pro/success-yearly.html?session_id={CHECKOUT_SESSION_ID}',
        successUrlLifetime:
          'https://intolos.github.io/website-style-analyzer-pro/success-lifetime.html?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://intolos.github.io/website-style-analyzer-pro/cancel.html',
      },
  favicon: isSqs
    ? 'https://intolos.github.io/squarespace-style-analyzer-pro/benefits-sqs/icon32.png'
    : 'https://intolos.github.io/website-style-analyzer-pro/icon32.png',
};
