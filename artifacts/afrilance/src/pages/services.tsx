import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, SlidersHorizontal } from "lucide-react";
import { ServiceCard } from "@/components/ServiceCard";
import { SERVICE_CATEGORIES, serviceRequest, servicesApiUrl, type ServiceListing } from "@/lib/services";

interface ServiceListResponse {
  services: ServiceListing[];
  total: number;
  limit: number;
  offset: number;
}

export default function ServicesPage() {
  const [location, setLocation] = useLocation();
  const initialParams = new URLSearchParams(location.split("?")[1] ?? "");
  const [query, setQuery] = useState(initialParams.get("query") ?? "");
  const [category, setCategory] = useState(initialParams.get("category") ?? "");
  const [region, setRegion] = useState(initialParams.get("region") ?? "");
  const [city, setCity] = useState(initialParams.get("city") ?? "");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<ServiceListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1] ?? "");
    setQuery(params.get("query") ?? "");
    setCategory(params.get("category") ?? "");
    setRegion(params.get("region") ?? "");
    setCity(params.get("city") ?? "");
  }, [location]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "12", offset: String(offset) });
    if (query.trim()) params.set("query", query.trim());
    if (category) params.set("category", category);
    if (region.trim()) params.set("region", region.trim());
    if (city.trim()) params.set("city", city.trim());

    setLoading(true);
    setError("");
    void fetch(servicesApiUrl(`/api/services?${params}`), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error || `Could not load services (${response.status})`);
        }
        return response.json() as Promise<ServiceListResponse>;
      })
      .then(setResult)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load services");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, category, region, city, offset]);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setOffset(0);
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (category) params.set("category", category);
    if (region.trim()) params.set("region", region.trim());
    if (city.trim()) params.set("city", city.trim());
    setLocation(`/services${params.size ? `?${params}` : ""}`);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Made local, made skilled</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">Find local services</h1>
          <p className="mt-2 text-muted-foreground">Discover trusted tradespeople and professionals near you.</p>
        </div>
        <Link to="/services/new" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Offer a service
        </Link>
      </div>

      <form onSubmit={applyFilters} className="mb-8 grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-2 lg:grid-cols-5">
        <label className="relative lg:col-span-2">
          <span className="sr-only">Search services</span>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input value={query} onChange={(event) => { setOffset(0); setQuery(event.target.value); }} placeholder="What service do you need?" className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm" />
        </label>
        <label>
          <span className="sr-only">Category</span>
          <select value={category} onChange={(event) => { setOffset(0); setCategory(event.target.value); }} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
            <option value="">All categories</option>
            {SERVICE_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">City</span>
          <input value={city} onChange={(event) => { setOffset(0); setCity(event.target.value); }} placeholder="City" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
        </label>
        <div className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Region</span>
            <input value={region} onChange={(event) => { setOffset(0); setRegion(event.target.value); }} placeholder="Region" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          </label>
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            <SlidersHorizontal className="size-4" aria-hidden="true" /><span className="sr-only">Apply filters</span>
          </button>
        </div>
      </form>

      {error && <p role="alert" className="mb-5 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="py-16 text-center text-muted-foreground">Loading local services…</p>
      ) : result?.services.length ? (
        <>
          <p className="mb-4 text-sm text-muted-foreground">{result.total} service{result.total === 1 ? "" : "s"} found</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {result.services.map((service) => <ServiceCard key={service.id} service={service} />)}
          </div>
          <div className="mt-8 flex items-center justify-center gap-4">
            <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 12))} className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-40">Previous</button>
            <span className="text-sm text-muted-foreground">{offset + 1}–{Math.min(offset + 12, result.total)} of {result.total}</span>
            <button type="button" disabled={offset + 12 >= result.total} onClick={() => setOffset(offset + 12)} className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-40">Next</button>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <h2 className="text-xl font-semibold text-foreground">No services found yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">Try a different search, or be the first to list a local service.</p>
          <Link to="/services/new" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">List your service</Link>
        </div>
      )}
    </div>
  );
}
