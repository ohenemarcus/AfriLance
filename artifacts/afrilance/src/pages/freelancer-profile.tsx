import { useParams, useLocation } from "wouter";
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => setLocation("/freelancers")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Freelancers
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start gap-5">
              <UserAvatar name={profile.name} avatarUrl={profile.avatarUrl} size="xl" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground">{profile.name}</h1>
                  {profile.isVerified && <VerifiedBadge />}
                  {profile.isTopRated && <TopRatedBadge />}
                </div>
                {profile.category && (
                  <div className="text-sm text-muted-foreground mt-0.5">{profile.category}</div>
                )}
                {profile.location && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {profile.location}
                  </div>
                )}
                {profile.avgRating != null && (
                  <div className="mt-2">
                    <StarRating rating={profile.avgRating} total={profile.totalReviews} size="md" />
                  </div>
                )}
                <div className="flex flex-wrap gap-3 mt-3 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    {profile.completedJobs} jobs completed
                  </div>
                </div>
              </div>
            </div>

            {profile.bio && (
              <div className="mt-5 pt-5 border-t border-border">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">About</h3>
                <p className="text-sm text-foreground leading-relaxed">{profile.bio}</p>
              </div>
            )}
          </div>

          {/* Skills */}
          {profile.skills.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-foreground mb-3">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((s) => <SkillBadge key={s} skill={s} />)}
              </div>
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
                href={`/api/storage${(profile as any).resumeUrl}`}
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
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-3">Work with {profile.name?.split(" ")[0]}</h3>
              <a
                href="/jobs/post"
                className="block w-full text-center py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Post a Job
              </a>
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
