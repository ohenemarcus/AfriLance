import { BadgeCheck, MapPin, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/format";
import { serviceImageUrl, whatsappUrl, type ServiceListing } from "@/lib/services";

export function ServiceCard({ service }: { service: ServiceListing }) {
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
          {service.isVerified && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              <BadgeCheck className="size-4" aria-hidden="true" /> Verified
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">by {service.providerName}</p>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="size-4" aria-hidden="true" /> {service.city}, {service.region}
          </span>
          <span className="font-bold text-primary">{price}</span>
        </div>
        <a
          href={whatsappUrl(service.whatsappNumber)}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp provider
        </a>
      </div>
    </article>
  );
}
