import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetJob,
  useGetMyProfile,
  useCreateProposal,
  useListJobProposals,
  useUpdateProposalStatus,
  useUpdateJob,
  useListProfileReviews,
  getGetJobQueryKey,
  getListJobProposalsQueryKey,
  getGetMyProfileQueryKey,
  getListProfileReviewsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Show } from "@clerk/react";
import { Skeleton } from "@/components/ui/skeleton";
import { SkillBadge } from "@/components/SkillBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { StarRating } from "@/components/StarRating";
import { ReviewModal } from "@/components/ReviewModal";
import { formatBudget, formatDate, formatRelative } from "@/lib/format";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const jobId = parseInt(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: job, isLoading } = useGetJob(jobId, {
    query: { enabled: !!jobId, queryKey: getGetJobQueryKey(jobId) },
  });
  const { data: profile } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() },
  });
  const { data: proposalsData } = useListJobProposals(jobId, {
    query: {
      enabled: !!profile && (profile.role === "client" || profile.role === "admin"),
      queryKey: getListJobProposalsQueryKey(jobId),
    },
  });

  const acceptedProposal = proposalsData?.proposals.find((p) => p.status === "accepted");

  const { data: freelancerReviews } = useListProfileReviews(
    acceptedProposal?.freelancerId ?? 0,
    {
      query: {
        enabled: !!acceptedProposal?.freelancerId,
        queryKey: getListProfileReviewsQueryKey(acceptedProposal?.freelancerId ?? 0),
      },
    },
  );

  const { data: clientReviews } = useListProfileReviews(job?.clientId ?? 0, {
    query: {
      enabled: !!job?.clientId && profile?.role === "freelancer",
      queryKey: getListProfileReviewsQueryKey(job?.clientId ?? 0),
    },
  });

  const { mutate: createProposal, isPending: proposalPending } = useCreateProposal();
  const { mutate: updateStatus } = useUpdateProposalStatus();
  const { mutate: updateJob } = useUpdateJob();

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [proposal, setProposal] = useState({ coverLetter: "", bidAmount: "" });
  const [proposalError, setProposalError] = useState("");
  const [proposalSuccess, setProposalSuccess] = useState(false);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Job not found.</p>
        <button onClick={() => setLocation("/jobs")} className="mt-4 text-primary hover:underline text-sm">
          Back to Jobs
        </button>
      </div>
    );
  }

  const isOwner = profile?.id === job.clientId;
  const isFreelancer = profile?.role === "freelancer";
  const myAcceptedProposal = proposalsData?.proposals.find(
    (p) => p.freelancerId === profile?.id && p.status === "accepted",
  );

  const jobIsClosedOrInProgress = job.status === "closed" || job.status === "in_progress";

  const clientAlreadyReviewedFreelancer = freelancerReviews?.reviews.some(
    (r) => r.reviewerId === profile?.id && r.jobId === jobId,
  );

  const freelancerAlreadyReviewedClient = clientReviews?.reviews.some(
    (r) => r.reviewerId === profile?.id && r.jobId === jobId,
  );

  const canClientLeaveReview =
    isOwner && jobIsClosedOrInProgress && !!acceptedProposal && !clientAlreadyReviewedFreelancer && !reviewSuccess;

  const canFreelancerLeaveReview =
    isFreelancer && jobIsClosedOrInProgress && !!myAcceptedProposal && !freelancerAlreadyReviewedClient && !reviewSuccess;

  const reviewTarget = isOwner
    ? { id: acceptedProposal?.freelancerId ?? 0, name: acceptedProposal?.freelancerName, role: "freelancer" as const }
    : { id: job.clientId, name: job.clientName, role: "client" as const };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposal.coverLetter.trim() || !proposal.bidAmount) {
      setProposalError("Please fill in all fields");
      return;
    }
    setProposalError("");
    createProposal(
      {
        data: {
          jobId,
          coverLetter: proposal.coverLetter.trim(),
          bidAmount: parseFloat(proposal.bidAmount),
        },
      },
      {
        onSuccess: () => {
          setProposalSuccess(true);
          setShowApplyModal(false);
          setProposal({ coverLetter: "", bidAmount: "" });
          queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
        },
        onError: (err: any) => {
          setProposalError(err?.data?.error ?? "Failed to submit proposal");
        },
      },
    );
  };

  const handleStatusUpdate = (proposalId: number, status: string) => {
    updateStatus(
      { id: proposalId, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListJobProposalsQueryKey(jobId) });
        },
      },
    );
  };

  const handleCloseJob = () => {
    updateJob(
      { id: jobId, data: { status: "closed" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
        },
      },
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => setLocation("/jobs")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Jobs
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h1 className="text-xl font-bold text-foreground">{job.title}</h1>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span>{job.category}</span>
                  <span>·</span>
                  <span>{formatRelative(job.createdAt)}</span>
                </div>
              </div>
              <StatusBadge status={job.status} />
            </div>

            <p className="text-sm text-foreground leading-relaxed mb-5 whitespace-pre-line">{job.description}</p>

            <div className="flex flex-wrap gap-2 mb-5">
              {job.skills.map((s) => <SkillBadge key={s} skill={s} />)}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Budget</div>
                <div className="font-semibold text-primary">{formatBudget(job.budgetMin, job.budgetMax, job.budgetType)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Type</div>
                <div className="font-medium text-foreground capitalize">{job.budgetType}</div>
              </div>
              {job.location && (
                <div>
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Location</div>
                  <div className="font-medium text-foreground">{job.location}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Remote</div>
                <div className="font-medium text-foreground">{job.remote ? "Yes" : "No"}</div>
              </div>
              {job.deadline && (
                <div>
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Deadline</div>
                  <div className="font-medium text-foreground">{formatDate(job.deadline)}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Proposals</div>
                <div className="font-medium text-foreground">{job.proposalCount}</div>
              </div>
            </div>
          </div>

          {/* Client proposals management */}
          {isOwner && proposalsData && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-foreground mb-4">
                Proposals ({proposalsData.total})
              </h2>
              {proposalsData.proposals.length === 0 ? (
                <p className="text-muted-foreground text-sm">No proposals yet.</p>
              ) : (
                <div className="space-y-4">
                  {proposalsData.proposals.map((p) => (
                    <div key={p.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={p.freelancerName} size="sm" />
                          <div>
                            <div className="text-sm font-medium text-foreground">{p.freelancerName}</div>
                            <StarRating rating={p.freelancerAvgRating} />
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-primary">₵{p.bidAmount}</div>
                          <StatusBadge status={p.status} />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{p.coverLetter}</p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {(p.freelancerSkills ?? []).slice(0, 3).map((s: string) => <SkillBadge key={s} skill={s} />)}
                      </div>
                      {p.status === "submitted" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleStatusUpdate(p.id, "accepted")}
                            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(p.id, "under_review")}
                            className="px-3 py-1.5 bg-secondary text-primary rounded-lg text-xs font-medium hover:opacity-90"
                          >
                            Review
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(p.id, "rejected")}
                            className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Client info */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Posted by</h3>
            <div className="flex items-center gap-3">
              <UserAvatar name={job.clientName} size="md" />
              <div>
                <div className="font-medium text-foreground text-sm">{job.clientName ?? "Client"}</div>
                <div className="text-xs text-muted-foreground">Client</div>
              </div>
            </div>
          </div>

          {/* Apply / Manage */}
          <Show when="signed-in">
            {isFreelancer && job.status === "open" && (
              <div className="bg-card border border-border rounded-xl p-5">
                {proposalSuccess ? (
                  <div className="text-center">
                    <div className="text-green-600 font-medium text-sm mb-1">Proposal submitted!</div>
                    <p className="text-xs text-muted-foreground">The client will review your proposal.</p>
                  </div>
                ) : (
                  <>
                    <h3 className="font-semibold text-foreground mb-3">Submit a Proposal</h3>
                    <button
                      onClick={() => setShowApplyModal(true)}
                      className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                      Apply Now
                    </button>
                  </>
                )}
              </div>
            )}

            {isOwner && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-2">
                <h3 className="font-semibold text-foreground mb-2">Manage Job</h3>
                {job.status === "open" && (
                  <button
                    onClick={handleCloseJob}
                    className="w-full py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Close Job
                  </button>
                )}
              </div>
            )}

            {/* Review CTA */}
            {(canClientLeaveReview || canFreelancerLeaveReview) && (
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Leave a Review</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Share your experience to help the community
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Write a Review
                </button>
              </div>
            )}

            {reviewSuccess && (
              <div className="bg-card border border-border rounded-xl p-5 text-center">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground">Review submitted!</p>
                <p className="text-xs text-muted-foreground mt-1">Thank you for your feedback.</p>
              </div>
            )}
          </Show>

          <Show when="signed-out">
            <div className="bg-card border border-border rounded-xl p-5 text-center">
              <p className="text-sm text-muted-foreground mb-3">Sign in to apply for this job</p>
              <a
                href="/sign-in"
                className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
              >
                Sign In
              </a>
            </div>
          </Show>
        </div>
      </div>

      {/* Apply modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">Submit Proposal</h2>
              <button onClick={() => setShowApplyModal(false)} className="text-muted-foreground hover:text-foreground">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleApply} className="space-y-4">
              {proposalError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  {proposalError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Cover Letter *</label>
                <textarea
                  rows={5}
                  required
                  value={proposal.coverLetter}
                  onChange={(e) => setProposal((p) => ({ ...p, coverLetter: e.target.value }))}
                  placeholder="Introduce yourself and explain why you're the best fit for this job..."
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Your Bid (GHS) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₵</span>
                  <input
                    type="number"
                    required
                    min="1"
                    value={proposal.bidAmount}
                    onChange={(e) => setProposal((p) => ({ ...p, bidAmount: e.target.value }))}
                    placeholder="500"
                    className="w-full pl-7 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={proposalPending}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {proposalPending ? "Submitting..." : "Submit Proposal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review modal */}
      {showReviewModal && (
        <ReviewModal
          jobId={jobId}
          revieweeId={reviewTarget.id}
          revieweeName={reviewTarget.name}
          revieweeRole={reviewTarget.role}
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => {
            setShowReviewModal(false);
            setReviewSuccess(true);
          }}
        />
      )}
    </div>
  );
}
