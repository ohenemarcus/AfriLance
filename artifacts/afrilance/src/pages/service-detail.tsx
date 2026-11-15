import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, BadgeCheck, ChevronLeft, ChevronRight, MapPin, MessageCircle, Star, X } from "lucide-react";
import { ServiceContactOptions } from "@/components/ServiceContactOptions";
import { getCurrentCoordinates, serviceImageUrl, serviceRequest, servicesApiUrl, type ServiceListing } from "@/lib/services";
import { formatCurrency } from "@/lib/format";
import { useListProfileReviews, getListProfileReviewsQueryKey } from "@workspace/api-client-react";
import { TrustReportAction } from "@/components/TrustReportAction";

export default function ServiceDetailPage() {
  const [location, setLocation] = useLocation();
  const { getToken, userId } = useAuth();
  const serviceId = Number(location.split("?")[0].split("/").pop());
  const [service, setService] = useState<ServiceListing | null>(null);
  const { data: reviewsData } = useListProfileReviews(service?.providerProfileId ?? 0, {
    query: {
      enabled: !!service?.providerProfileId,
      queryKey: getListProfileReviewsQueryKey(service?.providerProfileId ?? 0),
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(servicesApiUrl(`/api/services/${serviceId}`), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error || `Could not load service (${response.status})`);
        }
        return response.json() as Promise<ServiceListing>;
      })
      .then(setService)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load service");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [serviceId]);

  useEffect(() => {
    if (galleryIndex === null || !service?.portfolioImages.length) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGalleryIndex(null);
      if (event.key === "ArrowRight") setGalleryIndex((index) => index === null ? null : (index + 1) % service.portfolioImages.length);
      if (event.key === "ArrowLeft") setGalleryIndex((index) => index === null ? null : (index - 1 + service.portfolioImages.length) % service.portfolioImages.length);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [galleryIndex, service?.portfolioImages.length]);

  const deleteListing = async () => {
    if (!service || !window.confirm("Delete this service listing? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const token = await getToken();
      await serviceRequest(`/api/services/${service.id}`, token, { method: "DELETE" });
      setLocation("/services");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete service");
      setDeleting(false);
    }
  };

  const updateServiceLocation = async (remove = false) => {
    if (!service) return;
    setUpdatingLocation(true);
    setLocationError("");
    setLocationMessage("");
    try {
      const coordinates = remove ? null : await getCurrentCoordinates();
      const token = await getToken();
      const response = await serviceRequest<{ hasServiceLocation: boolean }>(
        `/api/services/${service.id}/location`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({
            latitude: coordinates?.latitude ?? null,
            longitude: coordinates?.longitude ?? null,
          }),
        },
      );
      setService((current) => current ? { ...current, hasServiceLocation: response.hasServiceLocation } : current);
      setLocationMessage(response.hasServiceLocation
        ? "Service location saved. Customers can now see an approximate distance."
        : "Service location removed.");
    } catch (cause) {
      setLocationError(cause instanceof Error ? cause.message : "Could not update service location.");
    } finally {
      setUpdatingLocation(false);
    }
  };

  if (loading) return <p className="py-24 text-center text-muted-foreground">Loading service…</p>;
  if (error || !service) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center"><p role="alert" className="text-destructive">{error || "Service not found"}</p><Link to="/services" className="mt-4 inline-block text-primary hover:underline">Back to services</Link></div>;
  }

  const price = service.pricingType === "contact_for_quote"
    ? "Contact for quote"
    : `${formatCurrency(service.baseRate)}${service.pricingType === "hourly" ? " / hour" : " fixed"}`;
  const gallery = service.portfolioImages;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/services" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" aria-hidden="true" /> Back to services</Link>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {gallery.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {gallery.map((image, index) => (
                <button key={image.id} type="button" onClick={() => setGalleryIndex(index)} className={`overflow-hidden rounded-xl bg-muted ${index === 0 ? "sm:col-span-2" : ""}`}>
                  <img src={serviceImageUrl(image.imageUrl)} alt={image.caption || `${service.title} portfolio image ${index + 1}`} className={`${index === 0 ? "max-h-[520px]" : "h-56"} w-full object-cover transition hover:scale-[1.02]`} />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex aspect-[16/9] items-center justify-center rounded-xl bg-muted text-muted-foreground">No portfolio images added</div>
          )}
          <div className="mt-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">{service.category}</span>
              {service.isVerified && <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><BadgeCheck className="size-4" aria-hidden="true" /> Verified listing</span>}
            </div>
            <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">{service.title}</h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4" aria-hidden="true" /> {service.city}, {service.region}</p>
            <div className="prose prose-stone mt-7 max-w-none whitespace-pre-wrap text-foreground">{service.description}</div>
            <section className="mt-8 rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Provider trust</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    {service.providerIsVerified && <span className="inline-flex items-center gap-1 text-emerald-700"><BadgeCheck className="size-4" aria-hidden="true" /> Identity verified</span>}
                    <span>{service.providerCompletedJobs} completed {service.providerCompletedJobs === 1 ? "job" : "jobs"}</span>
                    {service.providerTotalReviews > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Star className="size-4 fill-amber-400 text-amber-500" aria-hidden="true" />
                        {Number(service.providerAvgRating).toFixed(1)} ({service.providerTotalReviews} {service.providerTotalReviews === 1 ? "review" : "reviews"})
                      </span>
                    ) : <span>No reviews yet</span>}
                  </div>
                </div>
                <Link to={`/freelancers/${service.providerProfileId}`} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">View provider profile</Link>
              </div>
              {reviewsData?.reviews?.length ? (
                <div className="mt-5 space-y-4 border-t border-border pt-4">
                  <h2 className="text-sm font-semibold text-foreground">Recent client reviews</h2>
                  {reviewsData.reviews.slice(0, 3).map((review) => (
                    <article key={review.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-foreground">{review.reviewerName ?? "Anonymous"}</span>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Star className="size-3.5 fill-amber-400 text-amber-500" aria-hidden="true" /> {review.rating}/5
                        </span>
                      </div>
                      {review.comment && <p className="mt-1 text-sm leading-6 text-muted-foreground">{review.comment}</p>}
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-24">
          <p className="text-sm text-muted-foreground">Service by</p>
          <p className="mt-1 text-lg font-bold text-foreground">{service.providerName}</p>
          <div className="mt-2">
            <TrustReportAction target="service" targetId={service.id} targetName={service.title} ownerUserId={service.userId} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Safety concern? <a href="/support" className="font-medium text-primary underline underline-offset-4">Contact support</a>.
          </p>
          <p className="mt-5 text-2xl font-bold text-primary">{price}</p>
          <button type="button" onClick={() => setContactOpen(true)} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground hover:opacity-90">
            <MessageCircle className="size-5" aria-hidden="true" /> Contact provider
          </button>
          {service.userId === userId && (
            <>
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-sm font-semibold text-foreground">Service location</p>
                <p className="mt-1 text-xs text-muted-foreground">Share your current service location to show customers approximate distance. Exact coordinates stay private.</p>
                <button type="button" onClick={() => void updateServiceLocation()} disabled={updatingLocation} className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
                  {updatingLocation ? "Updating location…" : service.hasServiceLocation ? "Update shared location" : "Share current location"}
                </button>
                {service.hasServiceLocation && (
                  <button type="button" onClick={() => void updateServiceLocation(true)} disabled={updatingLocation} className="mt-2 w-full rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground underline hover:text-foreground disabled:opacity-50">
                    Remove shared location
                  </button>
                )}
                {locationMessage && <p role="status" className="mt-2 text-xs text-emerald-700">{locationMessage}</p>}
                {locationError && <p role="alert" className="mt-2 text-xs text-destructive">{locationError}</p>}
              </div>
              <button type="button" onClick={() => void deleteListing()} disabled={deleting} className="mt-3 w-full rounded-xl border border-destructive/40 px-4 py-2.5 text-sm font-semibold text-destructive disabled:opacity-50">
                {deleting ? "Deleting…" : "Delete this listing"}
              </button>
            </>
          )}
        </aside>
      </div>

      {contactOpen && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/50" onClick={() => setContactOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="contact-title" onClick={(event) => event.stopPropagation()} className="flex h-full w-full max-w-md flex-col bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div><p className="text-sm text-muted-foreground">Get in touch with</p><h2 id="contact-title" className="mt-1 text-2xl font-bold text-foreground">{service.providerName}</h2></div>
              <button type="button" aria-label="Close contact panel" onClick={() => setContactOpen(false)} className="rounded-full p-2 hover:bg-muted"><X className="size-5" aria-hidden="true" /></button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{service.title} · {service.city}, {service.region}</p>
            <div className="mt-8">
              <ServiceContactOptions service={service} onSelect={() => setContactOpen(false)} />
            </div>
            <p className="mt-auto text-xs text-muted-foreground">Contact details are provided by the service provider. Confirm scope and pricing directly before work begins.</p>
          </section>
        </div>
      )}

      {galleryIndex !== null && gallery[galleryIndex] && (
        <div role="dialog" aria-modal="true" aria-label="Portfolio image gallery" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4" onClick={() => setGalleryIndex(null)}>
          <button type="button" aria-label="Close gallery" onClick={() => setGalleryIndex(null)} className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"><X className="size-6" aria-hidden="true" /></button>
          {gallery.length > 1 && <button type="button" aria-label="Previous image" onClick={(event) => { event.stopPropagation(); setGalleryIndex((galleryIndex - 1 + gallery.length) % gallery.length); }} className="absolute left-3 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"><ChevronLeft className="size-6" aria-hidden="true" /></button>}
          <img src={serviceImageUrl(gallery[galleryIndex].imageUrl)} alt={gallery[galleryIndex].caption || `${service.title} portfolio`} onClick={(event) => event.stopPropagation()} className="max-h-[85vh] max-w-full object-contain" />
          {gallery.length > 1 && <button type="button" aria-label="Next image" onClick={(event) => { event.stopPropagation(); setGalleryIndex((galleryIndex + 1) % gallery.length); }} className="absolute right-3 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"><ChevronRight className="size-6" aria-hidden="true" /></button>}
        </div>
      )}
    </main>
  );
}
