// Pages write root-relative links (`/guides/loans/`), but GitHub Pages serves the site under a
// sub-path. This Sätteri hast plugin prefixes those links with the base, in Markdown links and in
// MDX component `href` props (e.g. <LinkCard href="/...">), so the content never has to know it.
export function baseLinksPlugin(base) {
  const prefix = base.replace(/\/$/, '');
  const fix = (url) =>
    typeof url === 'string' &&
    prefix &&
    url.startsWith('/') &&
    !url.startsWith('//') &&
    !url.startsWith(`${prefix}/`)
      ? prefix + url
      : undefined;

  const visitJsx = {
    filter: [],
    visit(node, ctx) {
      for (const attr of node.attributes ?? []) {
        if (attr.name !== 'href') continue;
        const href = fix(attr.value);
        if (href) ctx.setProperty(node, 'href', href);
      }
    },
  };

  return {
    name: 'spaceworks-base-links',
    element: {
      filter: ['a'],
      visit(node, ctx) {
        const href = fix(node.properties?.href);
        if (href) ctx.setProperty(node, 'href', href);
      },
    },
    mdxJsxFlowElement: visitJsx,
    mdxJsxTextElement: visitJsx,
  };
}
