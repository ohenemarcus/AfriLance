import { useEffect, useState } from "react";
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
  getGetMyProfileQueryKey,
  getAdminListUsersQueryKey,
  getAdminListJobsQueryKey,
  getGetAdminAuditLogsQueryKey,
  useGetMyProfile,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { DisputeMessagesPanel } from "@/components/DisputeMessagesPanel";
import { DisputeEvidenceFile } from "@/components/DisputeEvidenceFile";
import { formatRelative, formatCurrency } from "@/lib/format";
import { useAuth } from "@clerk/react";

type Tab = "overview" | "users" | "jobs" | "flagged" | "onboarding" | "failed-payments" | "disputes" | "user-reports" | "support" | "audit";
type OnboardingIssue = {
  id: number;
  name: string;
  role: string;
  category: string | null;
  bio: string | null;
  skills: string[];
  location: string | null;
  createdAt: string;
  missingFields: string[];
};
type FailedPayment = {
  id: number;
  jobId: number;
  amount: number;
  status: string;
  paystackReference: string | null;
  createdAt: string;
  jobTitle: string | null;
  clientName: string | null;
  freelancerName: string | null;
};
type SupportRequest = {
  id: number;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
};
type UserReport = {
  id: number;
  reason: string;
  details: string | null;
  status: "open" | "in_review" | "resolved";
  createdAt: string;
  reporterId: number;
  reporterName: string | null;
  reportedId: number;
  reportedName: string | null;
};
type AdminDispute = {
  id: number;
  reason: string;
  description: string;
  requestedAmount: number;
  status: string;
  decisionNotes?: string | null;
  payment?: { id: number; amount: number; status: string; jobId: number };
  jobTitle?: string | null;
  evidence: Array<{ id: number; objectPath: string; fileName: string; contentType: string }>;
  client?: { id: number; name: string } | null;
  freelancer?: { id: number; name: string } | null;
  createdAt: string;
};

async function adminApiRequest<T>(url: string, token: string | null, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...init?.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Admin request failed");
  return body as T;
}

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
  public_name_changed: { label: "Public Name Changed", color: "bg-sky-100 text-sky-700" },
};

