export const BRANDING = {
  productName: import.meta.env.VITE_PRODUCT_NAME,
  productId: import.meta.env.VITE_PRODUCT_ID,
  isSqsVersion: import.meta.env.VITE_IS_SQS_VERSION === 'true',
  apiBase: import.meta.env.VITE_API_BASE,
  iconBase: import.meta.env.VITE_ICON_BASE,
};

export function getProductName(): string {
  return BRANDING.productName || 'Style Analyzer Pro';
}

export function isSqsVersion(): boolean {
  return BRANDING.isSqsVersion;
}
