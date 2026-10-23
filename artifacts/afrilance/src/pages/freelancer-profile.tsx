import { useParams, useLocation } from "wouter";
import {
  ArrowLeft,
  BriefcaseBusiness,
  ExternalLink,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";
import {
  useGetProfile,
  useListProfileReviews,
  getGetProfileQueryKey,
  getListProfileReviewsQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SkillBadge } from "@/components/SkillBadge";
import { StarRating } from "@/components/StarRating";
import { UserAvatar } from "@/components/UserAvatar";
import { formatRelative } from "@/lib/format";
import { Show } from "@clerk/react";
import { VerifiedBadge, TopRatedBadge } from "./freelancers";

type PortfolioItem = {
  id: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  projectUrl?: string | null;
};

export default function FreelancerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const profileId = parseInt(id);
  const [, setLocation] = useLocation();

  const { data: profile, isLoading } = useGetProfile(profileId, {
    query: { enabled: !!profileId, queryKey: getGetProfileQueryKey(profileId) },
  });

  const { data: reviewsData } = useListProfileReviews(profileId, {
    query: { enabled: !!profileId, queryKey: getListProfileReviewsQueryKey(profileId) },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="flex gap-5">
          <Skeleton className="w-20 h-20 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Profile not found.</p>
        <button onClick={() => setLocation("/freelancers")} className="mt-4 text-primary hover:underline text-sm">
          Back to Freelancers
        </button>
      </div>
    );
  }

  const portfolioItems = (profile.portfolioItems ?? []) as PortfolioItem[];
  const languages = profile.languages ?? [];
  const certifications = profile.certifications ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => setLocation("/freelancers")}
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to talent
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile main */}
        <div className="lg:col-span-2 space-y-6">
          <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="h-24 bg-[linear-gradient(100deg,hsl(var(--primary)),hsl(151_45%_25%))]" />
            <div className="px-5 pb-5 sm:px-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="-mt-12 size-24 shrink-0 rounded-full border-4 border-card bg-card shadow-md">
                  <UserAvatar name={profile.name} avatarUrl={profile.avatarUrl} size="xl" />
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3 pb-1">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold tracking-normal text-foreground">{profile.name}</h1>
                      {profile.isVerified && <VerifiedBadge />}
                      {profile.isTopRated && <TopRatedBadge />}
                    </div>
                    {profile.category && <p className="mt-1 text-base font-medium text-foreground/80">{profile.category}</p>}
                    {profile.location && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="size-4" />
                        {profile.location}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 divide-x divide-border border-y border-border py-4">
                <div className="px-3 first:pl-0">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <Star className="size-4 fill-secondary text-secondary" />
                    <span className="font-bold">{profile.avgRating?.toFixed(1) ?? "New"}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{profile.totalReviews ?? 0} reviews</p>
                </div>
                <div className="px-3">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <BriefcaseBusiness className="size-4 text-primary" />
                    {profile.completedJobs ?? 0}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Jobs completed</p>
                </div>
                <div className="px-3">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <ShieldCheck className="size-4 text-primary" />
                    {profile.isVerified ? "Verified" : "Pending"}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Identity status</p>
                </div>
              </div>

              {profile.bio && (
                <div className="pt-5">
                  <h2 className="text-sm font-semibold text-foreground">About</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{profile.bio}</p>
                </div>
              )}
            </div>
          </section>

          {/* Skills */}
          {profile.skills.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-foreground mb-3">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((s) => <SkillBadge key={s} skill={s} />)}
              </div>
            </div>
          )}

          {languages.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-foreground mb-3">Languages</h2>
              <div className="flex flex-wrap gap-2">
                {languages.map((language) => (
                  <span key={language} className="rounded-lg bg-muted px-3 py-1.5 text-sm text-foreground">{language}</span>
                ))}
              </div>
            </div>
          )}

          {certifications.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-foreground mb-3">Certifications</h2>
              <ul className="space-y-2">
                {certifications.map((certification) => (
                  <li key={certification} className="flex items-start gap-2 text-sm text-foreground">
                    <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    {certification}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Portfolio */}
          {portfolioItems.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-foreground mb-4">Portfolio</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {portfolioItems.map((item) => (
                  <div key={item.id} className="border border-border rounded-xl overflow-hidden group">
                    {item.imageUrl && (
                      <div className="aspect-video bg-muted overflow-hidden">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-semibold text-sm text-foreground">{item.title}</h3>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                      )}
                      {item.projectUrl && (
                        <a
                          href={item.projectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2 font-medium"
                        >
                          View Project
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">
                Reviews ({reviewsData?.total ?? 0})
              </h2>
              {reviewsData?.avgRating && (
                <StarRating rating={reviewsData.avgRating} size="md" />
              )}
            </div>
            {!reviewsData?.reviews.length ? (
              <p className="text-sm text-muted-foreground">No reviews yet.</p>
            ) : (
              <div className="space-y-4">
                {reviewsData.reviews.map((r) => (
                  <div key={r.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={r.reviewerName} size="sm" />
                        <span className="text-sm font-medium text-foreground">{r.reviewerName ?? "Anonymous"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StarRating rating={r.rating} />
                        <span className="text-xs text-muted-foreground">{formatRelative(r.createdAt)}</span>
                      </div>
                    </div>
                    {r.comment && (
                      <p className="text-sm text-muted-foreground">{r.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>



        {/* Sidebar */}
        <div className="space-y-4">
                    {(profile.hourlyRate || (profile as any).fixedRate) && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pricing</h3>
              {profile.hourlyRate && (
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Hourly</span>
                  <div className="text-right">
                    <span className="text-xl font-bold text-primary">₵{profile.hourlyRate}</span>
                    <span className="text-sm text-muted-foreground">/hr</span>
                  </div>
                </div>
              )}
              {(profile as any).fixedRate && (
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Fixed project</span>
                  <div className="text-right">
                    <span className="text-xl font-bold text-emerald-700">₵{(profile as any).fixedRate}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {(profile as any).resumeUrl && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Resume / CV</h3>
              <a
                href={(profile as any).resumeUrl.startsWith("/api/storage/")
                  ? (profile as any).resumeUrl
                  : `/api/storage${(profile as any).resumeUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full px-3 py-2.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Resume
              </a>
            </div>
          )}

          {(profile.isVerified || profile.isTopRated) && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Badges</h3>
              {profile.isVerified && (
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Identity Verified
                </div>
              )}
              {profile.isTopRated && (
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Top Rated Freelancer
                </div>
              )}
            </div>
          )}

          <Show when="signed-in">
            <div className="sticky top-24 overflow-hidden rounded-lg border border-primary/20 bg-card shadow-lg">
              <div className="border-b border-primary/10 bg-primary px-5 py-4 text-primary-foreground">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-75">Ready to collaborate?</p>
                <h3 className="mt-1 text-lg font-bold">Hire {profile.name?.split(" ")[0]}</h3>
              </div>
              <div className="p-5">
                <p className="text-sm leading-6 text-muted-foreground">
                  Share your scope and timeline to start receiving proposals from vetted talent.
                </p>
                <a
                  href="/jobs/post"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Post a job
                  <ExternalLink className="size-4" />
                </a>
              </div>
            </div>
          </Show>

          <Show when="signed-out">
            <div className="bg-card border border-border rounded-xl p-5 text-center">
              <p className="text-sm text-muted-foreground mb-3">Sign in to work with this freelancer</p>
              <a
                href="/sign-up"
                className="block w-full text-center py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90"
              >
                Get Started
              </a>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
