import { defineConfig, defineDocs, type DocsCollection } from 'fumadocs-mdx/config';

export const docs: DocsCollection = defineDocs({
  dir: '../../docs',
});

export default defineConfig();
