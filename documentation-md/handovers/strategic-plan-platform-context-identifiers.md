# strategic-plan-platform-context-identifiers.md

## Goal

Enhance the "Generic" version of the extension to provide precise **Context Identifiers** (Section IDs, Block Classes) for major web platforms. This transforms reports from simple observations ("H2 error found") into actionable developer tasks ("H2 error in Section #contact-form").

## Key Terminology

We will refer to this feature as **Platform Context Intelligence**. It allows the extension to "speak the language" of the underlying CMS.

## Architectural Principle: Single Responsibility (SRP)

To ensure long-term maintainability and prevent `domHelpers.ts` from becoming a monolithic "God Object," we will strictly adhere to SRP:

- **`domHelpers.ts`**: Acts as a **Facade**. It detects the platform and delegates the request to the appropriate handler. It contains NO platform-specific logic itself.
- **`platforms/` Directory**: A new specialized module for each supported CMS.
  - `squarespace.ts`: Contains specific logic for `#block-yui` and `.sqs-block`.
  - `wordpress.ts`: Contains specific logic for `.wp-block` and Elementor/Divi classes.
  - `wix.ts`: Contains specific logic for `#comp-` and `data-testid`.
- **Benefit**: Adding support for a new platform (e.g., Shopify) will involve creating a new file (`shopify.ts`) and registering it, with **zero risk** of breaking existing Squarespace logic.

## Implementation Priority

We will implement support in the following order, based on market share and user demographic relevance:

1.  **WordPress** (Gutenberg, Elementor, Divi) - _Market Leader_
2.  **Wix** - _Major DIY Platform_
3.  **Shopify** - _E-Commerce Giant_
4.  **Webflow** - _Pro Designer Niche (High Relevance)_
5.  **Showit** - _Creative Niche_
6.  **Framer** - _Rising Design Star_

## Technical Strategy

The update will primarily focus on `src/utils/domHelpers.ts` and potentially a new `src/utils/platformContext.ts` module to keep logic clean. We will NOT need to rewrite core analyzers.

### Platform Signatures & Identifiers

#### 1. WordPress

- **Detection:** `meta[name="generator"][content*="WordPress"]`, specific script handles.
- **Gutenberg (Native):**
  - _Container:_ `.wp-block-group`, `.wp-block-columns`
  - _Block:_ `.wp-block-*` (e.g., `wp-block-image`)
- **Elementor:**
  - _Container:_ `.elementor-section`, `.elementor-column`
  - _Block:_ `.elementor-widget` (ID: `data-id` attribute)
- **Divi:**
  - _Container:_ `.et_pb_section`, `.et_pb_row`
  - _Block:_ `.et_pb_module`

#### 2. Wix

- **Detection:** `meta[name="generator"][content*="Wix"]`, `X-Wix-Renderer` headers.
- **Identifiers:**
  - _Container (Strip):_ `#comp-[id]` (e.g., `#comp-j8s9d2...`), `.comp-strip`
  - _Block (Component):_ `[data-testid="..."]` (Stable), `.comp-[type]`

#### 3. Shopify

- **Detection:** `window.Shopify`, script patterns.
- **Identifiers:**
  - _Container:_ `div[id^="shopify-section-"]` (e.g., `#shopify-section-header`)
  - _Block:_ Often relies on theme specific classes, but `shopify-block` is emerging.

#### 4. Webflow

- **Detection:** `html[data-wf-page]`, `w-mod-*` classes.
- **Identifiers:**
  - _Container:_ `.w-section`, `.w-container`
  - _Block:_ User-defined classes are primary here, but the DOM hierarchy is strict.

#### 5. Showit

- **Detection:** Specific markup patterns (often heavily absolute positioned).
- **Identifiers:**
  - _Container:_ `<div id="canvas-...">` (Canvases are sections in Showit)
  - _Block:_ Absolute positioned divs within canvases.

#### 6. Framer

- **Detection:** `__framer-badge`, script signatures.
- **Identifiers:**
  - _Container:_ `div[name="..."]` attributes often used in Framer exports.
  - _Block:_ `div[data-framer-name="..."]`.

## Developer Value

Providing these identifiers allows developers to:

1.  **Locate Elements:** Instantly find the "needle in the haystack" DOM node.
2.  **Write Custom CSS:** Use the ID (e.g., `#block-yui_...` or `#comp-123`) to target fixes specifically.
3.  **Automate Fixes:** Use identifiers hooks for jQuery/Velo scripts.
