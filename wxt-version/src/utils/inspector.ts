/**
 * Live Inspector Utility
 * Handles highlighting elements based on URL parameters for "Locate" functionality
 */

export class LiveInspector {
  private static inspectionStarted = false;

  public static initialize(): void {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.checkUrlForInspection());
    } else {
      this.checkUrlForInspection();
    }
  }

  private static checkUrlForInspection(): void {
    if (this.inspectionStarted) return;

    try {
      // Prioritize HASH parameters to avoid server-side interaction (fixes 400 Bad Request on strict servers)
      let selector: string | null = null;

      if (window.location.hash && window.location.hash.includes('ssa-inspect-selector')) {
        // Remove leading #
        const hashString = window.location.hash.startsWith('#')
          ? window.location.hash.substring(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hashString);
        selector = hashParams.get('ssa-inspect-selector');
      }

      // Fallback to query params
      if (!selector) {
        const urlParams = new URLSearchParams(window.location.search);
        selector = urlParams.get('ssa-inspect-selector');
      }

      if (selector) {
        this.inspectionStarted = true;
        console.log('SSA Live Inspector: Highlighting element', selector);

        // VISUAL FEEDBACK: Show spinner immediately
        this.showLoadingSpinner();

        // DELAY INSPECTION TO BYPASS HYDRATION WIPES
        // Wait 2000ms for page to settle (SPA routers often re-render body on load)
        setTimeout(() => {
          this.hideLoadingSpinner(); // Cleanup spinner
          this.startInspection(selector!);
        }, 2000);

        // [DEBUG] DISABLE URL CLEANUP
        // Hypothesis: history.replaceState is triggering a Squarespace Router update,
        // causing the page to re-render and wipe our DOM elements.
        /*
        try {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('ssa-inspect-selector');
          if (newUrl.hash.startsWith('#ssa-inspect-selector=')) {
             newUrl.hash = '';
          }
          window.history.replaceState({}, '', newUrl.toString());
        } catch (e) {
          console.warn('SSA: Failed to clean URL', e);
        }
        */
      }
    } catch (e) {
      console.warn('SSA: Error during auto-inspection', e);
    }
  }

  // --- SAFE LOADER LOGIC ---
  private static spinnerId = 'ssa-loading-spinner';

  private static showLoadingSpinner(): void {
    try {
      if (document.getElementById(this.spinnerId)) return;

      const container = document.createElement('div');
      container.id = this.spinnerId;
      container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 2147483647;
            pointer-events: none;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.75);
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            backdrop-filter: blur(4px);
        `;

      const spinner = document.createElement('div');
      spinner.style.cssText = `
            width: 50px;
            height: 50px;
            border: 5px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top: 5px solid #fff;
            animation: ssa-spin 1s linear infinite;
            margin-bottom: 12px;
        `;

      const text = document.createElement('div');
      text.innerText = 'Please wait...';
      text.style.cssText = `
            color: white;
            font-family: -apple-system, system-ui, sans-serif;
            font-size: 16px;
            font-weight: 500;
      `;

      // Add keyframes if not present
      const styleId = 'ssa-spin-style';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
                @keyframes ssa-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
        document.head.appendChild(style);
      }

      container.appendChild(spinner);
      container.appendChild(text);
      (document.documentElement || document.body).appendChild(container);
    } catch (e) {
      console.warn('SSA: Failed to show spinner', e);
    }
  }

  private static hideLoadingSpinner(): void {
    try {
      const spinner = document.getElementById(this.spinnerId);
      if (spinner) spinner.remove();

      // Optional: Remove style if you want to be super clean,
      // but leaving it is safer/faster.
    } catch (e) {
      // Ignore
    }
  }

  private static startInspection(selector: string): void {
    // ... (rest of startInspection)

    let attempts = 0;
    const maxAttempts = 25;
    const retryInterval = 200;

    // --- Toast Logic (Hoisted) ---
    let toastEl: HTMLElement | null = null;
    let hideTimer: any = null; // Track timer to prevent race conditions

    const showToast = (message: string, duration = 0) => {
      // CLEAR ANY PENDING REMOVAL
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }

      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #2d3748;
          color: white;
          padding: 16px 24px;
          border-radius: 8px;
          font-family: -apple-system, system-ui, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          z-index: 2147483647;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          max-width: 400px;
          pointer-events: auto;
          border-left: 4px solid #f56565;
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.3s, transform 0.3s;
        `;
        document.body.appendChild(toastEl);
        void toastEl.offsetWidth; // Reflow
      }
      toastEl.innerHTML = message;
      toastEl.style.opacity = '1';
      toastEl.style.transform = 'translateY(0)';

      if (duration > 0) {
        hideTimer = setTimeout(hideToast, duration);
      }
    };

    const hideToast = () => {
      if (toastEl) {
        toastEl.style.opacity = '0';
        toastEl.style.transform = 'translateY(10px)';
        hideTimer = setTimeout(() => {
          if (toastEl && toastEl.parentNode) {
            toastEl.parentNode.removeChild(toastEl);
            toastEl = null;
          }
        }, 300);
      }
    };

    const performInspection = () => {
      // Decode selector if needed
      const decodedSelector = decodeURIComponent(selector);

      let el: Element | null = null;
      try {
        el = document.querySelector(decodedSelector) || document.querySelector(selector);
      } catch (e) {
        console.warn('Invalid selector for inspection:', selector);
      }

      if (!el) {
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`SSA: Element not found, retrying... (${attempts}/${maxAttempts})`);
          setTimeout(performInspection, retryInterval);
        } else {
          console.error('SSA: Element not found after max retries:', selector);
          showToast(
            `
            <strong>Element Not Found</strong><br/>
            Could not locate the element on this page.<br/>
            The content may have changed or moved.
          `,
            5000
          );
        }
        return;
      }

      console.log('SSA: Element found!', el);

      // --- Visibility Check & Watcher Logic ---

      // Helper to check if element is effectively visible
      // IMPORTANT: Only check CSS properties. Off-screen elements are considered "visible"
      // so that they can be scrolled to.
      const isVisible = (element: Element): boolean => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          parseFloat(style.opacity) > 0 &&
          rect.width > 0 &&
          rect.height > 0
        );
      };

      // Helper to show/hide toast (Moved to top scope)

      // Action: Highlight and Scroll (The "Success" State)
      const executeHighlight = () => {
        // Redundant hideToast removed to prevent race condition

        // Create highlighting (Same as before)
        const highlight = document.createElement('div');
        highlight.className = 'ssa-inspector-highlight';
        highlight.style.cssText = `
          position: fixed;
          border: 4px solid #f56565;
          background-color: transparent;
          z-index: 2147483647;
          pointer-events: none;
          border-radius: 4px;
          box-shadow: 0 0 15px rgba(245, 101, 101, 0.5);
          transition: none;
        `;

        const getVisibleBoundingRect = (element: Element): DOMRect => {
          // (Kept simple for brevity in this replacement block, but using logic from previous version is fine)
          // Re-implementing the union logic here since we are replacing the block
          let rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return rect;

          // Fallback Union Logic for 0x0 containers (e.g. some spans)
          let minLeft = Infinity,
            minTop = Infinity,
            maxRight = -Infinity,
            maxBottom = -Infinity;
          let found = false;
          const check = (p: Element) => {
            for (let i = 0; i < p.children.length; i++) {
              const c = p.children[i];
              const r = c.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) {
                found = true;
                minLeft = Math.min(minLeft, r.left);
                minTop = Math.min(minTop, r.top);
                maxRight = Math.max(maxRight, r.right);
                maxBottom = Math.max(maxBottom, r.bottom);
              }
              if (c.children.length > 0) check(c);
            }
          };
          check(element);
          if (found) {
            return {
              left: minLeft,
              top: minTop,
              width: maxRight - minLeft,
              height: maxBottom - minTop,
              right: maxRight,
              bottom: maxBottom,
              x: minLeft,
              y: minTop,
              toJSON: () => {},
            } as DOMRect;
          }
          return rect;
        };

        const updatePosition = () => {
          const rect = getVisibleBoundingRect(el!);
          highlight.style.top = rect.top + 'px';
          highlight.style.left = rect.left + 'px';
          highlight.style.width = rect.width + 'px';
          highlight.style.height = rect.height + 'px';
        };

        updatePosition();
        // Mount to documentElement to avoid body transform/overflow issues
        (document.documentElement || document.body).appendChild(highlight);

        // --- IMPROVED SCROLL LOGIC ---
        // USE NATIVE SCROLL - Handles nested containers (window.scrollTo does not)
        const rect = el!.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const elementHeight = rect.height;

        console.log('SSA [Locate]: Target found', {
          selector,
          rect: { top: rect.top, height: rect.height },
          viewport: { height: viewportHeight },
        });

        // 1. Check if element is effectively visible (Partial visibility is enough to skip scroll)
        // We use a "Safe Zone" padding of 50px to account for sticky headers/footers
        const safeZoneTop = 50;
        const safeZoneBottom = viewportHeight - 50;

        // CORRECTION: Must respect safeZoneTop for "Top Visible" check to avoid elements under headers (Case 1)
        const topVisible = rect.top >= safeZoneTop && rect.top < safeZoneBottom;
        const bottomVisible = rect.bottom > safeZoneTop && rect.bottom <= viewportHeight;
        const centerVisible =
          rect.top + rect.height / 2 > safeZoneTop && rect.top + rect.height / 2 < viewportHeight;
        // Fills Viewport: Top is above safe zone, Bottom is below safe zone
        const fillsViewport = rect.top <= safeZoneTop && rect.bottom >= safeZoneBottom;

        const isEffectivelyVisible = topVisible || bottomVisible || centerVisible || fillsViewport;

        // VISUAL DEBUG REMOVED per User Request
        // showToast(...) definition removed.

        if (isEffectivelyVisible) {
          console.log('SSA [Locate]: Element is effectively visible. Skipping scroll.', {
            topVisible,
            bottomVisible,
            centerVisible,
            fillsViewport,
          });
        } else {
          console.log('SSA [Locate]: Element off-screen. Scrolling...');

          if (elementHeight > viewportHeight) {
            // CASE: Large Element (Taller than screen) -> Scroll to START
            console.log('SSA [Locate]: Large element detected. Scrolling to START.');
            el!.scrollIntoView({
              behavior: 'smooth',
              block: 'start', // Align top of element to top of viewport
              inline: 'nearest',
            });
          } else {
            // CASE: Normal Element -> Scroll to CENTER
            console.log('SSA [Locate]: Normal element detected. Scrolling to CENTER.');
            el!.scrollIntoView({
              behavior: 'smooth',
              block: 'center', // Center element in viewport
              inline: 'center',
            });
          }
        }

        // Animation Loop
        let isActive = true;
        const animationLoop = () => {
          if (isActive) {
            updatePosition();
            requestAnimationFrame(animationLoop);
          }
        };
        requestAnimationFrame(animationLoop);

        // Pulse
        highlight.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }, { transform: 'scale(1)' }],
          { duration: 600, iterations: 2 }
        );

        // Cleanup Handler
        const removeHighlight = () => {
          if (!isActive) return;
          isActive = false;
          highlight.remove();
          window.removeEventListener('wheel', removeHighlight);
          window.removeEventListener('touchmove', removeHighlight);
          window.removeEventListener('keydown', removeHighlight);
        };

        // SAFETY DELAY: Don't attach listeners immediately. Inertial scrolling (fling)
        // or a stray mouse move can trigger them instantly. Wait 500ms.

        // [DEBUG] DISABLE REMOVAL LISTENERS
        // Hypothesis: Something is triggering these immediately (maybe bubbling events).
        /*
        setTimeout(() => {
          if (!isActive) return;
          window.addEventListener('wheel', removeHighlight, { passive: true, capture: true });
          window.addEventListener('touchmove', removeHighlight, { passive: true, capture: true });
          window.addEventListener('keydown', removeHighlight, { passive: true, capture: true });
        }, 500);
        */
      };

      // --- SIMPLIFIED LOGIC ---
      // If we found the element, just highlight it directly.
      // The previous complex visibility check was causing false negatives
      // (detecting visible elements as "hidden" and falling back to body).
      executeHighlight();
    };

    performInspection();
  }
}
