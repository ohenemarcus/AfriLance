import { Link } from "wouter";
import { useListMyProposals, getListMyProposalsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { formatRelative, formatCurrency } from "@/lib/format";

export default function ProposalsPage() {
  const { data, isLoading } = useListMyProposals({
    query: { queryKey: getListMyProposalsQueryKey() },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Proposals</h1>
        <p className="text-muted-foreground text-sm">Track all your submitted proposals</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : !data?.proposals.length ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <svg className="w-12 h-12 text-muted-foreground mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-muted-foreground font-medium">No proposals yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Browse jobs and submit your first proposal</p>
          <Link
            to="/jobs"
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            Browse Jobs
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data.proposals.map((p) => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/jobs/${p.jobId}`}
                    className="font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    {p.jobTitle ?? "Untitled Job"}
                  </Link>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{p.coverLetter}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-primary">{formatCurrency(p.bidAmount)}</span>
                    <span>{formatRelative(p.createdAt)}</span>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
