import { defineConfig } from 'wxt';

// Manual check of command line arguments for mode
const isSqs = process.argv.includes('sqs');

export default defineConfig({
  publicDir: isSqs ? 'public-sqs' : 'public-generic',
  manifest: {
    name: isSqs ? 'Squarespace Style Analyzer Pro' : 'Website Style Analyzer Pro',
    description: isSqs
      ? 'Professional design audit tool for Squarespace websites'
      : 'Professional design audit tool for any website',
    permissions: ['activeTab', 'scripting', 'storage', 'tabs'],
    host_permissions: ['<all_urls>'],
    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '128': 'icon/128.png',
    },
  },
});
