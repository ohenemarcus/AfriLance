import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/react";

const CATEGORIES = [
  { value: "account", label: "Account access" },
  { value: "profile", label: "Profile or verification" },
  { value: "jobs", label: "Jobs or proposals" },
  { value: "payments", label: "Payments" },
  { value: "safety", label: "Safety or a user report" },
  { value: "other", label: "Something else" },
];

export default function SupportPage() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [form, setForm] = useState({ name: "", email: "", category: "account", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<number | null>(null);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      name: current.name || user?.fullName || "",
      email: current.email || user?.primaryEmailAddress?.emailAddress || "",
    }));
  }, [user]);

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const token = isSignedIn ? await getToken() : null;
      const response = await fetch("/api/support/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Your request could not be sent.");
      setRequestId(body.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your request could not be sent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[70vh] bg-background px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[minmax(0,1fr)_300px]">
        <section>
          <p className="text-sm font-semibold text-primary">AfriLance support</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">How can we help?</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Send our team a message about your account, a project, or a payment. We’ll reply to the email address you provide.</p>

          {requestId ? (
            <div role="status" className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
              <h2 className="font-semibold">Your request is with our support team.</h2>
              <p className="mt-1 text-sm">Reference #{requestId}. We’ll reply to {form.email}.</p>
              <button type="button" onClick={() => { setRequestId(null); setForm((current) => ({ ...current, subject: "", message: "" })); }} className="mt-4 text-sm font-semibold underline underline-offset-4">Send another request</button>
            </div>
          ) : (
            <form onSubmit={submitRequest} className="mt-8 space-y-5">
              {error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-foreground">Your name
                  <input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 font-normal" autoComplete="name" />
                </label>
                <label className="text-sm font-medium text-foreground">Reply email
                  <input required type="email" maxLength={320} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 font-normal" autoComplete="email" />
                </label>
              </div>
              <label className="block text-sm font-medium text-foreground">What do you need help with?
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 font-normal">
                  {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-foreground">Subject
                <input required minLength={3} maxLength={160} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 font-normal" />
              </label>
              <label className="block text-sm font-medium text-foreground">Message
                <textarea required minLength={10} maxLength={5000} rows={6} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className="mt-1.5 w-full resize-y rounded-lg border border-border bg-card px-3 py-2.5 font-normal" />
              </label>
              <p className="text-xs leading-5 text-muted-foreground">Please don’t include passwords, payment card details, or identity document numbers.</p>
              <button type="submit" disabled={submitting} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? "Sending…" : "Send to support"}
              </button>
            </form>
          )}
        </section>

        <aside className="h-fit border-t border-border pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <h2 className="font-semibold text-foreground">Common topics</h2>
          <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
            <li>Account access and profile setup</li>
            <li>Job posts, proposals, and messages</li>
            <li>Payment status and disputes</li>
            <li>Safety concerns and account reports</li>
          </ul>
          <p className="mt-6 text-xs leading-5 text-muted-foreground">Support requests are stored securely for our team to review. Your reply email is only used to respond to your request.</p>
        </aside>
      </div>
    </main>
  );
}
