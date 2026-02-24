import { platformStrings, isSqs } from '../utils/platform';

export class PopupUIManager {
  static updateUI(analyzer: any, displayResultsCallback: () => void) {
    const upgradeNoticeEl = document.getElementById('upgradeNotice');
    const statusSection = document.getElementById('statusSection');
    const upgradeBtn = document.getElementById('upgradeButton') as HTMLButtonElement;
    const premiumButtonsGroup = document.getElementById('premiumButtonsGroup');
    const mainInterface = document.getElementById('mainInterface');
    const statusText = document.getElementById('statusText');

    const loader = document.getElementById('initialLoader');
    if (loader) loader.style.display = 'none';
    if (mainInterface) mainInterface.style.display = 'block';

    if (analyzer.isPremium) {
      document.body.classList.add('premium-active');
      if (statusSection) statusSection.remove(); // Remove from DOM completely so it cannot be shown

      if (upgradeNoticeEl) upgradeNoticeEl.style.display = 'none';
      if (statusText) statusText.style.display = 'none';

      // Do NOT modify upgrade buttons text/style - keep them as is (per user request)
      // Just ensure container has correct positioning class if needed
      if (premiumButtonsGroup) premiumButtonsGroup.classList.add('premium-position');

      // IMPORTANT: Reorder informational sections to surface the most relevant
      // content (Questions, Share) at the top for premium users on every popup open.
      this.reorderSectionsForPremium();

      // Update the "Check Status" button to reflect active state and type
      const checkStatusBtn = document.getElementById('checkStatusButton');
      if (checkStatusBtn) {
        let statusButtonText = '✅ Premium Activated';

        // Determine license type from stored data
        if (analyzer.licenseData && analyzer.licenseData.record) {
          // IMPORTANT: Check is_lifetime FIRST. If true, STOP immediately.
          // This ensures Lifetime status always overrides Yearly status in the UI.
          const isLifetime = analyzer.licenseData.record.is_lifetime === true;
          const isYearly = analyzer.licenseData.record.is_yearly === true;

          if (isLifetime) {
            statusButtonText += ' - Lifetime';
          } else if (isYearly) {
            statusButtonText += ' - Yearly';
          }
        }

        checkStatusBtn.textContent = statusButtonText;

        // Match color to subscription type
        const isBtnLifetime =
          analyzer.licenseData &&
          analyzer.licenseData.record &&
          analyzer.licenseData.record.is_lifetime === true;

        if (isBtnLifetime) {
          checkStatusBtn.style.background = '#44337a'; // Deep Purple for Lifetime
        } else {
          checkStatusBtn.style.background = '#14532d'; // Deep Emerald for Yearly/Active
        }

        checkStatusBtn.setAttribute('disabled', 'true');
      }
    } else {
      // Explicitly show status section only for non-premium users
      if (statusSection) statusSection.style.display = 'block';
      if (statusText) statusText.style.display = 'block';

      const usageCountEl = document.getElementById('usageCount');
      const usageProgressEl = document.getElementById('usageProgress');
      if (usageCountEl) usageCountEl.textContent = analyzer.usageCount.toString();
      if (usageProgressEl) usageProgressEl.style.width = (analyzer.usageCount / 3) * 100 + '%';

      if (analyzer.usageCount >= 3) {
        if (upgradeNoticeEl) upgradeNoticeEl.style.display = 'block';
        const analyzeBtn = document.getElementById('analyzeBtn') as HTMLButtonElement;
        const analyzeDomainBtn = document.getElementById('analyzeDomainBtn') as HTMLButtonElement;

        if (analyzeBtn) {
          analyzeBtn.disabled = true;
          analyzeBtn.textContent = '🔒 Upgrade Required';
        }
        if (analyzeDomainBtn) {
          analyzeDomainBtn.disabled = true;
          analyzeDomainBtn.textContent = '🔒 Upgrade Required';
        }
      }
    }

    if (analyzer.accumulatedResults) {
      displayResultsCallback();
    }
  }

  static updatePlatformBranding() {
    const set = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    const setHtml = (id: string, html: string) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    };
    const setAttr = (id: string, attr: string, value: string) => {
      const el = document.getElementById(id) as any;
      if (el) el[attr] = value;
    };

    set('uiAuditTitle', platformStrings.auditTitle);
    set('uiNotSqsTitle', platformStrings.notSqsTitle);
    set('uiNotSqsDescription', platformStrings.notSqsDescription);
    setAttr('uiBenefitsLink', 'href', platformStrings.benefitsUrl);
    set('uiUseCaseTitle', platformStrings.useCaseTitle);
    set('uiDevPlatform', platformStrings.developerPlatform);
    set('uiDetectionTitle', platformStrings.detectionTitle);
    set('uiSiteType', platformStrings.siteType);
    setAttr('uiShareLink', 'href', platformStrings.shareUrl);
    set('uiToolsBrand', platformStrings.toolsBrand);
    setHtml('uiDevBioTitle', platformStrings.developerBioTitle);
    setHtml('uiDevBioBody', platformStrings.developerBioBody);

    setAttr('uiContactEmail', 'href', `mailto:${platformStrings.questionsEmail}`);
    set('uiQuestionsEmail', platformStrings.questionsEmail); // For backwards compatibility or other uses if needed
    set('uiContactEmail', 'Contact Us by Email');
    setAttr('uiReviewLink', 'href', platformStrings.reviewUrl);
    setAttr('uiBenefitsLinkInText', 'href', platformStrings.benefitsUrl);

