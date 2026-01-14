# Locate Button Functionality Documentation

## Summary for Quick Reconstruction

Use this exact logic structure if the code breaks or needs to be rewritten.

**Core Principles:**

1.  **Positioning:** `position: fixed` + `element.getBoundingClientRect()` (Viewport relative).
2.  **Tracking:** Continuous `requestAnimationFrame` loop (Infinite duration).
3.  **Removal:** Explicit user interaction only. DO NOT use time-based or scroll-event-based removal.
    - Triggers: `wheel`, `touchmove`, `keydown`.
    - Options: `{ passive: true, capture: true }`.
4.  **Z-Index:** `2147483647` (Max safe integer).

---

## Detailed Implementation Reference

### 1. Variables and Constants

- `selector`: Extracted from URL parameter `ssa-inspect-selector`.
- `inspectionStarted` (Boolean): Global guard to prevent the function from running twice if the script is injected multiple times (common in some extension environments).
- `isActive` (Boolean): Controls the `requestAnimationFrame` loop. Set to `true` initially, `false` upon user interaction.
- `maxAttempts`: `25` (Retry limiter).
- `retryInterval`: `200` ms (Retry delay).

### 2. Code Logic Explanation & "The Why"

The code is structured to handle dynamic page loads where elements might shift or load asynchronously.

#### A. Positioning Strategy: `position: fixed`

- **Why:** `position: absolute` relies on document coordinates (`scrollTop` + `rect.top`). When pages lazy-load content above the target, the document height changes, shifting the target but _not_ necessarily updating the absolute coordinates correctly without complex resize observers.
- **Solution:** `position: fixed` relies on the _viewport_. By continuously calling `getBoundingClientRect()`, we get the element's exact position on the screen right now, regardless of document flow.

#### B. The Loop: `requestAnimationFrame`

- **Why:** `MutationObserver` and `ResizeObserver` are efficient but sometimes miss layout reflows caused by CSS transitions or non-DOM-mutating changes (like canvas updates or image loading that doesn't bubble).
- **Solution:** An infinite `requestAnimationFrame` loop updates the red rectangle's position ~60 times per second. This makes the tracking **time-independent** and smooth. It follows the element perfectly even during animations.

#### C. Removal Logic: Explicit Interaction

- **Why (What Failed):**
  - _Timeouts:_ Pages load at different speeds. 5 seconds might be too long for a fast site (annoying) or too short for a slow site (rectangle disappears before user sees it).
  - _Scroll Events:_ `element.scrollIntoView()` triggers "scroll" events. Browsers also have "elastic" scrolling (rubber-banding) that triggers events. Distinguishing between "programmatic scroll" and "user scroll" via timestamps or flags was flaky and unreliable.
- **Solution (What Works):** We fundamentally ignore "scroll" events. Instead, we listen for _input_ events:
  - `wheel` (Mouse wheel/trackpad scroll)
  - `touchmove` (Touchscreen swipe)
  - `keydown` (Arrow keys/PageUp/Down)
  - **Capture Phase:** We use `{ capture: true }` to detect these events immediately before other scripts might stop propagation.

### 3. "What Did Not Work" (Anti-Patterns)

- **Absolute Absolute Positioning:** `top: rect.top + window.scrollY`. Failed because layout shifts invalidated the calculated `scrollY`.
- **IntersectionObserver:** Tried to wait for the element to be visible before showing the rectangle. Failed because it introduced race conditions with the scroll logic.
- **Scroll Event Counting:** Logic like "ignore the first 5 scroll events" failed because smooth scrolling generates a variable number of events depending on distance and browser performance.
- **Scroll Thresholds:** "Remove if moved > 50px". Failed because users might seemingly not move the scrollbar but the browser adjusts layout.

### 4. "What Works" (Current Implementation)

The current solution is robust because it decouples "following the element" from "page loading". It blindly follows the element forever until the human explicitly tells the browser to move (via inputs).

### 5. Code Structure for Reconstruction

```javascript
// sqs-style-analyzer-main.js

let inspectionStarted = false; // Guard against existing instances

function checkUrlForInspection() {
  if (inspectionStarted) return;

  // ... get selector from URL ...

  const performInspection = () => {
    // ... verification logic ...

    // 1. Create Element (Fixed Position)
    const highlight = document.createElement('div');
    highlight.style.position = 'fixed'; // CRITICAL
    highlight.style.zIndex = '2147483647';
    highlight.style.pointerEvents = 'none';
    // ... styles ...

    // 2. Position Updater
    const updatePosition = () => {
      const rect = el.getBoundingClientRect();
      highlight.style.top = rect.top + 'px';
      highlight.style.left = rect.left + 'px';
      // ... width/height ...
    };

    // 3. Infinite Tracking Loop
    let isActive = true;
    const animationLoop = () => {
      if (isActive) {
        updatePosition();
        requestAnimationFrame(animationLoop);
      }
    };
    requestAnimationFrame(animationLoop);

    // 4. Removal (User Inputs ONLY)
    const removeHighlight = () => {
      if (!isActive) return;
      isActive = false;
      highlight.remove();
      // remove listeners...
    };

    // Listen for INTENT, not side-effects
    window.addEventListener('wheel', removeHighlight, { passive: true, capture: true });
    window.addEventListener('touchmove', removeHighlight, { passive: true, capture: true });
    window.addEventListener('keydown', removeHighlight, { passive: true, capture: true });
  };
}
```
