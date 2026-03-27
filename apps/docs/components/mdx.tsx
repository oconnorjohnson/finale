import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import type { AnchorHTMLAttributes } from 'react';

/**
 * Custom link component that rewrites internal .md links to route paths.
 * Relative links like `./installation.md` are resolved by the browser
 * relative to the current page URL, so we just need to strip `.md`.
 */
function MdxLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  let href = props.href;

  if (href && !href.startsWith('http://') && !href.startsWith('https://')) {
    // Strip .md extension, preserve anchors
    href = href.replace(/\.md(#|$)/, '$1');
  }

  const DefaultA = defaultMdxComponents.a;
  if (DefaultA) {
    return <DefaultA {...props} href={href} />;
  }
  return <a {...props} href={href} />;
}

export function getMDXComponents(components?: MDXComponents) {
  const mergedComponents = {
    ...defaultMdxComponents,
    a: MdxLink,
    ...components,
  };

  return mergedComponents as MDXComponents;
}

export const useMDXComponents = getMDXComponents;
