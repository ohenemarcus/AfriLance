import { Link } from "wouter";
import {
  getListMyJobsQueryKey,
  useListMyJobs,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBudget, formatRelative } from "@/lib/format";

export default function MyJobsPage() {
  const { data, isLoading, isError } = useListMyJobs({
    query: { queryKey: getListMyJobsQueryKey() },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Jobs</h1>
          <p className="text-sm text-muted-foreground">Manage the jobs you have posted</p>
        </div>
        <Link
          to="/jobs/post"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          Post a Job
        </Link>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          [...Array(5)].map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)
        ) : isError ? (
          <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-sm text-destructive">
            Unable to load your jobs. Please try again.
          </div>
        ) : data?.jobs.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <p className="text-muted-foreground font-medium">You haven’t posted any jobs yet</p>
            <Link to="/jobs/post" className="inline-flex mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
              Post Your First Job
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{data?.total ?? 0} jobs</p>
            {data?.jobs.map((job) => (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="block rounded-xl border border-border bg-card p-5 transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-foreground">{job.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  <span className="font-medium text-primary">
                    {formatBudget(job.budgetMin, job.budgetMax, job.budgetType)}
                  </span>
                  <span>{job.proposalCount} proposals</span>
                  <span className="ml-auto">{formatRelative(job.createdAt)}</span>
                </div>
              </Link>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