export default function AdminPage() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const { data: profile } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() },
  });
  const isAdmin = profile?.role === "admin";
  const canModerate = isAdmin || profile?.role === "moderator";
  const [tab, setTab] = useState<Tab>(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    return requestedTab === "disputes" ? requestedTab : "users";
  });
  const [userSearch, setUserSearch] = useState("");
  const [userRole, setUserRole] = useState("");
  const [jobStatus, setJobStatus] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [auditAction, setAuditAction] = useState("");
  const [auditEntity, setAuditEntity] = useState("");
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [disputeDecision, setDisputeDecision] = useState<Record<number, { decision: string; amount: string; notes: string }>>({});
  const [disputeError, setDisputeError] = useState("");
  const [onboardingIssues, setOnboardingIssues] = useState<OnboardingIssue[]>([]);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState("");
  const [failedPayments, setFailedPayments] = useState<FailedPayment[]>([]);
  const [failedPaymentsLoading, setFailedPaymentsLoading] = useState(false);
  const [failedPaymentsError, setFailedPaymentsError] = useState("");
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [supportFilter, setSupportFilter] = useState("open");
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [userReportsLoading, setUserReportsLoading] = useState(false);
  const [userReportsError, setUserReportsError] = useState("");

  const { data: stats, isLoading: statsLoading } = useGetAdminStats({
    query: {
      enabled: isAdmin && tab === "overview",
      queryKey: getGetAdminStatsQueryKey(),
    },
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
    ...(flaggedOnly || tab === "flagged" ? { flagged: true } : {}),
    limit: 20,
  };
  const { data: jobsData, isLoading: jobsLoading } = useAdminListJobs(jobParams, {
    query: { enabled: tab === "jobs" || tab === "flagged", queryKey: getAdminListJobsQueryKey(jobParams) },
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

  useEffect(() => {
    if (tab !== "disputes") return;
    setDisputesLoading(true);
    getToken().then((token) => fetch("/api/admin/disputes", { headers: token ? { Authorization: `Bearer ${token}` } : {} }))
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Could not load disputes");
        setDisputes(body.disputes ?? []);
      })
      .catch((error) => setDisputeError(error instanceof Error ? error.message : "Could not load disputes"))
      .finally(() => setDisputesLoading(false));
  }, [tab, getToken]);

  useEffect(() => {
    if (tab !== "onboarding") return;
    let active = true;
    setOnboardingLoading(true);
    setOnboardingError("");
    void getToken()
      .then((token) => adminApiRequest<{ issues: OnboardingIssue[] }>("/api/admin/onboarding-issues", token))
      .then((body) => { if (active) setOnboardingIssues(body.issues); })
      .catch((cause) => { if (active) setOnboardingError(cause instanceof Error ? cause.message : "Could not load profile setup queue"); })
      .finally(() => { if (active) setOnboardingLoading(false); });
    return () => { active = false; };
  }, [tab, getToken]);

  useEffect(() => {
    if (tab !== "failed-payments") return;
    let active = true;
    setFailedPaymentsLoading(true);
    setFailedPaymentsError("");
    void getToken()
      .then((token) => adminApiRequest<{ payments: FailedPayment[] }>("/api/admin/failed-payments", token))
      .then((body) => { if (active) setFailedPayments(body.payments); })
      .catch((cause) => { if (active) setFailedPaymentsError(cause instanceof Error ? cause.message : "Could not load payment review queue"); })
      .finally(() => { if (active) setFailedPaymentsLoading(false); });
    return () => { active = false; };
  }, [tab, getToken]);

  useEffect(() => {
    if (tab !== "support") return;
    let active = true;
    setSupportLoading(true);
    setSupportError("");
    void getToken()
      .then((token) => adminApiRequest<{ requests: SupportRequest[] }>(`/api/admin/support-requests?status=${supportFilter}`, token))
      .then((body) => { if (active) setSupportRequests(body.requests); })
      .catch((cause) => { if (active) setSupportError(cause instanceof Error ? cause.message : "Could not load support inbox"); })
      .finally(() => { if (active) setSupportLoading(false); });
    return () => { active = false; };
  }, [tab, supportFilter, getToken]);

  useEffect(() => {
    if (tab !== "user-reports") return;
    let active = true;
    setUserReportsLoading(true);
    setUserReportsError("");
    void getToken()
      .then((token) => adminApiRequest<{ reports: UserReport[] }>("/api/admin/user-reports", token))
      .then((body) => { if (active) setUserReports(body.reports); })
      .catch((cause) => { if (active) setUserReportsError(cause instanceof Error ? cause.message : "Could not load user reports"); })
      .finally(() => { if (active) setUserReportsLoading(false); });
    return () => { active = false; };
  }, [tab, getToken]);

  const submitDisputeDecision = async (dispute: AdminDispute) => {
    const form = disputeDecision[dispute.id] ?? { decision: "refund_full", amount: String(dispute.requestedAmount), notes: "" };
    setDisputeError("");
    try {
      const token = await getToken();
      const response = await fetch(`/api/admin/disputes/${dispute.id}/decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ decision: form.decision, refundAmount: form.decision === "refund_partial" ? Number(form.amount) : undefined, decisionNotes: form.notes }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save decision");
      setDisputes((items) => items.map((item) => item.id === dispute.id ? body : item));
    } catch (error) {
      setDisputeError(error instanceof Error ? error.message : "Could not save decision");
    }
  };

  const updateSupportRequest = async (id: number, status: SupportRequest["status"]) => {
    setSupportError("");
    try {
      const token = await getToken();
      const updated = await adminApiRequest<SupportRequest>(`/api/admin/support-requests/${id}`, token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (supportFilter !== "all" && supportFilter !== status) {
        setSupportRequests((items) => items.filter((item) => item.id !== id));
      } else {
        setSupportRequests((items) => items.map((item) => item.id === id ? updated : item));
      }
    } catch (cause) {
      setSupportError(cause instanceof Error ? cause.message : "Could not update support request");
    }
  };

  const updateUserReport = async (id: number, status: UserReport["status"]) => {
    setUserReportsError("");
    try {
      const token = await getToken();
      const updated = await adminApiRequest<UserReport>(`/api/admin/user-reports/${id}`, token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setUserReports((items) => items.map((item) => item.id === id ? { ...item, status: updated.status } : item));
    } catch (cause) {
      setUserReportsError(cause instanceof Error ? cause.message : "Could not update user report");
    }
  };

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

  const handleRoleChange = (id: number, role: "freelancer" | "client" | "moderator") => {
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
    ...(isAdmin ? [{ key: "overview" as const, label: "Overview" }] : []),
    { key: "users", label: "Users" },
    { key: "onboarding", label: "Profile Setup" },
    { key: "jobs", label: "Jobs" },
    { key: "flagged", label: "Flagged Listings" },
    { key: "failed-payments", label: "Failed Payments" },
    { key: "disputes", label: "Disputes" },
    ...(canModerate ? [{ key: "user-reports" as const, label: "User Reports" }] : []),
    ...(isAdmin ? [{ key: "support" as const, label: "Support Inbox" }] : []),
    ...(isAdmin ? [{ key: "audit" as const, label: "Audit Log" }] : []),
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
            <h1 className="text-2xl font-bold text-foreground">{isAdmin ? "Admin Dashboard" : "Moderation"}</h1>
            <p className="text-muted-foreground text-sm">Platform management</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex max-w-full gap-1 overflow-x-auto bg-card border border-border rounded-xl p-1 mb-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === "overview" && isAdmin && (
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
                <option value="moderator">Moderator</option>
                {isAdmin && <option value="admin">Admin</option>}
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
                              u.role === "moderator" ? "bg-violet-100 text-violet-700" :
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
                            {u.role === "admin" ? (
                              <span className="text-xs font-medium text-primary">Admin</span>
                            ) : isAdmin ? (
                              <select
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value as "freelancer" | "client" | "moderator")}
                                className="px-2 py-1 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                              >
                                <option value="freelancer">Freelancer</option>
                                <option value="client">Client</option>
                                <option value="moderator">Moderator</option>
                              </select>
                            ) : <span className="text-xs capitalize">{u.role}</span>}
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
                                      href={(u as any).verificationDocUrl.startsWith("/api/storage/")
                                        ? (u as any).verificationDocUrl
                                        : `/api/storage${(u as any).verificationDocUrl}`}
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
                              {u.role !== "admin" && (isAdmin || u.role !== "moderator") && (
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
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleTopRated(u.id, (u as any).isTopRated ?? false)}
                                      title="Toggle top-rated status"
                                      className={`text-xs px-2 py-0.5 rounded-lg font-medium transition-colors ${
                                        (u as any).isTopRated
                                          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                          : "bg-muted text-muted-foreground hover:bg-accent"
                                      }`}
                                    >
                                      {(u as any).isTopRated ? "★ Top Rated" : "Top Rate"}
                                    </button>
                                  )}
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

        {tab === "onboarding" && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Profile setup gaps</h2>
              <p className="text-sm text-muted-foreground">Freelancer profiles missing a bio, category, or skills, and client profiles missing a bio.</p>
            </div>
            {onboardingError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{onboardingError}</p>}
            {onboardingLoading ? (
              <div className="space-y-3">{[...Array(4)].map((_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}</div>
            ) : onboardingIssues.length === 0 ? (
              <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">No incomplete profiles in the current review queue.</div>
            ) : (
              <div className="space-y-3">
                {onboardingIssues.map((issue) => (
                  <article key={issue.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-foreground">{issue.name}</h3>
                        <p className="mt-0.5 text-xs capitalize text-muted-foreground">{issue.role}{issue.location ? ` · ${issue.location}` : ""} · Joined {formatRelative(issue.createdAt)}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">Profile #{issue.id}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {issue.missingFields.map((field) => (
                        <span key={field} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium capitalize text-amber-900">Missing {field}</span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Jobs Tab */}
        {(tab === "jobs" || tab === "flagged") && (
          <div className="space-y-4">
            {tab === "flagged" && <div><h2 className="text-lg font-semibold text-foreground">Flagged listings</h2><p className="text-sm text-muted-foreground">Review reported job listings and remove flags when resolved.</p></div>}
            <div className="flex gap-3 flex-wrap items-center">
              <select
                value={jobStatus}
                onChange={(e) => setJobStatus(e.target.value)}
                className="px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All statuses</option>
                <option value="open">Open</option>
                <option value="awaiting_funding">Awaiting funding</option>
                <option value="payment_pending">Payment processing</option>
                <option value="in_progress">In Progress</option>
                <option value="awaiting_approval">Awaiting approval</option>
                <option value="awaiting_release">Awaiting payout</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="closed">Closed</option>
              </select>
              {tab !== "flagged" && <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={flaggedOnly}
                  onChange={(e) => setFlaggedOnly(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                <span className="text-sm text-foreground">Flagged only</span>
              </label>}
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

        {tab === "failed-payments" && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Payment review</h2>
              <p className="text-sm text-muted-foreground">Failed attempts and payments left pending for more than 30 minutes.</p>
            </div>
            {failedPaymentsError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{failedPaymentsError}</p>}
            {failedPaymentsLoading ? (
              <div className="space-y-3">{[...Array(4)].map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)}</div>
            ) : failedPayments.length === 0 ? (
              <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">No failed or stale pending payments.</div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                      <tr><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">Client / Freelancer</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Started</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {failedPayments.map((payment) => (
                        <tr key={payment.id} className="align-top">
                          <td className="px-4 py-3"><div className="font-medium text-foreground">#{payment.id}</div><div className="mt-1 max-w-40 truncate font-mono text-xs text-muted-foreground" title={payment.paystackReference ?? "No gateway reference"}>{payment.paystackReference ?? "No gateway reference"}</div></td>
                          <td className="px-4 py-3 text-foreground">{payment.jobTitle ?? `Job #${payment.jobId}`}</td>
                          <td className="px-4 py-3 text-muted-foreground">{payment.clientName ?? "Unknown client"}<br />{payment.freelancerName ?? "Unknown freelancer"}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{formatCurrency(payment.amount)}</td>
                          <td className="px-4 py-3"><StatusBadge status={payment.status === "pending" ? "stale pending" : payment.status} /></td>
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatRelative(payment.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Disputes Tab */}
        {tab === "disputes" && (
          <div className="space-y-4">
            {disputeError && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">{disputeError}</div>}
            {disputesLoading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>
            ) : !disputes.length ? (
              <div className="text-center py-16 bg-card border border-border rounded-xl"><p className="text-muted-foreground font-medium">No disputes to review</p></div>
            ) : (
              disputes.map((dispute) => {
                const form = disputeDecision[dispute.id] ?? { decision: "refund_full", amount: String(dispute.requestedAmount), notes: "" };
                const setForm = (patch: Partial<typeof form>) => setDisputeDecision((current) => ({ ...current, [dispute.id]: { ...form, ...patch } }));
                return (
                  <div key={dispute.id} className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{dispute.jobTitle ?? `Job #${dispute.payment?.jobId ?? "?"}`}</h3>
                          <StatusBadge status={dispute.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Payment #{dispute.payment?.id} · Opened {formatRelative(dispute.createdAt)}</p>
                      </div>
                      <div className="text-right"><div className="font-bold text-primary">{formatCurrency(dispute.payment?.amount ?? 0)}</div><div className="text-xs text-muted-foreground">Requested: {formatCurrency(dispute.requestedAmount)}</div></div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <div><span className="font-medium text-foreground">Reason:</span> <span className="text-muted-foreground">{dispute.reason}</span></div>
                      <p className="md:col-span-2 text-muted-foreground whitespace-pre-wrap">{dispute.description}</p>
                    </div>
                    {!!dispute.evidence.length && (
                      <div className="flex flex-wrap gap-2">
                        {dispute.evidence.map((file) => (
                          <DisputeEvidenceFile
                            key={file.id}
                            objectPath={file.objectPath}
                            fileName={file.fileName}
                            contentType={file.contentType}
                          />
                        ))}
                      </div>
                    )}
                    <DisputeMessagesPanel
                      disputeId={dispute.id}
                      disputeStatus={dispute.status}
                      viewerId={profile?.id}
                      moderator
                      client={dispute.client}
                      freelancer={dispute.freelancer}
                    />
                    {dispute.status === "open" || dispute.status === "under_review" ? (
                      <div className="border-t border-border pt-4 grid md:grid-cols-[1fr_1fr_2fr_auto] gap-3 items-end">
                        <label className="text-xs font-medium text-foreground">Decision<select value={form.decision} onChange={(e) => setForm({ decision: e.target.value })} className="mt-1 w-full px-2.5 py-2 bg-background border border-border rounded-lg text-sm"><option value="refund_full">Full refund</option><option value="refund_partial">Partial refund</option><option value="reject">Reject dispute</option></select></label>
                        <label className="text-xs font-medium text-foreground">Partial amount<input type="number" min="0.01" max={dispute.payment?.amount} step="0.01" disabled={form.decision !== "refund_partial"} value={form.amount} onChange={(e) => setForm({ amount: e.target.value })} className="mt-1 w-full px-2.5 py-2 bg-background border border-border rounded-lg text-sm disabled:opacity-50" /></label>
                        <label className="text-xs font-medium text-foreground">Decision notes<textarea required rows={2} value={form.notes} onChange={(e) => setForm({ notes: e.target.value })} className="mt-1 w-full px-2.5 py-2 bg-background border border-border rounded-lg text-sm" placeholder="Explain the decision for both parties." /></label>
                        <button onClick={() => submitDisputeDecision(dispute)} disabled={!form.notes.trim()} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50">Apply decision</button>
                      </div>
                    ) : (
                      <div className="border-t border-border pt-3 text-sm text-muted-foreground"><span className="font-medium text-foreground">Decision notes:</span> {dispute.decisionNotes ?? "No notes"}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "support" && isAdmin && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Support inbox</h2>
                <p className="text-sm text-muted-foreground">Review requests and reply directly to the email address provided.</p>
              </div>
              <label className="text-xs font-medium text-muted-foreground">Status
                <select value={supportFilter} onChange={(event) => setSupportFilter(event.target.value)} className="ml-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="all">All requests</option>
                </select>
              </label>
            </div>
            {supportError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{supportError}</p>}
            {supportLoading ? (
              <div className="space-y-3">{[...Array(4)].map((_, index) => <Skeleton key={index} className="h-36 rounded-xl" />)}</div>
            ) : supportRequests.length === 0 ? (
              <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">No support requests in this view.</div>
            ) : (
              <div className="space-y-3">
                {supportRequests.map((request) => (
                  <article key={request.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-foreground">{request.subject}</h3>
                          <StatusBadge status={request.status.replace("_", " ")} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">#{request.id} · {request.category} · {formatRelative(request.createdAt)}</p>
                      </div>
                      <select aria-label={`Update status for request ${request.id}`} value={request.status} onChange={(event) => updateSupportRequest(request.id, event.target.value as SupportRequest["status"])} className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs">
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{request.message}</p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                      <div className="text-xs text-muted-foreground">{request.name} · <a className="text-primary underline underline-offset-2" href={`mailto:${request.email}`}>{request.email}</a></div>
                      <a className="text-sm font-medium text-primary hover:underline" href={`mailto:${request.email}?subject=${encodeURIComponent(`Re: ${request.subject}`)}`}>Reply by email</a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "user-reports" && canModerate && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">User reports</h2>
              <p className="text-sm text-muted-foreground">Review reports submitted from conversations. Reports are visible only to administrators.</p>
            </div>
            {userReportsError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{userReportsError}</p>}
            {userReportsLoading ? (
              <div className="space-y-3">{[...Array(3)].map((_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)}</div>
            ) : userReports.length === 0 ? (
              <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">No user reports have been submitted.</div>
            ) : (
              <div className="space-y-3">
                {userReports.map((report) => (
                  <article key={report.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-foreground">{report.reason}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">#{report.id} · {formatRelative(report.createdAt)}</p>
                        <p className="mt-2 text-sm text-foreground">Reported user: {report.reportedName ?? `User #${report.reportedId}`} · Reported by: {report.reporterName ?? `User #${report.reporterId}`}</p>
                      </div>
                      <select aria-label={`Update status for user report ${report.id}`} value={report.status} onChange={(event) => void updateUserReport(report.id, event.target.value as UserReport["status"])} className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs">
                        <option value="open">Open</option>
                        <option value="in_review">In review</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                    {report.details && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{report.details}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Audit Log Tab */}
        {tab === "audit" && isAdmin && (
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
