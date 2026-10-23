import { Link } from "wouter";
import { BriefcaseBusiness, CreditCard, UsersRound } from "lucide-react";
import { useListJobs, useListFreelancers } from "@workspace/api-client-react";
import { SkillBadge } from "@/components/SkillBadge";
import { StarRating } from "@/components/StarRating";
import { UserAvatar } from "@/components/UserAvatar";
import { formatBudget, formatRelative } from "@/lib/format";

const FEATURED_CATEGORIES = [
  {
    name: "Design & Creative",
    eyebrow: "Shape the next big idea",
    accent: "bg-amber-100 text-amber-900",
    icon: "✦",
  },
  {
    name: "Software Development",
    eyebrow: "Build what moves business",
    accent: "bg-emerald-100 text-emerald-900",
    icon: "</>",
  },
  {
    name: "Writing & Content",
    eyebrow: "Give every story a voice",
    accent: "bg-sky-100 text-sky-900",
    icon: "Aa",
  },
];

const PREVIEW_FREELANCERS = [
  {
    id: "preview-1",
    name: "Amara Okafor",
    category: "Software Development",
    location: "Lagos, Nigeria",
    avgRating: 4.9,
    totalReviews: 24,
    skills: ["React", "Node.js", "PostgreSQL"],
    hourlyRate: 85,
    avatarUrl: null,
    preview: true,
  },
  {
    id: "preview-2",
    name: "Leila Mensah",
    category: "Design & Creative",
    location: "Accra, Ghana",
    avgRating: 4.8,
    totalReviews: 17,
    skills: ["Brand Identity", "Figma", "Illustration"],
    hourlyRate: 68,
    avatarUrl: null,
    preview: true,
  },
  {
    id: "preview-3",
    name: "Kwame Badu",
    category: "Digital Marketing",
    location: "Kumasi, Ghana",
    avgRating: 4.7,
    totalReviews: 31,
    skills: ["SEO", "Content Strategy", "Meta Ads"],
    hourlyRate: 55,
    avatarUrl: null,
    preview: true,
  },
  {
    id: "preview-4",
    name: "Fatima Bello",
    category: "Data Science",
    location: "Abuja, Nigeria",
    avgRating: 4.9,
    totalReviews: 20,
    skills: ["Python", "SQL", "Power BI"],
    hourlyRate: 72,
    avatarUrl: null,
    preview: true,
  },
  {
    id: "preview-5",
    name: "Thandiwe Dlamini",
    category: "Writing & Content",
    location: "Cape Town, South Africa",
    avgRating: 4.8,
    totalReviews: 36,
    skills: ["UX Writing", "Copywriting", "Editorial"],
    hourlyRate: 48,
    avatarUrl: null,
    preview: true,
  },
];

const PREVIEW_JOBS = [
  {
    id: "preview-1",
    title: "Build a patient appointment portal",
    description:
      "Create a responsive scheduling portal for patients and clinic staff, with availability, booking, reminders, and an accessible admin dashboard.",
    skills: ["React", "Node.js", "PostgreSQL"],
    budgetMin: 15000,
    budgetMax: 26000,
    budgetType: "fixed",
    proposalCount: 12,
    createdAt: "2026-10-23T08:00:00Z",
    preview: true,
  },
  {
    id: "preview-2",
    title: "Refresh an African market brand identity",
    description:
      "Develop a distinctive identity system including a logo, color system, typography, packaging direction, and social launch assets.",
    skills: ["Brand Identity", "Figma", "Packaging"],
    budgetMin: 6500,
    budgetMax: 12000,
    budgetType: "fixed",
    proposalCount: 8,
    createdAt: "2026-10-22T10:30:00Z",
    preview: true,
  },
  {
    id: "preview-3",
    title: "Plan a clean-energy growth campaign",
    description:
      "Shape a focused campaign for commercial solar services with channel strategy, landing-page direction, reporting, and monthly optimization.",
    skills: ["Growth Strategy", "SEO", "Meta Ads"],
    budgetMin: 400,
    budgetMax: 650,
    budgetType: "hourly",
    proposalCount: 6,
    createdAt: "2026-10-22T07:15:00Z",
    preview: true,
  },
  {
    id: "preview-4",
    title: "Build a student progress dashboard",
    description:
      "Turn course and learner data into an executive dashboard covering enrollment, attendance, progress, and at-risk cohorts.",
    skills: ["Python", "SQL", "Power BI"],
    budgetMin: 9000,
    budgetMax: 18000,
    budgetType: "fixed",
    proposalCount: 9,
    createdAt: "2026-10-21T14:00:00Z",
    preview: true,
  },
  {
    id: "preview-5",
    title: "Rewrite financial onboarding content",
    description:
      "Improve onboarding, loan explanations, notifications, and help-center articles while maintaining clarity and compliance.",
    skills: ["UX Writing", "Editing", "Fintech"],
    budgetMin: 7000,
    budgetMax: 14000,
    budgetType: "fixed",
    proposalCount: 11,
    createdAt: "2026-10-21T09:45:00Z",
    preview: true,
  },
];

