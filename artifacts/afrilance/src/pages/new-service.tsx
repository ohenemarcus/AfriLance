import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { useLocation } from "wouter";
import { ImagePlus, X } from "lucide-react";
import { useFileUpload } from "@/hooks/useFileUpload";
import { getCurrentCoordinates, SERVICE_CATEGORIES, serviceRequest, type ServiceCoordinates, type ServicePricingType } from "@/lib/services";

type SelectedImage = { file: File; previewUrl: string };

export default function NewServicePage() {
  const { getToken } = useAuth();
  const [, setLocation] = useLocation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [serviceLocation, setServiceLocation] = useState<ServiceCoordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [form, setForm] = useState({
    title: "",
    category: "",
    description: "",
    pricingType: "contact_for_quote" as ServicePricingType,
    baseRate: "",
    region: "",
    city: "",
    phoneNumber: "",
    whatsappNumber: "",
  });
  const { uploadFile } = useFileUpload({ accept: ["image/"], maxSizeMB: 10 });

  useEffect(() => () => {
    imagesRef.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
  }, []);

  const addImages = (files: FileList | File[]) => {
    setError("");
    const selected = Array.from(files);
    if (images.length + selected.length > 10) {
      setError("You can add up to 10 portfolio images.");
      return;
    }
    if (selected.some((file) => !file.type.startsWith("image/"))) {
      setError("Portfolio files must be images.");
      return;
    }
    setImages((current) => [
      ...current,
      ...selected.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]);
  };

  const removeImage = (index: number) => {
    setImages((current) => {
      const removed = current[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!images.length) {
      setError("Add at least one portfolio image before publishing.");
      return;
    }
    if (form.pricingType !== "contact_for_quote" && (!form.baseRate || Number(form.baseRate) <= 0)) {
      setError("Enter a valid service rate.");
      return;
    }

    setSaving(true);
    try {
      const portfolioImages = [];
      for (const { file } of images) {
        const imageUrl = await uploadFile(file);
        if (!imageUrl) throw new Error(`Could not upload ${file.name}. Please retry.`);
        portfolioImages.push({ imageUrl, caption: file.name });
      }

      const token = await getToken();
      const response = await serviceRequest<{ service: { id: number } }>("/api/services", token, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          latitude: serviceLocation?.latitude ?? null,
          longitude: serviceLocation?.longitude ?? null,
          baseRate: form.pricingType === "contact_for_quote" ? undefined : Number(form.baseRate),
          portfolioImages,
        }),
      });
      setLocation(`/services/${response.service.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not publish your service.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Local services</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Create a service listing</h1>
        <p className="mt-2 text-muted-foreground">Tell nearby customers what you do and how they can reach you.</p>
      </div>
      <form onSubmit={submit} className="space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-8">
        {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <section className="rounded-xl border border-border bg-muted/40 p-4">
          <h2 className="font-semibold text-foreground">Help nearby customers find you</h2>
          <p className="mt-1 text-sm text-muted-foreground">Optionally share the service location to show customers an approximate distance. Your exact coordinates are not shown publicly.</p>
          <button
            type="button"
            disabled={locationLoading}
            onClick={() => {
              setLocationLoading(true);
              setLocationError("");
              void getCurrentCoordinates()
                .then(setServiceLocation)
                .catch((cause: unknown) => setLocationError(cause instanceof Error ? cause.message : "Could not get your location."))
                .finally(() => setLocationLoading(false));
            }}
            className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {locationLoading ? "Getting location…" : serviceLocation ? "Update service location" : "Use my current location"}
          </button>
          {serviceLocation && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-sm text-emerald-700">Service location added for distance estimates.</p>
              <button type="button" onClick={() => setServiceLocation(null)} className="text-sm font-medium text-muted-foreground underline hover:text-foreground">
                Remove location
              </button>
            </div>
          )}
          {locationError && <p role="alert" className="mt-2 text-sm text-destructive">{locationError}</p>}
        </section>
        <label className="block text-sm font-medium text-foreground">
          Service title *
          <input required minLength={2} maxLength={120} value={form.title} onChange={(e) => setForm((value) => ({ ...value, title: e.target.value }))} placeholder="e.g. Residential plumbing and repairs" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5" />
        </label>
        <label className="block text-sm font-medium text-foreground">
          Primary category *
          <select required value={form.category} onChange={(e) => setForm((value) => ({ ...value, category: e.target.value }))} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5">
            <option value="">Choose a category</option>
            {SERVICE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-foreground">
          Description *
          <textarea required minLength={10} maxLength={5000} rows={5} value={form.description} onChange={(e) => setForm((value) => ({ ...value, description: e.target.value }))} placeholder="Describe your services, experience, and what is included." className="mt-1.5 w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5" />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-foreground">
            Pricing type *
            <select value={form.pricingType} onChange={(e) => setForm((value) => ({ ...value, pricingType: e.target.value as ServicePricingType }))} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5">
              <option value="contact_for_quote">Contact for quote</option>
              <option value="hourly">Hourly</option>
              <option value="fixed">Fixed price</option>
            </select>
          </label>
          {form.pricingType !== "contact_for_quote" && (
            <label className="block text-sm font-medium text-foreground">
              Base rate (GHS) *
              <input required type="number" min="0.01" step="0.01" value={form.baseRate} onChange={(e) => setForm((value) => ({ ...value, baseRate: e.target.value }))} placeholder="250" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5" />
            </label>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-foreground">
            City *
            <input required maxLength={120} value={form.city} onChange={(e) => setForm((value) => ({ ...value, city: e.target.value }))} placeholder="East Legon, Accra" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5" />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Region *
            <input required maxLength={120} value={form.region} onChange={(e) => setForm((value) => ({ ...value, region: e.target.value }))} placeholder="Greater Accra" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5" />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Phone number *
            <input required type="tel" maxLength={32} value={form.phoneNumber} onChange={(e) => setForm((value) => ({ ...value, phoneNumber: e.target.value }))} placeholder="+233 ..." className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5" />
          </label>
          <label className="block text-sm font-medium text-foreground">
            WhatsApp number *
            <input required type="tel" maxLength={32} value={form.whatsappNumber} onChange={(e) => setForm((value) => ({ ...value, whatsappNumber: e.target.value }))} placeholder="+233 ..." className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5" />
          </label>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground">Portfolio images * <span className="font-normal text-muted-foreground">(up to 10; max 10MB each)</span></p>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); addImages(event.dataTransfer.files); }}
            className={`flex min-h-36 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
          >
            <ImagePlus className="mb-2 size-7 text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">Drop images here or browse</span>
            <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP or other image formats</span>
          </button>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(event) => { if (event.target.files) addImages(event.target.files); event.currentTarget.value = ""; }} />
          {images.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((image, index) => (
                <div key={`${image.file.name}-${index}`} className="group relative overflow-hidden rounded-lg border border-border">
                  <img src={image.previewUrl} alt={`Portfolio preview ${index + 1}`} className="aspect-square w-full object-cover" />
                  <button type="button" aria-label={`Remove ${image.file.name}`} onClick={() => removeImage(index)} className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-foreground shadow hover:text-destructive">
                    <X className="size-4" aria-hidden="true" />
                  </button>
                  <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">{image.file.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setLocation("/services")} className="rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? "Uploading and publishing…" : "Publish service"}
          </button>
        </div>
      </form>
    </div>
  );
}
