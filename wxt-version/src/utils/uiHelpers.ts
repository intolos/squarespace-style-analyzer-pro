// UI Helper Functions and Custom Modals
// Provides reusable UI utilities for the extension
import { platformStrings } from './platform';

export const UIHelpers = {
  // Custom Modal Functions
  customAlert(message: string): Promise<void> {
    return new Promise(resolve => {
      const overlay = document.getElementById('customModalOverlay')!;
      const title = document.getElementById('customModalTitle')!;
      const msg = document.getElementById('customModalMessage')!;
      const input = document.getElementById('customModalInput')!;
      const buttons = document.getElementById('customModalButtons')!;

      title.textContent = 'Notice';
      msg.textContent = message;
      input.style.display = 'none';

      buttons.innerHTML =
        '<button class="custom-modal-btn custom-modal-btn-primary" id="customModalOk">OK</button>';

      overlay.style.display = 'flex';

      const okBtn = document.getElementById('customModalOk');
      if (okBtn) {
        okBtn.onclick = () => {
          overlay.style.display = 'none';
          resolve();
        };
      }
    });
  },

  customConfirm(
    message: string,
    titleText: string = 'Confirm',
    showCheckbox: boolean = false,
    checkboxText: string = 'Do not show this message again.'
  ): Promise<{ confirmed: boolean; checkboxChecked: boolean }> {
    return new Promise(resolve => {
      const overlay = document.getElementById('customModalOverlay')!;
      const title = document.getElementById('customModalTitle')!;
      const msg = document.getElementById('customModalMessage')!;
      const input = document.getElementById('customModalInput')!;
      const buttons = document.getElementById('customModalButtons')!;

      title.textContent = titleText;
      msg.textContent = message;
      input.style.display = 'none';

      let buttonsHtml = `
        <button class="custom-modal-btn custom-modal-btn-secondary" id="customModalCancel">Cancel</button>
        <button class="custom-modal-btn custom-modal-btn-danger" id="customModalConfirm">Confirm</button>
      `;

      if (titleText === 'Analyze Entire Domain') {
        const header = title.parentElement;
        if (header) header.classList.add('confirm-modal-header');

        if (!showCheckbox) {
          buttons.classList.add('confirm-buttons-gap-free');
        } else {
          // Add specific class for confirm modal padding and button wrapping
          buttons.classList.add('custom-modal-buttons-wrap');
        }
      }

      if (showCheckbox) {
        buttonsHtml =
          `
        <div style="margin-top: 6px; margin-bottom: 9px; width: 100%; text-align: left;">
          <input type="checkbox" id="customModalCheckbox" style="margin: 0 8px 0 0; cursor: pointer; width: 16px; height: 16px; vertical-align: middle;">
          <label for="customModalCheckbox" style="font-size: 0.85rem; cursor: pointer; color: #4a5568; vertical-align: middle; display: inline-block;">${checkboxText}</label>
        </div>
        ` + buttonsHtml;
      }

      buttons.innerHTML = buttonsHtml;
      overlay.style.display = 'flex';

      const getCheckboxStatus = () => {
        if (!showCheckbox) return false;
        const cb = document.getElementById('customModalCheckbox') as HTMLInputElement;
        return cb ? cb.checked : false;
      };

      const confirmBtn = document.getElementById('customModalConfirm');
      if (confirmBtn) {
        confirmBtn.onclick = () => {
          overlay.style.display = 'none';
          const header = title.parentElement;
          if (header) header.classList.remove('confirm-modal-header');
          buttons.classList.remove('confirm-buttons-gap-free');
          buttons.classList.remove('custom-modal-buttons-wrap');
          resolve({ confirmed: true, checkboxChecked: getCheckboxStatus() });
        };
      }

      const cancelBtn = document.getElementById('customModalCancel');
      if (cancelBtn) {
        cancelBtn.onclick = () => {
          overlay.style.display = 'none';
          const header = title.parentElement;
          if (header) header.classList.remove('confirm-modal-header');
          buttons.classList.remove('confirm-buttons-gap-free');
          buttons.classList.remove('custom-modal-buttons-wrap');
          resolve({ confirmed: false, checkboxChecked: getCheckboxStatus() });
        };
      }
    });
  },

  customPrompt(message: string): Promise<string | null> {
    return new Promise(resolve => {
      const overlay = document.getElementById('customModalOverlay')!;
      const title = document.getElementById('customModalTitle')!;
      const msg = document.getElementById('customModalMessage')!;
      const input = document.getElementById('customModalInput') as HTMLInputElement;
      const buttons = document.getElementById('customModalButtons')!;

      title.textContent = 'Input Required';
      msg.textContent = message;
      input.style.display = 'block';
      input.value = '';

      buttons.innerHTML = `
        <button class="custom-modal-btn custom-modal-btn-secondary" id="customModalCancel">Cancel</button>
        <button class="custom-modal-btn custom-modal-btn-primary" id="customModalSubmit">Submit</button>
      `;

      overlay.style.display = 'flex';
      input.focus();

      const submit = () => {
        const value = input.value.trim();
        overlay.style.display = 'none';
        resolve(value || null);
      };

      const cancelBtn = document.getElementById('customModalCancel');
      if (cancelBtn) {
        cancelBtn.onclick = () => {
          overlay.style.display = 'none';
          resolve(null);
        };
      }

      const submitBtn = document.getElementById('customModalSubmit');
      if (submitBtn) {
        submitBtn.onclick = submit;
      }

      input.onkeypress = e => {
        if (e.key === 'Enter') submit();
      };
    });
  },

  showReviewModal(): Promise<{ dismissed: boolean }> {
    return new Promise(resolve => {
      const overlay = document.getElementById('customModalOverlay')!;
      const title = document.getElementById('customModalTitle')!;
      const msg = document.getElementById('customModalMessage')!;
      const input = document.getElementById('customModalInput')!;
      const buttons = document.getElementById('customModalButtons')!;

      title.textContent = 'Are You Ready to Offer Your Review?';

      msg.innerHTML = `
        <div style="color: #0c4a6e; font-size: 0.9rem; line-height: 1.5; text-align: center;">
          <p><strong>If you feel this extension has real value for you</strong>, we kindly request you <a href="${platformStrings.reviewUrl}" target="_blank" style="color: #0369a1; text-decoration: underline; font-weight: 600;"><strong>Add Your Review in the Web Store</strong></a>.</p>
          <p><span style="color: #F5C518; font-size: 18px; line-height: 1;">★★★★★</span></p>
          <p>If you would like us to show your Success Story on our extension’s “<a href="${platformStrings.benefitsUrl}" target="_blank" style="color: #0369a1; text-decoration: underline; font-weight: 600;">Benefits</a>” page, with a <strong>link to you</strong>, please also send it to us by email.</p>
          <p style="font-size: 0.85rem; color: #4a5568;">Note: You can always find the Review link and our email near the bottom of the extension popup.</p>
        </div>
      `;

      input.style.display = 'none';

      const buttonsHtml = `
        <div id="reviewCheckboxRow" style="display: flex; align-items: center; gap: 8px; justify-content: flex-start; width: 100%;">
          <input type="checkbox" id="reviewModalCheckbox" style="cursor: pointer; width: 16px; height: 16px;">
          <label for="reviewModalCheckbox" style="font-size: 0.85rem; cursor: pointer; color: #4a5568;">Do not show this popup again.</label>
        </div>
        <button class="custom-modal-btn custom-modal-btn-primary" id="customModalClose" style="width: 100%">Close</button>
      `;

      buttons.innerHTML = buttonsHtml;
      overlay.style.display = 'flex';

      const closeBtn = document.getElementById('customModalClose');
      if (closeBtn) {
        closeBtn.onclick = () => {
          const cb = document.getElementById('reviewModalCheckbox') as HTMLInputElement;
          const dismissed = cb ? cb.checked : false;
          overlay.style.display = 'none';

          // Clear msg innerHTML and classes to prevent bleed over to other custom modals
          msg.innerHTML = '';
          const header = title.parentElement;
          if (header) header.classList.remove('confirm-modal-header');
          buttons.classList.remove('confirm-buttons-gap-free');

          resolve({ dismissed });
        };
      }
    });
  },

  // Message display functions
  showLoading(show: boolean): void {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = show ? 'block' : 'none';

    const analyzeBtn = document.getElementById('analyzeBtn') as HTMLButtonElement | null;
    if (analyzeBtn) analyzeBtn.disabled = show;
  },

  showError(message: string): void {
    // Hide the error div
    const errorEl = document.getElementById('error');
    if (errorEl) errorEl.style.display = 'none';

    // Use the success div but style it as an error
    const successEl = document.getElementById('success');
    if (successEl) {
      successEl.textContent = message;
      successEl.style.display = 'block';
      successEl.style.background = '#fed7d7';
      successEl.style.color = '#9b2c2c';
    }
  },

  showSuccess(message: string): void {
    const successEl = document.getElementById('success');
    if (successEl) {
      successEl.textContent = message;
      successEl.style.display = 'block';
      successEl.style.background = '#c6f6d5';
      successEl.style.color = '#22543d';
      successEl.style.visibility = 'visible';
      successEl.style.opacity = '1';
      successEl.style.position = 'relative';
      successEl.style.zIndex = '9999';

      // Force layout update (though usually not needed in modern browsers for this purpose unless for transitions)
      successEl.offsetHeight;

      console.log('✅ SUCCESS MESSAGE SHOWN:', message);
    }
  },

  hideMessages(): void {
    const successEl = document.getElementById('success');
    const errorEl = document.getElementById('error');

    if (successEl) {
      successEl.style.display = 'none';
      successEl.style.background = '#c6f6d5';
      successEl.style.color = '#22543d';
    }

    if (errorEl) {
      errorEl.style.display = 'none';
    }
  },
};

// Aliases for easier use if needed, but imports are preferred
export const customAlert = UIHelpers.customAlert;
export const customConfirm = UIHelpers.customConfirm;
export const customPrompt = UIHelpers.customPrompt;
export const showReviewModal = UIHelpers.showReviewModal;
