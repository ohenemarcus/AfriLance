import type { ReactNode } from "react";
import { Link } from "wouter";

export function LegalDocumentLayout({
  title,
  version,
  children,
}: {
  title: string;
  version: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-[100dvh] bg-background px-4 py-8 sm:px-6 sm:py-12">
      <article className="mx-auto max-w-4xl rounded-2xl border border-border bg-card px-5 py-8 shadow-sm sm:px-10 sm:py-12">
        <header className="mb-10 border-b border-border pb-6">
          <Link to="/" className="text-sm font-semibold text-primary hover:underline">
            Afrlance
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Version {version} · Effective 20 October 2026
          </p>
        </header>
        <div className="legal-document space-y-8 text-sm leading-7 text-foreground sm:text-base">
          {children}
        </div>
        <nav aria-label="Other legal documents" className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
          <Link to="/terms" className="font-medium text-primary hover:underline">Terms of Service</Link>
          <Link to="/privacy" className="font-medium text-primary hover:underline">Privacy Policy</Link>
          <Link to="/" className="font-medium text-primary hover:underline">Return to Afrlance</Link>
        </nav>
      </article>
    </main>
  );
}
