// ui-helpers.js - UI Helper Functions and Custom Modals
// Provides reusable UI utilities for the extension

const UIHelpers = {
  // Custom Modal Functions
  customAlert: function (message) {
    return new Promise(resolve => {
      const overlay = document.getElementById('customModalOverlay');
      const title = document.getElementById('customModalTitle');
      const msg = document.getElementById('customModalMessage');
      const input = document.getElementById('customModalInput');
      const buttons = document.getElementById('customModalButtons');

      title.textContent = 'Notice';
      msg.textContent = message;
      input.style.display = 'none';

      buttons.innerHTML =
        '<button class="custom-modal-btn custom-modal-btn-primary" id="customModalOk">OK</button>';

      overlay.style.display = 'flex';

      document.getElementById('customModalOk').onclick = () => {
        overlay.style.display = 'none';
        resolve();
      };
    });
  },

  customConfirm: function (message, titleText = 'Confirm') {
    return new Promise(resolve => {
      const overlay = document.getElementById('customModalOverlay');
      const title = document.getElementById('customModalTitle');
      const msg = document.getElementById('customModalMessage');
      const input = document.getElementById('customModalInput');
      const buttons = document.getElementById('customModalButtons');

      title.textContent = titleText;
      msg.textContent = message;
      input.style.display = 'none';

      buttons.innerHTML = `
        <button class="custom-modal-btn custom-modal-btn-secondary" id="customModalCancel">Cancel</button>
        <button class="custom-modal-btn custom-modal-btn-danger" id="customModalConfirm">Confirm</button>
      `;

      overlay.style.display = 'flex';

      document.getElementById('customModalCancel').onclick = () => {
        overlay.style.display = 'none';
        resolve(false);
      };

      document.getElementById('customModalConfirm').onclick = () => {
        overlay.style.display = 'none';
        resolve(true);
      };
    });
  },

  customPrompt: function (message) {
    return new Promise(resolve => {
      const overlay = document.getElementById('customModalOverlay');
      const title = document.getElementById('customModalTitle');
      const msg = document.getElementById('customModalMessage');
      const input = document.getElementById('customModalInput');
      const buttons = document.getElementById('customModalButtons');

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

      document.getElementById('customModalCancel').onclick = () => {
        overlay.style.display = 'none';
        resolve(null);
      };

      document.getElementById('customModalSubmit').onclick = submit;

      input.onkeypress = e => {
        if (e.key === 'Enter') submit();
      };
    });
  },

  // Message display functions
  showLoading: function (show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) analyzeBtn.disabled = show;
  },

  showError: function (message) {
    // Hide the error div
    document.getElementById('error').style.display = 'none';

    // Use the success div but style it as an error
    var successEl = document.getElementById('success');
    successEl.textContent = message;
    successEl.style.display = 'block';
    successEl.style.background = '#fed7d7';
    successEl.style.color = '#9b2c2c';
  },

  showSuccess: function (message) {
    var successEl = document.getElementById('success');
    successEl.textContent = message;
    successEl.style.display = 'block';
    successEl.style.background = '#c6f6d5';
    successEl.style.color = '#22543d';
    successEl.style.visibility = 'visible';
    successEl.style.opacity = '1';
    successEl.style.position = 'relative';
    successEl.style.zIndex = '9999';

    successEl.offsetHeight;

    console.log('✅ SUCCESS MESSAGE SHOWN:', message);
  },

  hideMessages: function () {
    var successEl = document.getElementById('success');
    var errorEl = document.getElementById('error');

    successEl.style.display = 'none';
    successEl.style.background = '#c6f6d5';
    successEl.style.color = '#22543d';

    errorEl.style.display = 'none';
  },
};

// Make globally available
window.UIHelpers = UIHelpers;

// Also expose individual functions globally for backward compatibility
window.customAlert = UIHelpers.customAlert;
window.customConfirm = UIHelpers.customConfirm;
window.customPrompt = UIHelpers.customPrompt;
