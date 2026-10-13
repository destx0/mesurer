import type { ReactNode } from "react";
import PageMetadata from "../../components/page-metadata";
import MarketingFooter from "../marketing/footer";
import Button from "../marketing/components/button";
import { TOOLS, toolHref } from "./tools";

const SITE = "https://mesurer.dev";
const chromeStoreUrl = "https://chromewebstore.google.com/detail/mesurer/icmjafcffhpcnadkmmklegommbcekcac";

export type Faq = { question: string; answer: string };

function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function Breadcrumb({ current }: { current?: string }) {
  return (
    <nav className="flex items-center gap-2 text-muted" aria-label="Breadcrumb">
      <a href="/" aria-label="Mesurer home" className="inline-flex transition-opacity hover:opacity-70">
        <img src="/logo.svg" alt="" draggable={false} className="size-6" />
      </a>
      <span aria-hidden="true">/</span>
      {current ? (
        <>
          <a href="/tools" className="transition-colors hover:text-strong">Tools</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-strong">{current}</span>
        </>
      ) : (
        <span aria-current="page" className="text-strong">Tools</span>
      )}
    </nav>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-[450] text-strong">{title}</h2>
      <div className="flex flex-col gap-3 text-pretty leading-relaxed text-neutral-600">{children}</div>
    </section>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[14px]">
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col" className="border-b border-border py-2 pr-4 font-[450] text-strong">{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-border py-2 pr-4 align-middle text-neutral-600">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MesurerCta({ children }: { children: ReactNode }) {
  return (
    <aside className="flex flex-col items-start gap-4 rounded-xl bg-subtle p-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-[450] text-strong">Do this on any live page with Mesurer</h2>
        <p className="text-pretty leading-relaxed text-neutral-600">{children}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button href={chromeStoreUrl} target="_blank" rel="noreferrer">Add to Chrome</Button>
        <Button href="/" variant="secondary">See how it works</Button>
      </div>
    </aside>
  );
}

export function OtherTools({ current }: { current?: string }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {TOOLS.filter((tool) => tool.slug !== current).map((tool) => (
        <li key={tool.slug}>
          <a
            href={toolHref(tool.slug)}
            className="flex h-full flex-col gap-1 rounded-xl border border-border p-4 transition-colors hover:border-neutral-300 hover:bg-subtle"
          >
            <span className="font-[450] text-strong">{tool.name}</span>
            <span className="text-[14px] text-muted">{tool.summary}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function ToolPage({
  slug,
  name,
  title,
  description,
  heading,
  intro,
  tool,
  children,
  faq,
  cta,
}: {
  slug: string;
  /** The tool's short name, for the breadcrumb and what search engines are told. */
  name: string;
  /** The page's title, as search results show it. */
  title: string;
  description: string;
  heading: string;
  intro: string;
  tool: ReactNode;
  /** What is written under the tool. */
  children: ReactNode;
  faq: Faq[];
  cta: ReactNode;
}) {
  const url = `${SITE}${toolHref(slug)}`;
  return (
    <main className="min-h-dvh pb-0 pt-20">
      <PageMetadata title={title} description={description} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebApplication",
              name,
              url,
              description,
              applicationCategory: "DesignApplication",
              operatingSystem: "Any",
              browserRequirements: "Requires JavaScript",
              isAccessibleForFree: true,
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              publisher: { "@type": "Organization", name: "Mesurer", url: SITE },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Mesurer", item: SITE },
                { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE}/tools` },
                { "@type": "ListItem", position: 3, name, item: url },
              ],
            },
            {
              "@type": "FAQPage",
              mainEntity: faq.map(({ question, answer }) => ({
                "@type": "Question",
                name: question,
                acceptedAnswer: { "@type": "Answer", text: answer },
              })),
            },
          ],
        }}
      />
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-5 pb-32">
        <Breadcrumb current={name} />
        <header className="flex flex-col gap-3">
          <h1 id="tool-title" className="text-balance text-3xl font-[450] tracking-tight text-strong">{heading}</h1>
          <p className="max-w-2xl text-pretty text-[17px] leading-relaxed text-neutral-600">{intro}</p>
        </header>
        {tool}
        <article className="flex flex-col gap-12 pt-4">
          {children}
          <Section title="Frequently asked questions">
            <dl className="flex flex-col gap-5">
              {faq.map(({ question, answer }) => (
                <div key={question} className="flex flex-col gap-1">
                  <dt className="font-[450] text-strong">{question}</dt>
                  <dd className="m-0">{answer}</dd>
                </div>
              ))}
            </dl>
          </Section>
          <MesurerCta>{cta}</MesurerCta>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-[450] text-strong">More free tools</h2>
            <OtherTools current={slug} />
          </section>
        </article>
      </div>
      <MarketingFooter />
    </main>
  );
}

export function ToolsHub() {
  const title = "Free Design and Developer Tools | Mesurer";
  const description =
    "Free online tools for designers and developers: an aspect ratio calculator, a color picker, and RGB to HEX and HEX to RGB converters. No sign-up, nothing to install.";
  return (
    <main className="min-h-dvh pb-0 pt-20">
      <PageMetadata title={title} description={description} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Free design and developer tools",
          url: `${SITE}/tools`,
          description,
          hasPart: TOOLS.map((tool) => ({ "@type": "WebApplication", name: tool.name, url: `${SITE}${toolHref(tool.slug)}` })),
        }}
      />
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-5 pb-32">
        <Breadcrumb />
        <header className="flex flex-col gap-3">
          <h1 id="tool-title" className="text-balance text-3xl font-[450] tracking-tight text-strong">Free design and developer tools</h1>
          <p className="max-w-2xl text-pretty text-[17px] leading-relaxed text-neutral-600">
            Small tools for the sums and conversions that come up while building an interface. They run in your browser, they are free, and there is nothing to sign up for.
          </p>
        </header>
        <OtherTools />
        <MesurerCta>
          Mesurer is a browser extension that measures spacing, samples colors, inspects type, and collects feedback right on the page you are working on.
        </MesurerCta>
      </div>
      <MarketingFooter />
    </main>
  );
}
