# To-Do: Email Sending via Cloudflare Worker

**Created:** 2026-01-31  
**Priority:** Medium  
**Status:** On Hold

---

## Overview

The extension needs the ability to send email alerts to the developer when certain edge cases occur, such as when font size cannot be determined during accessibility analysis.

---

## Current State

### What Exists (Backup File Only)

The file `cloudflare/worker-backup-before-variable-restore.js` contains email functionality that is **NOT** in the current production worker:

1. **`handleReportIssue(request, env)`** (lines 803-841):
   - Receives issue reports via POST
   - Formats email subject/body based on issue type
   - Calls `sendEmail()` to dispatch

2. **`sendEmail(env, to, subject, body)`** (lines 845-862):
   - Uses `env.EMAIL_API_URL` (Google Apps Script Web App)
   - POSTs JSON with `recipient`, `subject`, `body`

3. **Example Issue Type**:
   ```javascript
   if (type === 'UNKNOWN_PRODUCT_ID') {
     subject = `URGENT: Unknown Product ID Detected`;
     content = `An unknown Product ID resulted in a "Premium Activated" status...`;
   }
   ```

### Current Worker (`worker.js`)

- Does NOT have `handleReportIssue`
- Does NOT have `sendEmail`
- No route for `/report-issue`

---

## Required Work

### 1. Restore Email Functions to Worker

Copy from backup to current `worker.js`:

```javascript
// Add to fetch handler routes:
if (url.pathname === '/report-issue' && request.method === 'POST') {
  return handleReportIssue(request, env);
}

// Add handleReportIssue function
async function handleReportIssue(request, env) {
  // ... (from backup)
}

// Add sendEmail helper
async function sendEmail(env, to, subject, body) {
  // ... (from backup)
}
```

### 2. Add New Issue Type for Font Size

```javascript
if (type === 'FONT_SIZE_NOT_DETECTED') {
  subject = `[SSA] Font Size Detection Issue`;
  content = `Font size could not be determined for an element.\n\n`;
  content += `Platform: ${details.platform}\n`;
  content += `Page URL: ${details.pageUrl}\n`;
  content += `Element Selector: ${details.selector}\n`;
  content += `Element Text: ${details.elementText?.substring(0, 100)}\n`;
  content += `Contrast Ratio: ${details.ratio}\n`;
  content += `Browser: ${details.userAgent}\n`;
  content += `Timestamp: ${new Date().toISOString()}\n`;
}
```

### 3. Verify Environment Variable

Ensure `EMAIL_API_URL` is set in the Cloudflare Worker environment. This should point to a Google Apps Script Web App that accepts:

```json
{
  "recipient": "email@example.com",
  "subject": "Subject line",
  "body": "Email body text"
}
```

### 4. Trigger from Extension

In `colors.ts`, when `fontSizeUndetermined` is true:

```typescript
if (fontSizeUndetermined) {
  // Fire and forget - don't block the analysis
  fetch('https://your-worker.workers.dev/report-issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'FONT_SIZE_NOT_DETECTED',
      details: {
        platform: 'wordpress', // or auto-detect
        pageUrl: window.location.href,
        selector: selector,
        elementText: element.textContent?.substring(0, 100),
        ratio: ratio,
        userAgent: navigator.userAgent,
      },
    }),
  }).catch(() => {}); // Ignore errors, this is non-critical
}
```

---

## Configuration Required

| Variable        | Description                    | Example                                       |
| --------------- | ------------------------------ | --------------------------------------------- |
| `EMAIL_API_URL` | Google Apps Script Web App URL | `https://script.google.com/macros/s/xxx/exec` |

---

## Testing Plan

1. Deploy updated worker
2. Verify `/report-issue` endpoint responds
3. Test with mock payload
4. Verify email arrives at `webbyinsights+...@gmail.com`
5. Test from extension with real undetermined font size case

---

## Related Files

| File                                                                                                                                                                                                         | Purpose                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| [worker.js](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/cloudflare/worker.js)                                                               | Current production worker (needs updates) |
| [worker-backup-before-variable-restore.js](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/cloudflare/worker-backup-before-variable-restore.js) | Contains email functions to restore       |
| [colors.ts](file:///Users/edmass/Downloads/Squarespace%20Style%20Analyzer%20Pro/browser-extensions/squarespace-extension/wxt-version/src/analyzers/colors.ts)                                                | Where to trigger the alert                |
