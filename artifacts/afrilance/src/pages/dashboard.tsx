import { useState } from "react";
import { Link } from "wouter";
import {
  useGetMyProfile,
  useGetFreelancerDashboard,
  useGetClientDashboard,
  useListSavedJobs,
  useUnsaveJob,
  getGetFreelancerDashboardQueryKey,
  getGetClientDashboardQueryKey,
  getListSavedJobsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBudget, formatRelative, formatCurrency } from "@/lib/format";

function StatCard({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-xl p-5 ${className ?? ""}`}>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

// function ProfileCompletenessWidget({ profile }: { profile: NonNullable<ReturnType<typeof useGetMyProfile>["data"]> }) {
//   const fields = [
//     { label: "Name", done: !!profile.name?.trim() },
//     { label: "Bio", done: !!profile.bio?.trim() },
//     { label: "Location", done: !!profile.location?.trim() },
//     { label: "Category", done: !!profile.category },
//     { label: "Skills", done: (profile.skills?.length ?? 0) >= 1 },
//     { label: "Hourly rate", done: profile.hourlyRate != null },
//     { label: "Portfolio item", done: (profile.portfolioItems?.length ?? 0) >= 1 },
//   ];
type Profile = {
  name?: string | null;
  bio?: string | null;
  location?: string | null;
  category?: string | null;
  skills?: string[] | null;
  hourlyRate?: number | null;
  portfolioItems?: unknown[] | null;
};

function ProfileCompletenessWidget({ profile }: { profile: Profile })
{
  const fields = [
    { label: "Name", done: !!profile.name?.trim() },
    { label: "Bio", done: !!profile.bio?.trim() },
    { label: "Location", done: !!profile.location?.trim() },
    { label: "Category", done: !!profile.category },
    { label: "Skills", done: (profile.skills?.length ?? 0) >= 1 },
    { label: "Hourly rate", done: profile.hourlyRate != null },
    { label: "Portfolio item", done: (profile.portfolioItems?.length ?? 0) >= 1 },
  ];

  const done = fields.filter((f) => f.done).length;
  const pct = Math.round((done / fields.length) * 100);

  if (pct === 100) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground">Profile Completeness</h3>
          <p className="text-xs text-muted-foreground mt-0.5">A complete profile gets 3× more views</p>
        </div>
        <span className={`text-2xl font-bold ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-500" : "text-destructive"}`}>
          {pct}%
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-2 mb-4">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-destructive"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-4">
        {fields.map((f) => (
          <div key={f.label} className={`flex items-center gap-1.5 text-xs ${f.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
            {f.done ? (
              <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <div className="w-3.5 h-3.5 border-2 border-muted-foreground/40 rounded-full flex-shrink-0" />
            )}
            {f.label}
          </div>
        ))}
      </div>
      <Link
        to="/settings"
        className="inline-flex items-center px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
      >
        Complete Your Profile →
      </Link>
    </div>
  );
}

function SavedJobsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListSavedJobs({
    query: { queryKey: getListSavedJobsQueryKey() },
  });
  const { mutate: unsaveJob } = useUnsaveJob();

  const handleUnsave = (jobId: number) => {
    unsaveJob({ jobId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSavedJobsQueryKey() }),
    });
  };

  if (isLoading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;
  }

  if (!data?.savedJobs.length) {
    return (
      <div className="text-center py-12 bg-card border border-border rounded-xl">
        <svg className="w-10 h-10 text-muted-foreground mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <p className="text-muted-foreground font-medium">No saved jobs yet</p>
        <p className="text-sm text-muted-foreground mt-1 mb-4">Bookmark jobs you're interested in</p>
        <Link to="/jobs" className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          Browse Jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{data.total} saved {data.total === 1 ? "job" : "jobs"}</p>
      {data.savedJobs.map((s) => (
        <div key={s.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {s.job ? (
              <Link to={`/jobs/${s.job.id}`} className="font-medium text-foreground hover:text-primary transition-colors line-clamp-1">
                {s.job.title}
              </Link>
            ) : (
              <span className="font-medium text-muted-foreground">Job removed</span>
            )}
            {s.job && (
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                <span className="font-medium text-primary">{formatBudget(s.job.budgetMin, s.job.budgetMax, s.job.budgetType)}</span>
                {s.job.remote && <span>Remote</span>}
                {s.job.location && <span>{s.job.location}</span>}
                <span>Saved {formatRelative(s.createdAt)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {s.job && <StatusBadge status={s.job.status} />}
            <button
              onClick={() => handleUnsave(s.jobId)}
              title="Remove bookmark"
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function FreelancerDashboard({ profile }: { profile: NonNullable<ReturnType<typeof useGetMyProfile>["data"]> }) {
  const [tab, setTab] = useState<"overview" | "saved">("overview");
  const { data, isLoading } = useGetFreelancerDashboard({
    query: { queryKey: getGetFreelancerDashboardQueryKey() },
  });

  return (
    <div className="space-y-6">
      {/* Profile completeness */}
      <ProfileCompletenessWidget profile={profile} />

      {/* Tabs */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("overview")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "overview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Overview
        </button>
        <button
          onClick={() => setTab("saved")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === "saved" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          Saved Jobs
        </button>
      </div>

      {tab === "saved" ? (
        <SavedJobsTab />
      ) : isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Applications" value={data.totalApplications} />
            <StatCard label="Pending" value={data.pendingApplications} />
            <StatCard label="Accepted" value={data.acceptedApplications} />
            <StatCard label="Total Earned" value={formatCurrency(data.totalEarnings)} />
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Recent Proposals</h3>
              <Link to="/proposals" className="text-sm text-primary hover:underline">View all</Link>
            </div>
            {data.recentProposals.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm mb-3">No proposals yet</p>
                <Link to="/jobs" className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                  Browse Jobs
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {data.recentProposals.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-foreground">{p.jobTitle ?? "Untitled Job"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{formatRelative(p.createdAt)}</div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Link to="/jobs" className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-sm font-medium text-foreground">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Browse Available Jobs
                </Link>
                <Link to="/messages" className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-sm font-medium text-foreground">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  View Messages
                  {data.unreadMessages > 0 && (
                    <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">{data.unreadMessages}</span>
                  )}
                </Link>
                <Link to="/settings" className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-sm font-medium text-foreground">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Edit Profile
                </Link>
              </div>
            </div>
            <div className="bg-primary text-primary-foreground rounded-xl p-5">
              <h3 className="font-semibold mb-1">Your stats</h3>
              <div className="text-4xl font-bold text-secondary">{data.completedJobs}</div>
              <div className="text-sm text-primary-foreground/70">Jobs completed</div>
              {data.avgRating && (
                <div className="mt-3 text-sm">
                  Average rating: <span className="font-bold text-secondary">{data.avgRating.toFixed(1)} ★</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ClientDashboard() {
  const { data, isLoading } = useGetClientDashboard({
    query: { queryKey: getGetClientDashboardQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Jobs" value={data.totalJobs} />
        <StatCard label="Open Jobs" value={data.openJobs} />
        <StatCard label="Proposals Received" value={data.totalProposalsReceived} />
        <StatCard label="Total Spent" value={formatCurrency(data.totalSpent)} />
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Recent Jobs</h3>
          <Link to="/jobs/my" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        {data.recentJobs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm mb-3">No jobs posted yet</p>
            <Link to="/jobs/post" className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
              Post Your First Job
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {data.recentJobs.map((job) => (
              <Link key={job.id} to={`/jobs/${job.id}`} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/60 transition-colors">
                <div>
                  <div className="text-sm font-medium text-foreground">{job.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {job.proposalCount} proposals · {formatBudget(job.budgetMin, job.budgetMax, job.budgetType)}
                  </div>
                </div>
                <StatusBadge status={job.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <Link to="/jobs/post" className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-sm font-medium text-foreground">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Post a New Job
            </Link>
            <Link to="/freelancers" className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-sm font-medium text-foreground">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Browse Freelancers
            </Link>
            <Link to="/messages" className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-sm font-medium text-foreground">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Messages
              {data.unreadMessages > 0 && (
                <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">{data.unreadMessages}</span>
              )}
            </Link>
          </div>
        </div>
        <div className="bg-secondary text-primary rounded-xl p-5">
          <h3 className="font-semibold mb-1">Active now</h3>
          <div className="text-4xl font-bold">{data.inProgressJobs}</div>
          <div className="text-sm text-primary/70">Jobs in progress</div>
          <div className="mt-3 text-sm">
            {data.openJobs} job{data.openJobs !== 1 ? "s" : ""} still open
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: profile, isLoading } = useGetMyProfile();

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {profile?.name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {profile?.role === "freelancer" ? "Find your next opportunity" : "Manage your projects"}
        </p>
      </div>

      {profile?.role === "freelancer" && <FreelancerDashboard profile={profile} />}
      {profile?.role === "client" && <ClientDashboard />}
      {profile?.role === "admin" && (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-muted-foreground mb-4">You have admin access to this platform.</p>
          <Link to="/admin" className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            Go to Admin Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
