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
      const urlParams = new URLSearchParams(window.location.search);
      const selector = urlParams.get('ssa-inspect-selector');

      if (selector) {
        this.inspectionStarted = true;
        console.log('SSA Live Inspector: Highlighting element', selector);
        this.startInspection(selector);
      }
    } catch (e) {
      console.warn('SSA: Error during auto-inspection', e);
    }
  }

  private static startInspection(selector: string): void {
    let attempts = 0;
    const maxAttempts = 25;
    const retryInterval = 200;

    const performInspection = () => {
      // Decode selector if needed, though URLSearchParams handles most
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
        }
        return;
      }

      console.log('SSA: Element found!', el);

      // Create highlight with FIXED positioning (viewport-relative)
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

      // Helper: Find the UNION of all visible descendant rects if the element itself is collapsed (0x0)
      const getVisibleBoundingRect = (element: Element): DOMRect => {
        let rect = element.getBoundingClientRect();

        // If element has dimensions, use them
        if (rect.width > 0 && rect.height > 0) return rect;

        let minLeft = Infinity;
        let minTop = Infinity;
        let maxRight = -Infinity;
        let maxBottom = -Infinity;
        let foundVisibleContent = false;

        const checkChildren = (parent: Element) => {
          const children = parent.children;
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const childRect = child.getBoundingClientRect();

            // If child has dimensions, include it in union
            if (childRect.width > 0 && childRect.height > 0) {
              foundVisibleContent = true;
              minLeft = Math.min(minLeft, childRect.left);
              minTop = Math.min(minTop, childRect.top);
              maxRight = Math.max(maxRight, childRect.right);
              maxBottom = Math.max(maxBottom, childRect.bottom);
            }

            // Recursively check if this child is also collapsed but has content
            if (child.children.length > 0) {
              checkChildren(child);
            }
          }
        };

        checkChildren(element);

        if (foundVisibleContent) {
          // Return the Union Rect
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

        // Fallback to original if no visible content found
        return rect;
      };

      // Update position to match element's current viewport position
      const updatePosition = () => {
        const rect = getVisibleBoundingRect(el!);
        highlight.style.top = rect.top + 'px';
        highlight.style.left = rect.left + 'px';
        highlight.style.width = rect.width + 'px';
        highlight.style.height = rect.height + 'px';
      };

      // Set initial position and append
      updatePosition();
      document.body.appendChild(highlight);

      // Scroll element into view
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Continuously update position using requestAnimationFrame - FOREVER until removed
      let isActive = true;
      const animationLoop = () => {
        if (isActive) {
          updatePosition();
          requestAnimationFrame(animationLoop);
        }
      };
      requestAnimationFrame(animationLoop);

      // Pulse animation
      highlight.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }, { transform: 'scale(1)' }],
        { duration: 600, iterations: 2 }
      );

      // Wait for explicit USER INTERACTION to remove highlight
      // This eliminates guessing about "scroll events vs programmatic scroll"
      // We listen for: wheel (mouse), touchmove (mobile), keydown (keyboard)
      const removeHighlight = () => {
        if (!isActive) return;
        isActive = false;
        highlight.remove();
        window.removeEventListener('wheel', removeHighlight);
        window.removeEventListener('touchmove', removeHighlight);
        window.removeEventListener('keydown', removeHighlight);
      };

      // Use 'capture' phase to detect interaction immediately
      window.addEventListener('wheel', removeHighlight, { passive: true, capture: true });
      window.addEventListener('touchmove', removeHighlight, { passive: true, capture: true });
      window.addEventListener('keydown', removeHighlight, { passive: true, capture: true });
    };

    performInspection();
  }
}
