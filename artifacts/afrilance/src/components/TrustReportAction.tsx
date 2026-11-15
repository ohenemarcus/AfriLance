import { useState } from "react";
import { useAuth, Show } from "@clerk/react";
import { Flag } from "lucide-react";
import { serviceRequest } from "@/lib/services";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ReportTarget = "profile" | "service";

const reasons = [
  { value: "suspicious", label: "Suspicious or fraudulent" },
  { value: "harassment", label: "Harassment or abusive behavior" },
  { value: "misleading", label: "Misleading information" },
  { value: "other", label: "Other safety concern" },
] as const;

export function TrustReportAction({
  target,
  targetId,
  targetName,
  ownerUserId,
}: {
  target: ReportTarget;
  targetId: number;
  targetName: string;
  ownerUserId?: string;
}) {
  const { getToken, userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof reasons)[number]["value"]>("suspicious");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (ownerUserId && userId === ownerUserId) return null;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const token = await getToken();
      await serviceRequest(`/api/${target === "profile" ? "profiles" : "services"}/${targetId}/reports`, token, {
        method: "POST",
        body: JSON.stringify({ reason, details }),
      });
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Show when="signed-in">
        <Dialog open={open} onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setSubmitted(false);
            setError("");
          }
        }}>
          <DialogTrigger asChild>
            <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-destructive hover:underline">
              <Flag className="size-4" aria-hidden="true" /> Report
            </button>
          </DialogTrigger>
          <DialogContent>
            {submitted ? (
              <>
                <DialogHeader>
                  <DialogTitle>Report received</DialogTitle>
                  <DialogDescription>Thank you for helping keep AfriLance safe. Our team will review your report.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <a href="/support" className="text-sm font-medium text-primary underline underline-offset-4">Contact support</a>
                </DialogFooter>
              </>
            ) : (
              <form onSubmit={(event) => void submit(event)} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Report {target === "profile" ? "profile" : "service listing"}</DialogTitle>
                  <DialogDescription>
                    Tell our moderation team what concerns you about “{targetName}”. Reports are reviewed privately.
                  </DialogDescription>
                </DialogHeader>
                <label className="block text-sm font-medium text-foreground">
                  Reason
                  <select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5">
                    {reasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-foreground">
                  Additional details (optional)
                  <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} rows={4} className="mt-1.5 w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 font-normal" />
                </label>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <DialogFooter>
                  <a href="/support" className="mr-auto text-sm text-muted-foreground underline underline-offset-4">Need help? Contact support</a>
                  <button type="submit" disabled={submitting} className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50">
                    {submitting ? "Sending…" : "Submit report"}
                  </button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </Show>
      <Show when="signed-out">
        <a href="/sign-in" className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">Sign in to report</a>
      </Show>
    </>
  );
}
