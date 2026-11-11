import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, BadgeCheck, ChevronLeft, ChevronRight, MapPin, MessageCircle, Phone, X } from "lucide-react";
import { serviceImageUrl, serviceRequest, servicesApiUrl, whatsappUrl, type ServiceListing } from "@/lib/services";
import { formatCurrency } from "@/lib/format";

export default function ServiceDetailPage() {
  const [location, setLocation] = useLocation();
  const { getToken, userId } = useAuth();
  const serviceId = Number(location.split("?")[0].split("/").pop());
  const [service, setService] = useState<ServiceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
              {service.isVerified && <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><BadgeCheck className="size-4" aria-hidden="true" /> Verified provider</span>}
            </div>
            <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">{service.title}</h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4" aria-hidden="true" /> {service.city}, {service.region}</p>
            <div className="prose prose-stone mt-7 max-w-none whitespace-pre-wrap text-foreground">{service.description}</div>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-24">
          <p className="text-sm text-muted-foreground">Service by</p>
          <p className="mt-1 text-lg font-bold text-foreground">{service.providerName}</p>
          <p className="mt-5 text-2xl font-bold text-primary">{price}</p>
          <button type="button" onClick={() => setContactOpen(true)} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground hover:opacity-90">
            <MessageCircle className="size-5" aria-hidden="true" /> Contact provider
          </button>
          {service.userId === userId && (
            <button type="button" onClick={() => void deleteListing()} disabled={deleting} className="mt-3 w-full rounded-xl border border-destructive/40 px-4 py-2.5 text-sm font-semibold text-destructive disabled:opacity-50">
              {deleting ? "Deleting…" : "Delete this listing"}
            </button>
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
            <div className="mt-8 space-y-3">
              <a href={whatsappUrl(service.whatsappNumber)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800"><MessageCircle className="size-5" aria-hidden="true" /> Chat on WhatsApp</a>
              <a href={`tel:${service.phoneNumber.replace(/[^\d+]/g, "")}`} className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold text-foreground hover:bg-muted"><Phone className="size-5" aria-hidden="true" /> Call {service.phoneNumber}</a>
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