    if (!platformStrings.showQuickDetection) {
      const detectionTitleInfo = document.getElementById('uiDetectionTitle');
      if (detectionTitleInfo) {
        const parent = detectionTitleInfo.closest('.use-case-item');
        if (parent) {
          (parent as HTMLElement).style.display = 'none';
        }
      }
    }
  }

  static repositionMobileSectionForUser() {
    // Redundant now that order is static
  }

  static reorderSectionsForPremium(): void {
    const mainInterface = document.getElementById('mainInterface');
    if (!mainInterface) return;

    const premiumButtonsGroup = document.getElementById('premiumButtonsGroup');
    if (!premiumButtonsGroup) return;

    const allPremiumFeatureDivs = Array.from(
      mainInterface.querySelectorAll(':scope > .premium-features')
    );

    const questionsDiv = allPremiumFeatureDivs[2] as HTMLElement;
    const shareDiv = allPremiumFeatureDivs[1] as HTMLElement;
    const useCasesDiv = mainInterface.querySelector(':scope > .use-cases-section') as HTMLElement;
    const benefitsLink = document.getElementById('uiBenefitsLink');
    const premiumBenefitsDiv = allPremiumFeatureDivs[0] as HTMLElement;
    const developerDiv = mainInterface.querySelector(':scope > .developer-section') as HTMLElement;

    if (
      !questionsDiv ||
      !shareDiv ||
      !useCasesDiv ||
      !benefitsLink ||
      !premiumBenefitsDiv ||
      !developerDiv
    ) {
      console.warn('reorderSectionsForPremium: one or more target sections not found');
      return;
    }

    const insertBefore = (node: Node) => mainInterface.insertBefore(node, developerDiv);

    insertBefore(questionsDiv);
    insertBefore(shareDiv);
    insertBefore(useCasesDiv);
    insertBefore(benefitsLink);
    insertBefore(premiumBenefitsDiv);
  }

  static resetUpgradeButtons() {
    const yearlyBtn = document.getElementById('upgradeButton') as HTMLButtonElement;
    const lifetimeBtn = document.getElementById('upgradeButtonLifetime') as HTMLButtonElement;

    if (yearlyBtn) {
      yearlyBtn.disabled = false;
      yearlyBtn.textContent = '$19.99/Year for Unlimited Use';
      yearlyBtn.innerHTML = '$19.99/Year for Unlimited Use'; // Clear spinner
    }
    if (lifetimeBtn) {
      lifetimeBtn.style.display = 'inline-block';
      lifetimeBtn.disabled = false;
      lifetimeBtn.textContent = '$29.99 Lifetime for Unlimited Use Forever';
      lifetimeBtn.innerHTML = '$29.99 Lifetime for Unlimited Use Forever'; // Clear spinner
    }
  }

  static setPremiumBenefits(): void {
    const list = document.getElementById('premiumBenefitsList');
    if (!list) return;

    const commonItems = [
      'Full style detection',
      'Color palette extraction',
      'Brand Style Guide Typography',
      'Brand Style Guide Colors',
      'Headings analysis',
      'Paragraphs analysis',
      'Buttons analysis',
      'Images alt text analysis',
      'Check for generic image filenames',
      'CSV export for spreadsheet analysis',
      'HTML reports for beautiful presentations for so many design audit analyses in one place you will not find anywhere else',
      'Up to 12 reports generated depending on what is discovered on your website',
      'Priority support',
      'Lifetime updates',
    ];

    let versionBullet = '';
    if (isSqs) {
      versionBullet =
        'This extension works on all websites. However, it has 40 Squarespace-specific factors.';
    } else {
      versionBullet =
        'This extension works on all websites. In particular, it has 50 WordPress-specific factors including logic for the major builders of Elementor, Divi, and the native Gutenberg editor; 40 Squarespace-specific factors; 45 Wix-specific factors, 47 Shopify-specific factors; and 52 Webflow-specific factors. (If you use another development platform and want us to create the specific factors for it, use the contact info below.)';
    }

    const html = `
      <li>Unlimited website analyses</li>
      <li>Critical quality checks of over 80 aspects of design</li>
      <li>${versionBullet}</li>
      <li>Page-by-page analysis</li>
      <li>Full domain analysis via sitemap. For larger websites, you are able to select groups of pages, in the Premium feature of page selection, to analyze your entire site in sections if desired to save time.</li>
      ${commonItems.map(item => `<li>${item}</li>`).join('')}
    `;

    list.innerHTML = html;
  }

  static showPlatformBanner(message: string, postAnalysis: boolean): void {
    const preBanner = document.getElementById('platformDetectionBanner');
    const postBanner = document.getElementById('platformBannerPostAnalysis');

    if (preBanner) preBanner.style.display = 'none';
    if (postBanner) postBanner.style.display = 'none';

    if (postAnalysis) {
      const postMsg = document.getElementById('platformMessagePost');
      if (postBanner && postMsg) {
        postMsg.innerHTML = message;
        postBanner.style.display = 'block';
      }
    } else {
      const preMsg = document.getElementById('platformMessage');
      if (preBanner && preMsg) {
        preMsg.innerHTML = message;
        preBanner.style.display = 'block';
      }
    }
  }

  static hidePlatformBanners(): void {
    const preBanner = document.getElementById('platformDetectionBanner');
    const postBanner = document.getElementById('platformBannerPostAnalysis');
    if (preBanner) preBanner.style.display = 'none';
    if (postBanner) postBanner.style.display = 'none';
  }
}