export default function LandingPage() {
  const { data: jobsData } = useListJobs({ limit: 4 });
  const { data: freelancersData } = useListFreelancers({
    featured: true,
    limit: 4,
  });
  const { data: designFreelancers } = useListFreelancers({
    category: "Design & Creative",
    featured: true,
    limit: 3,
  });
  const { data: developmentFreelancers } = useListFreelancers({
    category: "Software Development",
    featured: true,
    limit: 3,
  });
  const { data: writingFreelancers } = useListFreelancers({
    category: "Writing & Content",
    featured: true,
    limit: 3,
  });
  const featuredByCategory = [
    designFreelancers,
    developmentFreelancers,
    writingFreelancers,
  ];
  const liveJobs = jobsData?.jobs ?? [];
  const liveFreelancers = freelancersData?.freelancers ?? [];
  const isShowingJobPreviews = liveJobs.length === 0;
  const isShowingFreelancerPreviews = liveFreelancers.length === 0;
  const displayedJobs = isShowingJobPreviews ? PREVIEW_JOBS : liveJobs;
  const displayedFreelancers = isShowingFreelancerPreviews
    ? PREVIEW_FREELANCERS
    : liveFreelancers;

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-primary overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-secondary translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-secondary -translate-x-1/3 translate-y-1/3" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/20 border border-secondary/30 text-secondary text-sm font-medium mb-6">
              <span>🥇</span>
              Freelance Marketplace in Africa
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground leading-tight mb-6">
              Find top African <span className="text-secondary">talent</span> or
              your next <span className="text-secondary">opportunity</span>
            </h1>
            <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl">
              Explore talent and freelance opportunities through one marketplace
              built for African clients and professionals.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/jobs"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-secondary text-primary font-semibold text-base hover:opacity-90 transition-opacity"
              >
                Find Work
              </Link>
              <Link
                to="/freelancers"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary-foreground/10 border border-primary-foreground/30 text-primary-foreground font-semibold text-base hover:bg-primary-foreground/20 transition-colors"
              >
                Hire Talent
              </Link>
            </div>
            <div className="mt-10 grid max-w-3xl grid-cols-1 gap-4 border-t border-primary-foreground/20 pt-6 sm:grid-cols-3 sm:gap-6">
              {[
                {
                  icon: UsersRound,
                  label: "Talent discovery",
                  description: "Profiles organized around skills",
                },
                {
                  icon: BriefcaseBusiness,
                  label: "Project listings",
                  description: "Jobs and proposals in one place",
                },
                {
                  icon: CreditCard,
                  label: "Payment workflow",
                  description: "Payments managed through the platform",
                },
              ].map((feature) => (
                <div key={feature.label} className="flex items-start gap-3">
                  <feature.icon
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-secondary"
                  />
                  <div>
                    <div className="font-semibold text-primary-foreground">
                      {feature.label}
                    </div>
                    <div className="text-sm text-primary-foreground/60">
                      {feature.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">
              How Afrlance works
            </h2>
            <p className="mt-2 text-muted-foreground">Get started in minutes</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Post or apply",
                desc: "Clients publish clear jobs and freelancers apply with proposals, skills, and budget details tailored to the work.",
              },
              {
                step: "2",
                title: "Fund and work",
                desc: "The accepted freelancer waits for funding, the client funds the job, and work begins only after the payment is confirmed in escrow.",
              },
              {
                step: "3",
                title: "Submit, review, and release",
                desc: "Freelancers submit work with files and notes, clients approve or request revisions, and money is released only after approval.",
              },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground text-xl font-bold mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-muted-foreground text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Discover talent by category */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary-foreground">
                Discover your next collaborator
              </p>
              <h2 className="text-3xl font-bold text-foreground mt-2">
                Start with the work you need
              </h2>
              <p className="mt-2 text-muted-foreground">
                Meet standout freelancers, handpicked by category.
              </p>
            </div>
            <Link
              to="/freelancers"
              className="text-sm font-medium text-primary hover:underline hidden md:block"
            >
              Explore all talent
            </Link>
          </div>
          <div className="space-y-8">
            {FEATURED_CATEGORIES.map((category, index) => {
              const freelancers = featuredByCategory[index]?.freelancers ?? [];
              return (
                <div
                  key={category.name}
                  className="border-t border-border pt-6"
                >
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${category.accent}`}
                      >
                        {category.icon}
                      </span>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">
                          {category.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {category.eyebrow}
                        </p>
                      </div>
                    </div>
                    <Link
                      to={`/freelancers?category=${encodeURIComponent(category.name)}`}
                      className="text-sm font-semibold text-primary hover:underline whitespace-nowrap"
                    >
                      View category →
                    </Link>
                  </div>
                  {freelancers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {freelancers.map((f) => (
                        <Link
                          key={f.id}
                          to={`/freelancers/${f.id}`}
                          className="group flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-primary hover:shadow-md transition-all"
                        >
                          <UserAvatar
                            name={f.name}
                            avatarUrl={f.avatarUrl}
                            size="lg"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {f.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {f.location || "Africa"}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {f.avgRating ? (
                                <StarRating
                                  rating={f.avgRating}
                                  total={f.totalReviews}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  New talent
                                </span>
                              )}
                              {f.hourlyRate && (
                                <span className="text-xs font-semibold text-primary">
                                  ₵{f.hourlyRate}/hr
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Link
                      to={`/freelancers?category=${encodeURIComponent(category.name)}`}
                      className="block rounded-xl border border-dashed border-border bg-card/60 p-5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      Browse freelancers in {category.name}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Jobs */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-3xl font-bold text-foreground">
                  Latest opportunities
                </h2>
                {isShowingJobPreviews && (
                  <span className="rounded-full bg-secondary/20 px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                    Example openings
                  </span>
                )}
              </div>
              <p className="mt-1 text-muted-foreground">
                {isShowingJobPreviews
                  ? "A preview of project types shared on Afrlance"
                  : "Fresh jobs posted by African businesses"}
              </p>
            </div>
            <Link
              to="/jobs"
              className="text-sm font-medium text-primary hover:underline hidden md:block"
            >
              View all jobs
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {displayedJobs.map((job) => (
              <Link
                key={job.id}
                to={isShowingJobPreviews ? "/jobs" : `/jobs/${job.id}`}
                className="group block p-5 bg-card border border-border rounded-xl hover:border-primary hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {job.title}
                  </h3>
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {formatRelative(job.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {job.description}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {job.skills.slice(0, 3).map((s) => (
                    <SkillBadge key={s} skill={s} />
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-primary">
                    {formatBudget(job.budgetMin, job.budgetMax, job.budgetType)}
                  </span>
                  <span>{job.proposalCount} proposals</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Freelancers */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-3xl font-bold text-foreground">
                  Top African talent
                </h2>
                {isShowingFreelancerPreviews && (
                  <span className="rounded-full bg-secondary/20 px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                    Example profiles
                  </span>
                )}
              </div>
              <p className="mt-1 text-muted-foreground">
                {isShowingFreelancerPreviews
                  ? "A preview of skills you can discover on Afrlance"
                  : "Verified professionals ready to work"}
              </p>
            </div>
            <Link
              to="/freelancers"
              className="text-sm font-medium text-primary hover:underline hidden md:block"
            >
              Browse all
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {displayedFreelancers.map((f) => (
              <Link
                key={f.id}
                to={
                  isShowingFreelancerPreviews
                    ? "/freelancers"
                    : `/freelancers/${f.id}`
                }
                className="group block p-5 bg-card border border-border rounded-xl hover:border-primary hover:shadow-md transition-all text-center"
              >
                <div className="flex justify-center mb-3">
                  <UserAvatar name={f.name} avatarUrl={f.avatarUrl} size="xl" />
                </div>
                <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {f.name}
                </div>
                {f.category && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {f.category}
                  </div>
                )}
                {f.location && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                    </svg>
                    {f.location}
                  </div>
                )}
                {f.avgRating && (
                  <div className="flex justify-center mt-2">
                    <StarRating rating={f.avgRating} total={f.totalReviews} />
                  </div>
                )}
                <div className="flex flex-wrap gap-1 justify-center mt-3">
                  {f.skills.slice(0, 2).map((s) => (
                    <SkillBadge key={s} skill={s} />
                  ))}
                </div>
                {f.hourlyRate && (
                  <div className="mt-3 text-sm font-semibold text-primary">
                    ₵{f.hourlyRate}/hr
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">
            Bring the right people and projects together.
          </h2>
          <p className="text-primary-foreground/70 mb-8">
            Explore the marketplace, create a profile, or publish a project.
          </p>
          <Link
            to="/sign-up"
            className="inline-flex items-center justify-center px-8 py-3 rounded-xl bg-secondary text-primary font-semibold text-base hover:opacity-90 transition-opacity"
          >
            Get started for free
          </Link>
        </div>
      </section>
    </div>
  );
}
