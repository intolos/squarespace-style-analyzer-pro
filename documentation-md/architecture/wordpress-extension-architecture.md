# WordPress Extension Version Architecture & Implementation Plan

This document outlines the architecture for the WordPress-specific version of the Style Analyzer Pro extension, following the existing "sqs" (Squarespace) and "generic" (Website) dual-build pattern.

## Overview

The WordPress version is a marketing-focused variant specifically for WordPress websites. This version is functionally identical to the generic version but features WordPress branding ("WordPress Style Analyzer Pro") and specific internal designations ("wp").

**Status**: ✅ Implemented (2026-02-03)

## Current Infrastructure

The WordPress version infrastructure is fully established:

- **Build Mode**: `wp` (via `--mode wp`)
- **Source Location**: `wxt-version/public-wp/`
- **Icons**: Branded icons (16, 32, 48, 128) in `wxt-version/public-wp/icon/`
- **Marketing/Hosting**: `intolos.github.io/wordpress-style-analyzer-pro/`

## Architecture & Build System

### Build Designation

The extension now utilizes a **three-way build mode**:

- `sqs`: Squarespace Style Analyzer Pro
- `generic`: Website Style Analyzer Pro
- `wp`: WordPress Style Analyzer Pro

### Build Configuration

- **package.json**: Scripts `dev:wp`, `build:wp`, and `zip:wp` support the `--mode wp` flag.
- **wxt.config.ts**:
  - Three-way mode detection (`isSqs`, `isWp`).
  - Dynamic `publicDir` resolution (`public-sqs`, `public-wp`, or `public-generic`).
  - Dynamic manifest name resolution.
  - Injection of `VITE_IS_WP_VERSION` environment variable.
- **Environment Configuration**: `.env.wp` defines WordPress-specific product name.

### Platform Logic (`platform.ts`)

The `platform.ts` file is the central authority for product-specific strings and configurations. It uses three-way mode logic (`isSqs ? ... : isWp ? ... : ...`).

**WordPress-specific values configured**:

| Property                   | WordPress Value                       |
| -------------------------- | ------------------------------------- |
| `productName`              | `'WordPress Style Analyzer Pro'`      |
| `platformName`             | `'WordPress'`                         |
| `filenameVariable`         | `'wordpress'`                         |
| `questionsEmail`           | `'webbyinsights+wordpress@gmail.com'` |
| `stripe.productIdYearly`   | `'prod_TuTaoNTEb2k7In'`               |
| `stripe.priceIdYearly`     | `'price_1Swed3Aoq9jsK93OpEe9tvGf'`    |
| `stripe.productIdLifetime` | `'prod_TuTcR3mQDYs0qO'`               |
| `stripe.priceIdLifetime`   | `'price_1SweetAoq9jsK93OIL0eoMzw'`    |

### Public Assets

The `public-wp` directory contains:

- WordPress-branded `welcome.html`
- Branded icons in `icon/` subdirectory (16, 32, 48, 128 px)

### Stripe Integration

WordPress sales are tracked via separate Stripe Product/Price IDs configured in `platform.ts`:

- Yearly: `prod_TuTaoNTEb2k7In` / `price_1Swed3Aoq9jsK93OpEe9tvGf`
- Lifetime: `prod_TuTcR3mQDYs0qO` / `price_1SweetAoq9jsK93OIL0eoMzw`

## Build Commands

```bash
# Development
npm run dev:wp

# Production build
npm run build:wp

# Create distribution zip
npm run zip:wp
```

## Future Extension Store Presence

The WordPress version will require separate listings on:

- Chrome Web Store
- Firefox Add-ons
- Microsoft Edge Add-ons

Each will feature WordPress-specific descriptions, screenshots, and metadata. Placeholder URLs are currently configured in `platform.ts` until real store IDs are available.
