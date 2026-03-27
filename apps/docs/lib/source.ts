import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';

const docsSource = (
  docs as {
    toFumadocsSource: () => Parameters<typeof loader>[0]['source'];
  }
).toFumadocsSource();

export const source = loader({
  baseUrl: '/docs',
  source: docsSource,
});
