// Injected script to expose test harness functions to page context
// This runs in the page context, not the content script context

(function() {
  // Create message channel for test harness
  window.activateColorTestMode = function() {
    window.postMessage({ type: 'SSA_TEST_HARNESS', action: 'activate' }, '*');
  };
  
  window.deactivateColorTestMode = function() {
    window.postMessage({ type: 'SSA_TEST_HARNESS', action: 'deactivate' }, '*');
  };
  
  window.exportTestResults = async function() {
    window.postMessage({ type: 'SSA_TEST_HARNESS', action: 'export' }, '*');
  };
  
  window.getTestStats = function() {
    window.postMessage({ type: 'SSA_TEST_HARNESS', action: 'stats' }, '*');
  };
  
  window.clearTestResults = function() {
    window.postMessage({ type: 'SSA_TEST_HARNESS', action: 'clear' }, '*');
  };
  
  console.log('[SSA] Color detection test harness bridge loaded. Run activateColorTestMode() to start testing.');
})();