import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useUser } from "@clerk/react";
import {
  useListJobs,
  getListJobsQueryKey,
  useListSavedJobs,
  getListSavedJobsQueryKey,
  useSaveJob,
  useUnsaveJob,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { SkillBadge } from "@/components/SkillBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBudget, formatRelative } from "@/lib/format";
import { useDebounce } from "@/hooks/useDebounce";

const CATEGORIES = [
  "Software Development", "Design & Creative", "Writing & Content",
  "Digital Marketing", "Data Science", "Video & Animation",
  "Music & Audio", "Business", "Engineering & Architecture",
  "Legal", "Finance & Accounting", "Customer Service", "Consulting",
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "budget_desc", label: "Budget: High to Low" },
  { value: "budget_asc", label: "Budget: Low to High" },
];

export default function JobsPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const { user } = useUser();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({
    search: params.get("search") ?? "",
    category: params.get("category") ?? "",
    remote: params.get("remote") ?? "",
    minBudget: params.get("minBudget") ?? "",
    maxBudget: params.get("maxBudget") ?? "",
    skill: params.get("skill") ?? "",
    budgetType: params.get("budgetType") ?? "",
    sortBy: params.get("sortBy") ?? "newest",
  });
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const debouncedSearch = useDebounce(filters.search, 400);
  const debouncedSkill = useDebounce(filters.skill, 400);

  const queryParams = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.remote === "true" ? { remote: true } : {}),
    ...(filters.minBudget ? { minBudget: parseFloat(filters.minBudget) } : {}),
    ...(filters.maxBudget ? { maxBudget: parseFloat(filters.maxBudget) } : {}),
    ...(debouncedSkill ? { skill: debouncedSkill } : {}),
    ...(filters.budgetType ? { budgetType: filters.budgetType as "fixed" | "hourly" } : {}),
    ...(filters.sortBy ? { sortBy: filters.sortBy as "newest" | "oldest" | "budget_asc" | "budget_desc" } : {}),
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const { data, isLoading } = useListJobs(queryParams, {
    query: { queryKey: getListJobsQueryKey(queryParams) },
  });

  const { data: savedData } = useListSavedJobs({
    query: {
      enabled: !!user,
      queryKey: getListSavedJobsQueryKey(),
    },
  });

  const savedJobIds = new Set((savedData?.savedJobs ?? []).map((s) => s.jobId));

  const { mutate: saveJob } = useSaveJob();
  const { mutate: unsaveJob } = useUnsaveJob();

  const handleBookmark = (e: React.MouseEvent, jobId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    if (savedJobIds.has(jobId)) {
      unsaveJob({ jobId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSavedJobsQueryKey() }),
      });
    } else {
      saveJob({ data: { jobId } }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSavedJobsQueryKey() }),
      });
    }
  };

  const hasActiveFilters =
    filters.search || filters.category || filters.remote || filters.minBudget ||
    filters.maxBudget || filters.skill || filters.budgetType;

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Find Work</h1>
          <p className="text-muted-foreground text-sm">Browse opportunities across Africa and beyond</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">Sort by</label>
          <select
            value={filters.sortBy}
            onChange={(e) => { setFilters((f) => ({ ...f, sortBy: e.target.value })); setPage(0); }}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters sidebar */}
        <aside className="lg:col-span-1">
          <div className="bg-card border border-border rounded-xl p-5 space-y-5 sticky top-20">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Search</label>
              <div className="relative">
                <input
                  type="search"
                  value={filters.search}
                  onChange={(e) => { setFilters((f) => ({ ...f, search: e.target.value })); setPage(0); }}
                  placeholder="Search jobs..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary pr-8"
                />
                {filters.search && debouncedSearch !== filters.search && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Category</label>
              <select
                value={filters.category}
                onChange={(e) => { setFilters((f) => ({ ...f, category: e.target.value })); setPage(0); }}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Skill</label>
              <div className="relative">
                <input
                  type="text"
                  value={filters.skill}
                  onChange={(e) => { setFilters((f) => ({ ...f, skill: e.target.value })); setPage(0); }}
                  placeholder="e.g. React, Python..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary pr-8"
                />
                {filters.skill && debouncedSkill !== filters.skill && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Budget Type</label>
              <div className="flex gap-2">
                {["", "fixed", "hourly"].map((type) => (
                  <button
                    key={type}
                    onClick={() => { setFilters((f) => ({ ...f, budgetType: type })); setPage(0); }}
                    className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors font-medium ${
                      filters.budgetType === type
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {type === "" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Location</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.remote === "true"}
                  onChange={(e) => { setFilters((f) => ({ ...f, remote: e.target.checked ? "true" : "" })); setPage(0); }}
                  className="rounded border-border text-primary"
                />
                <span className="text-sm text-foreground">Remote only</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Budget (GHS)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={filters.minBudget}
                  onChange={(e) => { setFilters((f) => ({ ...f, minBudget: e.target.value })); setPage(0); }}
                  placeholder="Min"
                  className="w-1/2 px-2 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <input
                  type="number"
                  value={filters.maxBudget}
                  onChange={(e) => { setFilters((f) => ({ ...f, maxBudget: e.target.value })); setPage(0); }}
                  placeholder="Max"
                  className="w-1/2 px-2 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={() => { setFilters({ search: "", category: "", remote: "", minBudget: "", maxBudget: "", skill: "", budgetType: "", sortBy: "newest" }); setPage(0); }}
                className="w-full py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </aside>

        {/* Job listings */}
        <div className="lg:col-span-3 space-y-4">
          {isLoading ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)
          ) : data?.jobs.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-xl">
              <svg className="w-12 h-12 text-muted-foreground mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-muted-foreground font-medium">No jobs found</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{data?.total ?? 0} jobs found</p>
              {data?.jobs.map((job) => {
                const isSaved = savedJobIds.has(job.id);
                return (
                  <Link
                    key={job.id}
                    to={`/jobs/${job.id}`}
                    className="group block bg-card border border-border rounded-xl p-5 hover:border-primary hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {job.title}
                      </h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={job.status} />
                        {user && (
                          <button
                            onClick={(e) => handleBookmark(e, job.id)}
                            title={isSaved ? "Remove from saved" : "Save job"}
                            className={`p-1.5 rounded-lg transition-colors ${isSaved ? "text-primary bg-primary/10 hover:bg-primary/20" : "text-muted-foreground hover:text-primary hover:bg-accent"}`}
                          >
                            <svg className="w-4 h-4" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{job.description}</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {job.skills.slice(0, 4).map((s) => <SkillBadge key={s} skill={s} />)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="font-medium text-primary">
                        {formatBudget(job.budgetMin, job.budgetMax, job.budgetType)}
                      </span>
                      <span className="capitalize px-1.5 py-0.5 bg-muted rounded text-xs">
                        {job.budgetType}
                      </span>
                      {job.remote && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                          </svg>
                          Remote
                        </span>
                      )}
                      {job.location && <span>{job.location}</span>}
                      <span>{job.proposalCount} proposals</span>
                      <span className="ml-auto">{formatRelative(job.createdAt)}</span>
                    </div>
                  </Link>
                );
              })}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
