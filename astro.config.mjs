// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import { satteri } from '@astrojs/markdown-satteri';
import { baseLinksPlugin } from './src/plugins/base-links.mjs';

// GitHub Pages serves the site at https://spaceworks-hq.github.io/SpaceWorks-Docs/. Set
// DOCS_SITE_URL to override the origin used for the sitemap and canonical links.
const site = process.env.DOCS_SITE_URL || 'https://spaceworks-hq.github.io';
const base = '/SpaceWorks-Docs';

export default defineConfig({
  site,
  base,
  markdown: { processor: satteri({ hastPlugins: [baseLinksPlugin(base)] }) },
  integrations: [
    starlight({
      title: 'Space Works Docs',
      description:
        'Install, configure, run and extend Space Works, the open-source makerspace manager.',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: true,
      },
      favicon: '/favicon.svg',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/SpaceWorks-HQ/SpaceWorks' },
      ],
      editLink: {
        baseUrl: 'https://github.com/SpaceWorks-HQ/SpaceWorks-Docs/edit/main/',
      },
      lastUpdated: true,
      customCss: [
        '@fontsource-variable/outfit',
        '@fontsource-variable/unbounded',
        './src/styles/custom.css',
      ],
      components: {
        ThemeProvider: './src/components/ThemeProvider.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
      },
      expressiveCode: {
        themes: ['github-light', 'github-dark'],
        styleOverrides: {
          borderRadius: '10px',
          borderColor: 'var(--sl-color-hairline)',
          codeBackground: 'var(--sw-panel)',
          frames: { shadowColor: 'transparent' },
        },
      },
      plugins: [starlightLinksValidator()],
      sidebar: [
        { label: 'Get started', items: [{ autogenerate: { directory: 'get-started' } }] },
        { label: 'Tutorials', items: [{ autogenerate: { directory: 'tutorials' } }] },
        { label: 'Install & deploy', items: [{ autogenerate: { directory: 'install' } }] },
        { label: 'Configure', items: [{ autogenerate: { directory: 'configure' } }] },
        { label: 'Run your makerspace', items: [{ autogenerate: { directory: 'guides' } }] },
        { label: 'Develop', items: [{ autogenerate: { directory: 'develop' } }] },
        { label: 'API & integrations', items: [{ autogenerate: { directory: 'api' } }] },
        { label: 'Help', items: [{ autogenerate: { directory: 'help' } }] },
      ],
    }),
  ],
});
