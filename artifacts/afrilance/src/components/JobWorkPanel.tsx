import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { Paperclip } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { useFileUpload } from "@/hooks/useFileUpload";

type WorkAttachment = {
  id: number;
  fileName: string;
  contentType: string;
};

type WorkSubmission = {
  id: number;
  note: string;
  status: string;
  revisionNote: string | null;
  createdAt: string;
  attachments: WorkAttachment[];
};

type JobWorkPanelProps = {
  jobId: number;
  jobStatus: string;
  isClient: boolean;
  isAcceptedFreelancer: boolean;
  fundingHref: string;
  onJobUpdated: () => void;
};

function SubmissionFile({ jobId, submissionId, attachment }: { jobId: number; submissionId: number; attachment: WorkAttachment }) {
  const { getToken } = useAuth();
  const [objectUrl, setObjectUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let localUrl = "";
    void (async () => {
      try {
        const token = await getToken();
        const response = await fetch(`/api/jobs/${jobId}/submissions/${submissionId}/attachments/${attachment.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Could not load this file");
        localUrl = URL.createObjectURL(await response.blob());
        setObjectUrl(localUrl);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load this file");
      }
    })();
    return () => {
      controller.abort();
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [attachment.id, getToken, jobId, submissionId]);

  if (error) return <span className="text-xs text-destructive">{attachment.fileName}: {error}</span>;
  if (!objectUrl) return <span className="text-xs text-muted-foreground">Loading {attachment.fileName}…</span>;
  return <a href={objectUrl} target="_blank" rel="noreferrer" download={attachment.fileName} className="text-sm font-medium text-primary underline underline-offset-2">{attachment.fileName}</a>;
}

export function JobWorkPanel({ jobId, jobStatus, isClient, isAcceptedFreelancer, fundingHref, onJobUpdated }: JobWorkPanelProps) {
  const { getToken } = useAuth();
  const [submissions, setSubmissions] = useState<WorkSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const { uploadFile, isUploading, error: uploadError } = useFileUpload({
    maxSizeMB: 10,
    accept: ["image/", "application/", "text/"],
  });

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const token = await getToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...init, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Project update failed");
    return body as T;
  }, [getToken]);

  const loadSubmissions = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const result = await request<{ submissions: WorkSubmission[] }>(`/api/jobs/${jobId}/submissions`, { signal });
      setSubmissions(result.submissions);
      setError("");
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Could not load project updates");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [jobId, request]);

  useEffect(() => {
    if (!isClient && !isAcceptedFreelancer) return;
    const controller = new AbortController();
    void loadSubmissions(controller.signal);
    return () => controller.abort();
  }, [isAcceptedFreelancer, isClient, loadSubmissions]);

  if (!isClient && !isAcceptedFreelancer) return null;

  const latestSubmission = submissions[0];
  const stageCopy: Record<string, string> = {
    awaiting_funding: isClient
      ? "A freelancer is selected. Fund the accepted proposal before work begins."
      : "Your proposal was accepted. Work can begin after the client confirms payment.",
    payment_pending: isClient
      ? "Payment checkout is pending. Complete or verify the Paystack charge before work begins."
      : "The client is completing payment. Wait for the funded status before beginning work.",
    in_progress: isClient
      ? "The freelancer is working on the project. You’ll review their delivery here."
      : "Work is underway. Submit a summary and files when the agreed work is ready for review.",
    awaiting_approval: isClient
      ? "Review the submitted work. Approve it or request a specific revision."
      : "Your work is with the client for review. They can approve it or request revisions.",
    awaiting_release: isClient
      ? "Work is approved. Release the escrowed payment from the Payments page to finish the project."
      : "The client approved your work. They can release payment to the bank or Mobile Money method you saved in Payments.",
    completed: "The project is complete and the Paystack transfer has been confirmed.",
    cancelled: "The client cancelled this hire before payment was started.",
    closed: "This listing is closed and is not accepting proposals.",
  };

  const submitWork = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (note.trim().length < 10) { setError("Add at least 10 characters describing the completed work."); return; }
    setBusy(true);
    setError("");
    try {
      const attachments: Array<{ objectPath: string; fileName: string; contentType: string }> = [];
      for (const file of files) {
        const objectPath = await uploadFile(file);
        if (!objectPath) throw new Error("A file could not be uploaded. Please retry or remove it.");
        attachments.push({ objectPath, fileName: file.name, contentType: file.type || "application/octet-stream" });
      }
      await request(`/api/jobs/${jobId}/submissions`, {
        method: "POST",
        body: JSON.stringify({ note: note.trim(), attachments }),
      });
      setNote("");
      setFiles([]);
      await loadSubmissions();
      onJobUpdated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit the work");
    } finally {
      setBusy(false);
    }
  };

  const requestRevision = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!latestSubmission) return;
    setBusy(true);
    setError("");
    try {
      await request(`/api/jobs/${jobId}/submissions/${latestSubmission.id}/revisions`, {
        method: "POST",
        body: JSON.stringify({ note: revisionNote.trim() }),
      });
      setRevisionNote("");
      await loadSubmissions();
      onJobUpdated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not request revisions");
    } finally {
      setBusy(false);
    }
  };

  const approveWork = async () => {
    if (!latestSubmission) return;
    setBusy(true);
    setError("");
    try {
      await request(`/api/jobs/${jobId}/submissions/${latestSubmission.id}/approve`, { method: "POST" });
      await loadSubmissions();
      onJobUpdated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not approve the work");
    } finally {
      setBusy(false);
    }
  };

  const cancelHire = async () => {
    if (!window.confirm("Cancel this hire? This is only available before payment begins.")) return;
    setBusy(true);
    setError("");
    try {
      await request(`/api/jobs/${jobId}/cancel-hire`, { method: "POST" });
      onJobUpdated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not cancel the hire");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Project progress</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{stageCopy[jobStatus] ?? "Follow the project status and use messages to coordinate next steps."}</p>
        </div>
        <StatusBadge status={jobStatus} />
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {uploadError && <p role="alert" className="mt-2 text-sm text-destructive">{uploadError}</p>}

      {jobStatus === "awaiting_funding" && isClient && (
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <p><Link to={fundingHref} className="font-semibold text-primary underline underline-offset-2">Fund accepted proposal</Link> through Paystack.</p>
          <button type="button" onClick={() => void cancelHire()} disabled={busy} className="text-sm font-medium text-destructive underline underline-offset-2 disabled:opacity-50">Cancel hire</button>
        </div>
      )}
      {jobStatus === "payment_pending" && isClient && (
        <p className="mt-4 text-sm"><Link to="/payments" className="font-semibold text-primary underline underline-offset-2">Open Payments</Link> to complete or verify Paystack checkout.</p>
      )}
      {jobStatus === "awaiting_funding" && isAcceptedFreelancer && (
        <p className="mt-4 text-sm"><Link to="/messages" className="font-semibold text-primary underline underline-offset-2">Message the client</Link> to coordinate while funding is completed.</p>
      )}

      {jobStatus === "in_progress" && isAcceptedFreelancer && (
        <form onSubmit={submitWork} className="mt-5 space-y-3 border-t border-border pt-4">
          <label className="block text-sm font-medium text-foreground">Work summary
            <textarea required minLength={10} maxLength={5000} rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe what you completed and any details the client should review." className="mt-1.5 w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          </label>
          <label className="block text-sm font-medium text-foreground">Files <span className="font-normal text-muted-foreground">(optional, up to 5; max 10 MB each)</span>
            <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.csv,.zip" onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              if (selected.length > 5) {
                setFiles([]);
                setError("Choose no more than five files.");
              } else {
                setFiles(selected);
              }
              event.currentTarget.value = "";
            }} className="mt-1.5 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground" />
          </label>
          {files.length > 0 && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="h-3.5 w-3.5" />{files.map((file) => file.name).join(", ")}</p>}
          <button type="submit" disabled={busy || isUploading || note.trim().length < 10} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
            {busy || isUploading ? "Submitting…" : "Submit work for review"}
          </button>
        </form>
      )}

      {loading ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">Loading project updates…</p>
      ) : submissions.length > 0 ? (
        <div className="mt-5 space-y-4 border-t border-border pt-4">
          {submissions.map((submission) => (
            <article key={submission.id} className="rounded-lg bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusBadge status={submission.status} />
                <time className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(submission.createdAt))}</time>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{submission.note}</p>
              {submission.revisionNote && <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Revision request:</strong> {submission.revisionNote}</p>}
              {submission.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                  {submission.attachments.map((attachment) => <SubmissionFile key={attachment.id} jobId={jobId} submissionId={submission.id} attachment={attachment} />)}
                </div>
              )}
              {submission.status === "awaiting_approval" && isClient && jobStatus === "awaiting_approval" && (
                <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                  <form onSubmit={requestRevision} className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Request a revision
                      <textarea required minLength={5} maxLength={2000} rows={3} value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} placeholder="Explain what needs to change." className="mt-1.5 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                    <button type="submit" disabled={busy || revisionNote.trim().length < 5} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50">Request revisions</button>
                  </form>
                  <div className="flex flex-col items-start justify-end gap-2">
                    <p className="text-xs leading-5 text-muted-foreground">After approval, release the payment from Payments. It will be sent to the freelancer’s saved payout method; their account details stay private.</p>
                    <button type="button" onClick={() => void approveWork()} disabled={busy} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{busy ? "Saving…" : "Approve work"}</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : jobStatus === "awaiting_approval" ? (
        <p className="mt-4 text-sm text-muted-foreground">The project is awaiting review, but no submission is available. Contact support if this persists.</p>
      ) : null}

      {jobStatus === "awaiting_release" && isClient && (
        <p className="mt-4 text-sm"><Link to="/payments" className="font-semibold text-primary underline underline-offset-2">Open Payments</Link> to release the approved payment.</p>
      )}
      {jobStatus === "completed" && (
        <p className="mt-4 text-sm text-muted-foreground">Payment transfer confirmed. Both parties can now leave a review.</p>
      )}
    </section>
  );
}
