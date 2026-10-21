import { useEffect, useRef, useState } from "react";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@workspace/api-zod";

type LegalDocument = "terms" | "privacy";

export function LegalReviewDialog({
  open,
  title,
  acceptLabel,
  saving = false,
  error,
  dismissible = false,
  onAccept,
  onDismiss,
}: {
  open: boolean;
  title: string;
  acceptLabel: string;
  saving?: boolean;
  error?: string;
  dismissible?: boolean;
  onAccept: () => void;
  onDismiss?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [document, setDocument] = useState<LegalDocument>("terms");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (dismissible) onDismiss?.();
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      aria-labelledby="legal-review-title"
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none bg-transparent p-0 text-foreground backdrop:bg-black/60"
    >
      <section className="mx-auto flex h-full w-full flex-col overflow-hidden bg-card shadow-2xl sm:my-[5vh] sm:h-[90vh] sm:max-w-5xl sm:rounded-2xl sm:border sm:border-border">
        <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-primary">Afrlance policies</p>
            <h2 id="legal-review-title" className="mt-1 text-lg font-bold sm:text-xl">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Review both documents. Your acceptance is recorded with their current versions.
            </p>
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Close policy review"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </header>

        <nav className="flex gap-2 border-b border-border px-4 py-3 sm:px-6" aria-label="Policy documents">
          <button
            type="button"
            onClick={() => setDocument("terms")}
            aria-pressed={document === "terms"}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${document === "terms" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            Terms of Service <span className="text-xs opacity-75">v{CURRENT_TERMS_VERSION}</span>
          </button>
          <button
            type="button"
            onClick={() => setDocument("privacy")}
            aria-pressed={document === "privacy"}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${document === "privacy" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            Privacy Policy <span className="text-xs opacity-75">v{CURRENT_PRIVACY_VERSION}</span>
          </button>
        </nav>

        <iframe
          key={document}
          title={document === "terms" ? "Terms of Service" : "Privacy Policy"}
          src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/${document}`}
          className="min-h-0 flex-1 bg-background"
        />

        <footer className="space-y-3 border-t border-border px-4 py-4 sm:px-6">
          <label className="flex items-start gap-3 text-sm leading-5">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>I agree to the Terms of Service and acknowledge the Privacy Policy.</span>
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {dismissible && (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
              >
                Not now
              </button>
            )}
            <button
              type="button"
              onClick={onAccept}
              disabled={!checked || saving}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : acceptLabel}
            </button>
          </div>
        </footer>
      </section>
    </dialog>
  );
}
