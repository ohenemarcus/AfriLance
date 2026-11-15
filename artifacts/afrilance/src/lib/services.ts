export const SERVICE_CATEGORIES = [
  "Construction",
  "Tailoring & Fashion",
  "Plumbing",
  "Electrical",
  "Beauty & Grooming",
  "Trade",
  "Marketing",
  "Cleaning",
  "Transport",
  "Catering & Events",
  "Repairs & Maintenance",
  "Other",
];

export type ServicePricingType = "hourly" | "fixed" | "contact_for_quote";

export interface ServicePortfolioImage {
  id: number;
  serviceId: number;
  imageUrl: string;
  caption: string | null;
}

export interface ServiceListing {
  id: number;
  userId: string;
  title: string;
  category: string;
  description: string;
  pricingType: ServicePricingType;
  baseRate: number | null;
  region: string;
  city: string;
  phoneNumber: string;
  whatsappNumber: string;
  isVerified: boolean;
  createdAt: string;
  providerName: string;
  providerAvatarUrl?: string | null;
  portfolioImages: ServicePortfolioImage[];
  distanceKm?: number | null;
  hasServiceLocation?: boolean;
}

export interface ServiceCoordinates {
  latitude: number;
  longitude: number;
}

export function getCurrentCoordinates(): Promise<ServiceCoordinates> {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("Location services are not available in this browser."));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. Allow location access in your browser to use this feature."
          : error.code === error.POSITION_UNAVAILABLE
            ? "Your location could not be determined. Try again or check your device settings."
            : "Location request timed out. Please try again.";
        reject(new Error(message));
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
    );
  });
}

export function servicesApiUrl(path: string): string {
  const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  return new URL(path, apiBase).toString();
}

export function serviceImageUrl(imageUrl: string): string {
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return servicesApiUrl(imageUrl);
}

export function whatsappUrl(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

export function phoneNumberUrl(phoneNumber: string, protocol: "tel" | "sms"): string {
  const number = phoneNumber.replace(/[^\d+]/g, "");
  return `${protocol}:${number}`;
}

export async function serviceRequest<T>(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(servicesApiUrl(path), {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `Service request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
