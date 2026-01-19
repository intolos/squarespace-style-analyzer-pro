import { defineConfig } from 'wxt';

export default defineConfig(env => {
  // Robust mode detection from CLI arguments
  const args = process.argv;
  const modeIndex = args.indexOf('--mode');
  const mode = modeIndex !== -1 ? args[modeIndex + 1] : env?.mode || 'sqs';
  const isSqs = mode === 'sqs';

  console.log(`\n>>> BUILDING VERSION: ${isSqs ? 'SQUARESPACE' : 'GENERIC'} (${mode})\n`);

  return {
    runner: {
      disabled: true,
    },
    outDir: `.output/${mode}`,
    publicDir: isSqs ? 'public-sqs' : 'public-generic',
    manifest: {
      name: isSqs ? 'Squarespace Style Analyzer Pro' : 'Website Style Analyzer Pro',
      description:
        'Professional Design Audit tool for websites. Quality Checks of over 70 Aspects of Design. Reports create actionable insights.',
      permissions: ['activeTab', 'scripting', 'storage', 'tabs', 'debugger', 'unlimitedStorage'],
      host_permissions: ['<all_urls>'],
      icons: {
        '16': 'icon/16.png',
        '32': 'icon/32.png',
        '48': 'icon/48.png',
        '128': 'icon/128.png',
      },
    },
    vite: () => ({
      define: {
        'import.meta.env.VITE_IS_SQS_VERSION': JSON.stringify(isSqs ? 'true' : 'false'),
      },
    }),
  };
});
