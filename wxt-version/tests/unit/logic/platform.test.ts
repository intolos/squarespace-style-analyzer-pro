import { describe, it, expect } from 'vitest';
import { platformStrings } from '../../../src/utils/platform';

describe('Platform Strings', () => {
  it('should have all required branding strings', () => {
    expect(platformStrings.productName).toBeDefined();
    expect(platformStrings.platformName).toBeDefined();
    expect(platformStrings.questionsEmail).toBeDefined();
    expect(platformStrings.stripe).toBeDefined();
  });

  it('should have a valid email format for questionsEmail', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(platformStrings.questionsEmail).toMatch(emailRegex);
  });

  it('should have all Stripe configuration keys', () => {
    const { stripe } = platformStrings;
    expect(stripe.productIdYearly).toBeDefined();
    expect(stripe.priceIdYearly).toBeDefined();
    expect(stripe.productIdLifetime).toBeDefined();
    expect(stripe.priceIdLifetime).toBeDefined();
    expect(stripe.apiBase).toBeDefined();
  });
});
