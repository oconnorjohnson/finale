import Link from 'next/link';
import {
  ArrowRight,
  Layers,
  Shield,
  Activity,
  BookOpen,
  Package,
  FileText,
} from 'lucide-react';

const sections = [
  {
    title: 'Getting Started',
    description:
      'Install Finale, understand the mental model, and emit your first wide event.',
    href: '/docs/getting-started/overview',
    icon: ArrowRight,
  },
  {
    title: 'Core Topics',
    description:
      'Field registry, scopes, validation, safety, sampling, and Express integration.',
    href: '/docs/core/mental-model',
    icon: Layers,
  },
  {
    title: 'Workflow Guides',
    description:
      'Backend requests, LLM workflows, interaction journeys, and Convex patterns.',
    href: '/docs/guides/backend-request-flow',
    icon: Activity,
  },
  {
    title: 'Package Guides',
    description:
      'Schema adapters, sink adapters, test utilities, and Convex integration.',
    href: '/docs/packages/schema-zod',
    icon: Package,
  },
  {
    title: 'Reference',
    description:
      'Core API, field definitions, sampling tiers, sink behavior, and config gotchas.',
    href: '/docs/reference/core-api',
    icon: FileText,
  },
];

const features = [
  {
    title: 'One event per request',
    description:
      'Accumulate context throughout a request lifecycle. Emit one enriched, authoritative event instead of scattered log lines.',
    icon: Activity,
  },
  {
    title: 'Schema-governed fields',
    description:
      'Declare fields with metadata: group, sensitivity, cardinality, priority. Validate at development time, enforce at runtime.',
    icon: Shield,
  },
  {
    title: 'Pluggable sinks',
    description:
      'Output to pino, console, or any custom sink. Finale is an instrumentation layer, not a logger replacement.',
    icon: Layers,
  },
  {
    title: 'Comprehensive docs',
    description:
      'Guides for backend requests, LLM workflows, Convex, interaction journeys, testing, and more.',
    icon: BookOpen,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-fd-border">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_-10%,var(--color-fd-accent)_0%,transparent_50%)]" />
        <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-28 sm:pb-28 sm:pt-36">
          <div className="flex flex-col items-start gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card px-3 py-1 text-xs text-fd-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Wide-event instrumentation for TypeScript
            </div>
            <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
              Finale
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-fd-muted-foreground">
              Accumulate one authoritative event per request instead of many thin
              log lines. Schema-governed fields, pluggable sinks, and
              zero-config Express integration.
            </p>
            <div className="mt-2 flex gap-3">
              <Link
                href="/docs/getting-started/overview"
                className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground shadow-sm transition-all hover:bg-fd-primary/90 hover:shadow-md"
              >
                Get started
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-lg border border-fd-border bg-fd-card px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
              >
                Browse docs
              </Link>
            </div>
          </div>

          {/* Code preview */}
          <div className="mt-14 overflow-hidden rounded-xl border border-fd-border bg-fd-card shadow-sm">
            <div className="flex items-center gap-1.5 border-b border-fd-border px-4 py-2.5">
              <div className="h-2.5 w-2.5 rounded-full bg-fd-muted-foreground/20" />
              <div className="h-2.5 w-2.5 rounded-full bg-fd-muted-foreground/20" />
              <div className="h-2.5 w-2.5 rounded-full bg-fd-muted-foreground/20" />
              <span className="ml-2 text-xs text-fd-muted-foreground">
                middleware.ts
              </span>
            </div>
            <pre className="overflow-x-auto p-5 text-[13px] leading-6">
              <code>
                <span className="text-fd-muted-foreground">
                  {'// One enriched event per request\n'}
                </span>
                <span className="text-purple-500 dark:text-purple-400">
                  {'const '}
                </span>
                {'scope = '}
                <span className="text-blue-600 dark:text-blue-400">
                  getScope
                </span>
                {'();\n'}
                {'scope.event.'}
                <span className="text-blue-600 dark:text-blue-400">add</span>
                {'({ '}
                <span className="text-emerald-600 dark:text-emerald-400">
                  {"'user.id'"}
                </span>
                {': userId, '}
                <span className="text-emerald-600 dark:text-emerald-400">
                  {"'org.id'"}
                </span>
                {': orgId });\n'}
                {'scope.timers.'}
                <span className="text-blue-600 dark:text-blue-400">start</span>
                {'('}
                <span className="text-emerald-600 dark:text-emerald-400">
                  {"'db.query'"}
                </span>
                {');\n'}
                <span className="text-fd-muted-foreground">
                  {'// ... your application code ...\n'}
                </span>
                {'scope.timers.'}
                <span className="text-blue-600 dark:text-blue-400">end</span>
                {'('}
                <span className="text-emerald-600 dark:text-emerald-400">
                  {"'db.query'"}
                </span>
                {');\n'}
                <span className="text-fd-muted-foreground">
                  {'// Middleware auto-flushes ONE wide event at request end'}
                </span>
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
        <div className="grid gap-8 sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="flex gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-fd-border bg-fd-card">
                <feature.icon className="h-4 w-4 text-fd-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-fd-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section navigation */}
      <section className="border-t border-fd-border">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <h2 className="text-2xl font-bold tracking-tight">
            Explore the docs
          </h2>
          <p className="mt-2 text-fd-muted-foreground">
            Guides, references, and package documentation.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <Link
                key={section.title}
                href={section.href}
                className="group flex items-start gap-3 rounded-lg border border-fd-border p-4 transition-colors hover:bg-fd-accent"
              >
                <section.icon className="mt-0.5 h-4 w-4 shrink-0 text-fd-muted-foreground transition-colors group-hover:text-fd-foreground" />
                <div>
                  <h3 className="text-sm font-semibold">{section.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-fd-muted-foreground">
                    {section.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
