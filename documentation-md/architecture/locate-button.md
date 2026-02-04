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

---

## Debugging & Stabilization (2026-02-03)

**Status:** WORKING for standard elements. FAILED for carousel images.

### 1. What IS Working
The "Nuclear" configuration that finally stabilized the Locate function consists of:

1.  **Hydration Bypass (Critical)**:
    -   **Logic:** `setTimeout(() => startInspection(), 2000)` inside `checkUrlForInspection`.
    -   **Why:** SPA frameworks (React/Squarespace) often "hydrate" the page shortly after load, wiping the DOM and strictly enforcing their own component tree. Our injected highlight elements were being deleted milliseconds after creation. The 2-second delay waits for this process to settle.

2.  **No Side-Effects ("Nuclear" Mode)**:
    -   **Logic:** URL Parameter `?ssa-inspect-selector=...` is **NOT** removed.
    -   **Why:** Calling `history.replaceState` to clean the URL was triggering the Squarespace Router to re-render the view, which wiped our UI.
    -   **Logic:** Auto-removal listeners (`wheel`, `mousemove`) are **DISABLED**.
    -   **Why:** Inertial scrolling or stray mouse events were triggering immediate removal. The UI is now "forced persistent".

3.  **Robust Scroll Logic**:
    -   **Logic:**
        -   **Large Elements (> Viewport Height):** `scrollIntoView({ block: 'start' })`. Aligns top of element to top of screen.
        -   **Normal Elements:** `scrollIntoView({ block: 'center' })`. Centers element.
        -   **Safe Zone:** `top > 50px`. Prevents elements hidden under sticky headers (`top: 0`) from being falsely flagged as "visible".
    -   **Why:** Previously, `block: 'center'` on large elements pushed the top off-screen. Strict `isInViewport` checks caused "push down" layout shifts on already-visible elements.

4.  **Mounting Point**:
    -   **Logic:** `document.documentElement.appendChild(highlight)`.
    -   **Why:** Mounting to `body` caused coordinate issues on sites with `body { transform: ... }` or specific overflow settings.

### 2. Carousel Exception (Why it fails)
Locate fails for "generic filename images in a carousel" because:
-   **Visibility:** Carousel items are often strictly hidden (`display: none`, `opacity: 0`, or `visibility: hidden`) by the slider library when not active.
-   **Overflow:** Even if "visible" in the DOM, they are clipped by an `overflow: hidden` parent.
-   **Script Control:** `scrollIntoView` cannot "scroll" a carousel. The carousel's state is managed by JavaScript (setting `transform: translateX(...)`). The browser cannot natively scroll to a slide that is logically "next" in the framework's state machine.

### 3. What Did NOT Work (The "11 Hours" of Failures)

1.  **Strict Visibility Checks**:
    -   *Attempt:* Checking `isInViewport` (fully contained).
    -   *Result:* "Push Down" effect. Elements that were 50% visible triggered a scroll, shifting the page unnecessarily.

2.  **Manual Scroll Math**:
    -   *Attempt:* `window.scrollTo(0, rect.top + window.scrollY)`.
    -   *Result:* Failed on **Nested Containers** (e.g., sidebars, modals). `window.scrollTo` only moves the main document, not the overflow container holding the element.

3.  **Clean URL Cleanup**:
    -   *Attempt:* Removing `?ssa-inspect-selector`.
    -   *Result:* Triggered Site Router -> Re-render -> Highlight deleted. ("Flash and Gone").

4.  **Auto-Removal Listeners**:
    -   *Attempt:* `window.addEventListener('wheel', removeHighlight)`.
    -   *Result:* **Inertial Scrolling**. If the user was still scrolling when the page loaded (very common), the "brake" event fired immediately, removing the highlight before it was even seen.

5.  **Debug Toasts**:
    -   *Attempt:* Showing a debug message.
    -   *Result:* Race conditions. The `hideToast` timer from a previous alert would kill the new alert 300ms later.

6.  **Immediate Execution**:
    -   *Attempt:* `DOMContentLoaded` trigger.
    -   *Result:* Hydration Wipe. The extension injected the element, and React/Vue/SQS subsequently deleted it during the first paint.

### 4. Final Recommendation
To maintain stability:
-   **NEVER** re-enable URL cleanup. It conflicts with Single Page App routers.
-   **NEVER** remove the startup delay. It is the only protection against Hydration.
-   **NEVER** re-enable sensitive auto-removal listeners. Users prefer manually closing a box over having it disappear instantly.
```
