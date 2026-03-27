import { source } from '@/lib/source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import type { ComponentType } from 'react';
import type { TOCItemType } from 'fumadocs-core/toc';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const pageData = (
    page.data as typeof page.data & {
      body: ComponentType<{ components?: ReturnType<typeof getMDXComponents> }>;
      description?: string;
      full?: boolean;
      title: string;
      toc: TOCItemType[];
    }
  );
  const MDX = pageData.body;
  const docsPageProps =
    pageData.full === undefined ? { toc: pageData.toc } : { toc: pageData.toc, full: pageData.full };

  return (
    <DocsPage {...docsPageProps}>
      <DocsTitle>{pageData.title}</DocsTitle>
      <DocsDescription>{pageData.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  const pageData = page.data as typeof page.data & {
    description?: string;
    title: string;
  };

  return {
    title: pageData.title,
    description: pageData.description,
  };
}
