import { useState } from "react";
import {
  useGetAdminStats,
  useAdminListUsers,
  useAdminListJobs,
  useAdminBlockUser,
  useAdminFlagJob,
  useAdminVerifyUser,
  useAdminChangeUserRole,
  useGetAdminAuditLogs,
  getGetAdminStatsQueryKey,
  getAdminListUsersQueryKey,
  getAdminListJobsQueryKey,
  getGetAdminAuditLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { formatRelative, formatCurrency } from "@/lib/format";

type Tab = "overview" | "users" | "jobs" | "audit";

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-5 border ${accent ? "bg-primary border-primary/30 text-primary-foreground" : "bg-card border-border"}`}>
      <div className={`text-2xl font-bold ${accent ? "text-primary-foreground" : "text-foreground"}`}>{value}</div>
      <div className={`text-sm mt-0.5 ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{label}</div>
    </div>
  );
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  block_user:          { label: "Blocked",         color: "bg-red-100 text-red-700" },
  unblock_user:        { label: "Unblocked",        color: "bg-emerald-100 text-emerald-700" },
  verify_user:         { label: "Verified",         color: "bg-blue-100 text-blue-700" },
  reject_verification: { label: "ID Rejected",      color: "bg-orange-100 text-orange-700" },
  top_rate_user:       { label: "Top Rated",        color: "bg-amber-100 text-amber-700" },
  remove_top_rated:    { label: "Top Rate Removed", color: "bg-muted text-muted-foreground" },
  flag_job:            { label: "Flagged",          color: "bg-red-100 text-red-700" },
  unflag_job:          { label: "Unflagged",        color: "bg-emerald-100 text-emerald-700" },
  change_role:         { label: "Role Changed",     color: "bg-violet-100 text-violet-700" },
};

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [userSearch, setUserSearch] = useState("");
  const [userRole, setUserRole] = useState("");
  const [jobStatus, setJobStatus] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [auditAction, setAuditAction] = useState("");
  const [auditEntity, setAuditEntity] = useState("");

  const { data: stats, isLoading: statsLoading } = useGetAdminStats({
    query: { queryKey: getGetAdminStatsQueryKey() },
  });

  const userParams = {
    ...(userSearch ? { search: userSearch } : {}),
    ...(userRole ? { role: userRole } : {}),
    limit: 20,
  };
  const { data: usersData, isLoading: usersLoading } = useAdminListUsers(userParams, {
    query: { enabled: tab === "users", queryKey: getAdminListUsersQueryKey(userParams) },
  });

  const jobParams = {
    ...(jobStatus ? { status: jobStatus } : {}),
    ...(flaggedOnly ? { flagged: true } : {}),
    limit: 20,
  };
  const { data: jobsData, isLoading: jobsLoading } = useAdminListJobs(jobParams, {
    query: { enabled: tab === "jobs", queryKey: getAdminListJobsQueryKey(jobParams) },
  });

  const auditParams = {
    ...(auditAction ? { action: auditAction } : {}),
    ...(auditEntity ? { entityType: auditEntity } : {}),
    limit: 50,
  };
  const { data: auditData, isLoading: auditLoading } = useGetAdminAuditLogs(auditParams, {
    query: { enabled: tab === "audit", queryKey: getGetAdminAuditLogsQueryKey(auditParams) },
  });

  const { mutate: blockUser } = useAdminBlockUser();
  const { mutate: flagJob } = useAdminFlagJob();
  const { mutate: verifyUser } = useAdminVerifyUser();
  const { mutate: changeRole } = useAdminChangeUserRole();

  const handleBlock = (id: number, isBlocked: boolean) => {
    blockUser(
      { id, data: { isBlocked: !isBlocked } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey(userParams) });
          queryClient.invalidateQueries({ queryKey: getGetAdminAuditLogsQueryKey(auditParams) });
        },
      },
    );
  };

  const handleVerify = (id: number, isVerified: boolean) => {
    verifyUser(
      { id, data: { isVerified: !isVerified, verificationStatus: !isVerified ? "approved" : "none" } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey(userParams) });
          queryClient.invalidateQueries({ queryKey: getGetAdminAuditLogsQueryKey(auditParams) });
        },
      },
    );
  };

  const handleTopRated = (id: number, isTopRated: boolean) => {
    verifyUser(
      { id, data: { isTopRated: !isTopRated } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey(userParams) });
          queryClient.invalidateQueries({ queryKey: getGetAdminAuditLogsQueryKey(auditParams) });
        },
      },
    );
  };

  const handleVerificationStatus = (id: number, status: "approved" | "rejected") => {
    verifyUser(
      { id, data: { verificationStatus: status, ...(status === "approved" ? { isVerified: true } : {}) } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey(userParams) });
          queryClient.invalidateQueries({ queryKey: getGetAdminAuditLogsQueryKey(auditParams) });
        },
      },
    );
  };

  const handleRoleChange = (id: number, role: "freelancer" | "client" | "admin") => {
    changeRole(
      { id, data: { role } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey(userParams) });
          queryClient.invalidateQueries({ queryKey: getGetAdminAuditLogsQueryKey(auditParams) });
        },
      },
    );
  };

  const handleFlag = (id: number, isFlagged: boolean) => {
    flagJob(
      { id, data: { isFlagged: !isFlagged } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListJobsQueryKey(jobParams) });
          queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAdminAuditLogsQueryKey(auditParams) });
        },
      },
    );
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "users", label: "Users" },
    { key: "jobs", label: "Jobs" },
    { key: "audit", label: "Audit Log" },
  ];

  return (
    <div className="min-h-screen bg-primary/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm">Platform management</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-6 w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === "overview" && (
          <div className="space-y-6">
            {statsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : stats && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <StatCard label="Total Users" value={stats.totalUsers} accent />
                  <StatCard label="Freelancers" value={stats.totalFreelancers} />
                  <StatCard label="Clients" value={stats.totalClients} />
                  <StatCard label="Total Jobs" value={stats.totalJobs} />
                  <StatCard label="Active Jobs" value={stats.activeJobs} />
                  <StatCard label="Total Proposals" value={stats.totalProposals} />
                  <StatCard label="Total Payments" value={formatCurrency(stats.totalPayments)} />
                  <StatCard label="Flagged Jobs" value={stats.flaggedJobs} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="font-semibold text-foreground mb-3">Platform Health</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Blocked users</span>
                        <span className="font-medium text-foreground">{stats.blockedUsers}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Flagged jobs</span>
                        <span className="font-medium text-destructive">{stats.flaggedJobs}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Active jobs</span>
                        <span className="font-medium text-emerald-600">{stats.activeJobs}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="font-semibold text-foreground mb-3">Quick Actions</h3>
                    <div className="space-y-2">
                      <button onClick={() => setTab("users")} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-sm font-medium text-foreground">
                        Manage Users ({stats.totalUsers})
                      </button>
                      <button onClick={() => setTab("jobs")} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-sm font-medium text-foreground">
                        Moderate Jobs ({stats.flaggedJobs} flagged)
                      </button>
                      <button onClick={() => setTab("audit")} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-sm font-medium text-foreground">
                        View Audit Log
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users..."
                className="px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-48"
              />
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                className="px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All roles</option>
                <option value="freelancer">Freelancer</option>
                <option value="client">Client</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {usersLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
            ) : !usersData?.users.length ? (
              <div className="text-center py-12 bg-card border border-border rounded-xl">
                <p className="text-muted-foreground">No users found</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/30">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Role</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Change Role</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Location</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Joined</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">ID Verification</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {usersData.users.map((u) => (
                        <tr key={u.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <UserAvatar name={u.name} size="sm" />
                              <div>
                                <div className="font-medium text-foreground flex items-center gap-1">
                                  {u.name}
                                  {(u as any).isVerified && (
                                    <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                  {(u as any).isTopRated && (
                                    <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                              u.role === "admin" ? "bg-primary/10 text-primary" :
                              u.role === "freelancer" ? "bg-blue-100 text-blue-700" :
                              "bg-amber-100 text-amber-700"
                            }`}>
                              {u.role === "admin" && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                              )}
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value as "freelancer" | "client" | "admin")}
                              className="px-2 py-1 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                            >
                              <option value="freelancer">Freelancer</option>
                              <option value="client">Client</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{u.location ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatRelative(u.createdAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {u.isBlocked ? (
                                <span className="text-xs font-medium text-destructive">Blocked</span>
                              ) : (
                                <span className="text-xs font-medium text-emerald-600">Active</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {u.role === "freelancer" ? (
                              <div className="space-y-1.5">
                                {(u as any).verificationDocUrl ? (
                                  <>
                                    <a
                                      href={`/api/storage${(u as any).verificationDocUrl}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline flex items-center gap-1"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                      View ID Doc
                                    </a>
                                    {(u as any).verificationStatus === "pending" || (u as any).verificationStatus === "none" ? (
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => handleVerificationStatus(u.id, "approved")}
                                          className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded font-medium"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => handleVerificationStatus(u.id, "rejected")}
                                          className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded font-medium"
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    ) : (u as any).verificationStatus === "approved" ? (
                                      <span className="text-xs text-emerald-600 font-medium">Approved</span>
                                    ) : (
                                      <span className="text-xs text-destructive font-medium">Rejected</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No doc submitted</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {u.role !== "admin" && (
                                <button
                                  onClick={() => handleBlock(u.id, u.isBlocked)}
                                  className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
                                    u.isBlocked
                                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                      : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                  }`}
                                >
                                  {u.isBlocked ? "Unblock" : "Block"}
                                </button>
                              )}
                              {u.role === "freelancer" && (
                                <>
                                  <button
                                    onClick={() => handleVerify(u.id, (u as any).isVerified ?? false)}
                                    title="Toggle verified status"
                                    className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
                                      (u as any).isVerified
                                        ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                        : "bg-muted text-muted-foreground hover:bg-accent"
                                    }`}
                                  >
                                    {(u as any).isVerified ? "✓ Verified" : "Verify"}
                                  </button>
                                  <button
                                    onClick={() => handleTopRated(u.id, (u as any).isTopRated ?? false)}
                                    title="Toggle top-rated status"
                                    className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
                                      (u as any).isTopRated
                                        ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                        : "bg-muted text-muted-foreground hover:bg-accent"
                                    }`}
                                  >
                                    {(u as any).isTopRated ? "★ Top Rated" : "Top Rate"}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Jobs Tab */}
        {tab === "jobs" && (
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap items-center">
              <select
                value={jobStatus}
                onChange={(e) => setJobStatus(e.target.value)}
                className="px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
              </select>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={flaggedOnly}
                  onChange={(e) => setFlaggedOnly(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                <span className="text-sm text-foreground">Flagged only</span>
              </label>
            </div>

            {jobsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : !jobsData?.jobs.length ? (
              <div className="text-center py-12 bg-card border border-border rounded-xl">
                <p className="text-muted-foreground">No jobs found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobsData.jobs.map((job) => (
                  <div key={job.id} className={`bg-card border rounded-xl p-4 ${job.isFlagged ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">{job.title}</span>
                          {job.isFlagged && (
                            <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded">Flagged</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          By {job.clientName ?? "Unknown"} · {job.category} · {formatRelative(job.createdAt)}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{job.description}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={job.status} />
                        <button
                          onClick={() => handleFlag(job.id, job.isFlagged)}
                          className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                            job.isFlagged
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                          }`}
                        >
                          {job.isFlagged ? "Unflag" : "Flag"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audit Log Tab */}
        {tab === "audit" && (
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap items-center">
              <select
                value={auditAction}
                onChange={(e) => setAuditAction(e.target.value)}
                className="px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All actions</option>
                <option value="block_user">Block User</option>
                <option value="unblock_user">Unblock User</option>
                <option value="verify_user">Verify User</option>
                <option value="reject_verification">Reject Verification</option>
                <option value="top_rate_user">Top Rate User</option>
                <option value="remove_top_rated">Remove Top Rated</option>
                <option value="flag_job">Flag Job</option>
                <option value="unflag_job">Unflag Job</option>
                <option value="change_role">Change Role</option>
              </select>
              <select
                value={auditEntity}
                onChange={(e) => setAuditEntity(e.target.value)}
                className="px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All entities</option>
                <option value="user">Users</option>
                <option value="job">Jobs</option>
              </select>
              {(auditAction || auditEntity) && (
                <button
                  onClick={() => { setAuditAction(""); setAuditEntity(""); }}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Clear filters
                </button>
              )}
            </div>

            {auditLoading ? (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            ) : !auditData?.logs.length ? (
              <div className="text-center py-16 bg-card border border-border rounded-xl">
                <svg className="w-10 h-10 text-muted-foreground mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-muted-foreground font-medium">No audit entries yet</p>
                <p className="text-sm text-muted-foreground mt-1">Admin actions will appear here as they happen.</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    {auditData.total} {auditData.total === 1 ? "entry" : "entries"}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {auditData.logs.map((log) => {
                    const meta = ACTION_LABELS[log.action] ?? { label: log.action, color: "bg-muted text-muted-foreground" };
                    return (
                      <div key={log.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/20">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${meta.color}`}>
                              {meta.label}
                            </span>
                            <span className="text-sm text-foreground font-medium truncate">{log.details ?? `${log.action} on ${log.entityType} #${log.entityId}`}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">by {log.adminName}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground capitalize">{log.entityType}</span>
                            {log.entityName && (
                              <>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground font-medium">{log.entityName}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                          {formatRelative(log.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
