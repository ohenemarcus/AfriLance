import { useState } from "react";
import { BadgeCheck, MapPin, MessageCircle, Star } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/format";
import { serviceImageUrl, type ServiceListing } from "@/lib/services";
import { ServiceContactOptions } from "@/components/ServiceContactOptions";
import { TrustReportAction } from "@/components/TrustReportAction";

export function ServiceCard({ service }: { service: ServiceListing }) {
  const [contactOpen, setContactOpen] = useState(false);
  const primaryImage = service.portfolioImages[0];
  const price = service.pricingType === "contact_for_quote"
    ? "Contact for quote"
    : `${formatCurrency(service.baseRate)}${service.pricingType === "hourly" ? " / hour" : ""}`;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <Link to={`/services/${service.id}`} className="block">
        <div className="aspect-[4/3] bg-muted">
          {primaryImage ? (
            <img src={serviceImageUrl(primaryImage.imageUrl)} alt={primaryImage.caption || service.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl text-muted-foreground" aria-hidden="true">✦</div>
          )}
        </div>
      </Link>
      <div className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{service.category}</p>
            <Link to={`/services/${service.id}`} className="mt-1 block text-lg font-bold text-foreground hover:text-primary">
              {service.title}
            </Link>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {service.isVerified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                <BadgeCheck className="size-4" aria-hidden="true" /> Listing verified
              </span>
            )}
            {service.providerIsVerified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                <BadgeCheck className="size-4" aria-hidden="true" /> Identity verified
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">by {service.providerName}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{service.providerCompletedJobs} completed {service.providerCompletedJobs === 1 ? "job" : "jobs"}</span>
          {service.providerTotalReviews > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />
              {Number(service.providerAvgRating).toFixed(1)} ({service.providerTotalReviews} {service.providerTotalReviews === 1 ? "review" : "reviews"})
            </span>
          ) : <span>No reviews yet</span>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="size-4" aria-hidden="true" /> {service.city}, {service.region}
          </span>
          <span className="font-bold text-primary">{price}</span>
        </div>
        {service.distanceKm != null && (
          <p className="text-sm font-medium text-muted-foreground">
            {service.distanceKm < 1 ? "Less than 1 km away" : `About ${service.distanceKm} km away`}
          </p>
        )}
        <button
          type="button"
          aria-expanded={contactOpen}
          aria-controls={`service-contact-${service.id}`}
          onClick={() => setContactOpen((open) => !open)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <MessageCircle className="size-4" aria-hidden="true" /> Contact provider
        </button>
        {contactOpen && (
          <div id={`service-contact-${service.id}`} className="pt-1">
            <ServiceContactOptions service={service} />
          </div>
        )}
        <div className="flex justify-end border-t border-border pt-3">
          <TrustReportAction target="service" targetId={service.id} targetName={service.title} ownerUserId={service.userId} />
        </div>
      </div>
    </article>
  );
}
