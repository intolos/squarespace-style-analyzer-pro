import { defineConfig } from 'wxt';

export default defineConfig(((env: any) => {
  // Robust mode detection from CLI arguments
  const args = process.argv;
  const modeIndex = args.indexOf('--mode');
  const mode = modeIndex !== -1 ? args[modeIndex + 1] : env?.mode || 'sqs';
  const isSqs = mode === 'sqs';
  const isWp = mode === 'wp';

  // IMPORTANT: Three-way mode logic for build versioning
  const versionLabel = isSqs ? 'SQUARESPACE' : isWp ? 'WORDPRESS' : 'GENERIC';
  console.log(`\n>>> BUILDING VERSION: ${versionLabel} (${mode})\n`);

  // Determine publicDir based on mode
  const publicDir = isSqs ? 'public-sqs' : isWp ? 'public-wp' : 'public-generic';

  // Determine manifest name based on mode
  const manifestName = isSqs
    ? 'Squarespace Style Analyzer Pro'
    : isWp
      ? 'WordPress Style Analyzer Pro'
      : 'Website Style Analyzer Pro';

  return {
    runner: {
      disabled: true,
    },
    outDir: `.output/${mode}`,
    publicDir: publicDir,
    manifest: {
      name: manifestName,
      description:
        'Professional Design Audit tool for websites. Quality Checks of over 80 Aspects of Design. Critical checks not shown in SEO audits.',
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
        'import.meta.env.VITE_IS_WP_VERSION': JSON.stringify(isWp ? 'true' : 'false'),
      },
    }),
  };
}) as any);
