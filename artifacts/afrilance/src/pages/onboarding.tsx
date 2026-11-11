import { useState } from "react";
import { useLocation } from "wouter";
import { useUpsertMyProfile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useAuth, useUser } from "@clerk/react";
import { useFileUpload } from "@/hooks/useFileUpload";
import { SERVICE_CATEGORIES, serviceRequest } from "@/lib/services";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const CATEGORIES = [
  "Software Development", "Design & Creative", "Writing & Content",
  "Digital Marketing", "Data Science", "Video & Animation",
  "Music & Audio", "Business", "Engineering & Architecture",
  "Legal", "Finance & Accounting", "Customer Service", "Consulting",
];

export default function OnboardingPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<"freelancer" | "client" | "service_provider" | null>(null);
  const [form, setForm] = useState({
    name: "",
    bio: "",
    location: "",
    skills: [] as string[],
    hourlyRate: "",
    fixedRate: "",
    category: "",
    newSkill: "",
    city: "",
    region: "",
    phoneNumber: "",
    whatsappNumber: "",
    serviceTitle: "",
    serviceDescription: "",
  });
  const [serviceImages, setServiceImages] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { mutate, isPending } = useUpsertMyProfile();
  const { uploadFile, isUploading } = useFileUpload({ accept: ["image/"], maxSizeMB: 10 });

  const handleRoleSelect = (r: "freelancer" | "client" | "service_provider") => {
    setRole(r);
    setForm((f) => ({ ...f, name: user?.fullName ?? "" }));
    setStep(2);
  };

  const addServiceImages = (files: FileList | File[]) => {
    const selected = Array.from(files);
    setServiceImages((current) => [...current, ...selected].slice(0, 10));
  };

  const addSkill = () => {
    const skill = form.newSkill.trim();
    if (skill && !form.skills.includes(skill)) {
      setForm((f) => ({ ...f, skills: [...f.skills, skill], newSkill: "" }));
    }
  };

  const removeSkill = (skill: string) => {
    setForm((f) => ({ ...f, skills: f.skills.filter((s) => s !== skill) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (role === "service_provider") {
      if (!form.city.trim() || !form.region.trim() || !form.phoneNumber.trim() ||
          !form.whatsappNumber.trim() || !form.category || !form.serviceTitle.trim() ||
          !form.serviceDescription.trim() || serviceImages.length === 0) {
        setError("Complete the required service details and add at least one portfolio image.");
        return;
      }
    }
    setError("");
    mutate(
      {
        data: {
          role,
          name: form.name.trim(),
          bio: form.bio.trim() || null,
          location: role === "service_provider"
            ? `${form.city.trim()}, ${form.region.trim()}`
            : form.location.trim() || null,
          skills: form.skills,
          hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : null,
          fixedRate: form.fixedRate ? parseFloat(form.fixedRate) : null,
          category: form.category || null,
        },
      },
      {
        onSuccess: async () => {
          if (role === "service_provider") {
            try {
              const portfolioImages = [];
              for (const file of serviceImages) {
                const imageUrl = await uploadFile(file);
                if (!imageUrl) throw new Error(`Could not upload ${file.name}. Please try again.`);
                portfolioImages.push({ imageUrl, caption: file.name });
              }
              const token = await getToken();
              await serviceRequest("/api/services", token, {
                method: "POST",
                body: JSON.stringify({
                  title: form.serviceTitle.trim(),
                  category: form.category,
                  description: form.serviceDescription.trim(),
                  pricingType: "contact_for_quote",
                  region: form.region.trim(),
                  city: form.city.trim(),
                  phoneNumber: form.phoneNumber.trim(),
                  whatsappNumber: form.whatsappNumber.trim(),
                  portfolioImages,
                }),
              });
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Could not create your local service.");
              return;
            }
          }
          queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
          setLocation("/dashboard");
        },
        onError: (err) => {
          setError("Failed to save profile. Please try again.");
          console.error(err);
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-10">
          <img src={`${basePath}/logo.svg`} alt="Afrlance" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Set up your profile</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Step {step} of 2 — {step === 1 ? "Choose your role" : "Fill in your details"}
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s <= step ? "bg-primary w-12" : "bg-muted w-8"
                }`}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <button
              onClick={() => handleRoleSelect("freelancer")}
              className="group p-8 bg-card border-2 border-border rounded-2xl text-left hover:border-primary transition-all hover:shadow-md"
            >
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Freelance Remotely</h3>
              <p className="text-sm text-muted-foreground">
                Offer your skills, find projects, and earn money doing what you love.
              </p>
            </button>
            <button
              onClick={() => handleRoleSelect("client")}
              className="group p-8 bg-card border-2 border-border rounded-2xl text-left hover:border-primary transition-all hover:shadow-md"
            >
              <div className="w-14 h-14 bg-secondary/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-secondary/30 transition-colors">
                <svg className="w-7 h-7 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Hire Talent</h3>
              <p className="text-sm text-muted-foreground">
                Post jobs, find top talent across Africa, and grow your business.
              </p>
            </button>
            <button
              onClick={() => handleRoleSelect("service_provider")}
              className="group p-8 bg-card border-2 border-border rounded-2xl text-left hover:border-primary transition-all hover:shadow-md"
            >
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mb-4 text-2xl group-hover:bg-emerald-200 transition-colors" aria-hidden="true">🛠</div>
              <h3 className="text-xl font-bold text-foreground mb-2">Offer Local Service / Trade</h3>
              <p className="text-sm text-muted-foreground">
                Connect with nearby customers for skilled trades, professional services, and local work.
              </p>
            </button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-8 space-y-5">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Public profile name *</label>
              <input
                type="text"
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Name other users will see"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">Your registration name remains associated with your account. This public name can be changed later once every 90 days.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Bio</label>
              <textarea
                rows={3}
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder={role === "freelancer" ? "Describe your experience and expertise..." : "Tell freelancers about yourself and your business..."}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              />
            </div>

            {role !== "service_provider" && <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Lagos, Nigeria"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>}

            {role === "service_provider" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-foreground">
                    City *
                    <input required value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="e.g. East Legon" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
                  </label>
                  <label className="block text-sm font-medium text-foreground">
                    Region *
                    <input required value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} placeholder="e.g. Greater Accra" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
                  </label>
                  <label className="block text-sm font-medium text-foreground">
                    Phone number *
                    <input required type="tel" value={form.phoneNumber} onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))} placeholder="+233 ..." className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
                  </label>
                  <label className="block text-sm font-medium text-foreground">
                    WhatsApp number *
                    <input required type="tel" value={form.whatsappNumber} onChange={(e) => setForm((f) => ({ ...f, whatsappNumber: e.target.value }))} placeholder="+233 ..." className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
                  </label>
                </div>
                <label className="block text-sm font-medium text-foreground">
                  Primary service category *
                  <select required value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                    <option value="">Select a category</option>
                    {SERVICE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-foreground">
                  Service title *
                  <input required maxLength={120} value={form.serviceTitle} onChange={(e) => setForm((f) => ({ ...f, serviceTitle: e.target.value }))} placeholder="e.g. Custom tailoring and alterations" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  Service description *
                  <textarea required minLength={10} maxLength={5000} rows={4} value={form.serviceDescription} onChange={(e) => setForm((f) => ({ ...f, serviceDescription: e.target.value }))} placeholder="Describe your experience, services, and what customers can expect." className="mt-1.5 w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
                </label>
                <div>
                  <label htmlFor="onboarding-service-images" className="block text-sm font-medium text-foreground mb-1.5">Portfolio images * (up to 10, 10MB each)</label>
                  <input id="onboarding-service-images" type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) addServiceImages(e.target.files); e.currentTarget.value = ""; }} className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-accent-foreground" />
                  {serviceImages.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {serviceImages.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2"><span className="truncate">{file.name}</span><button type="button" onClick={() => setServiceImages((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="text-destructive">Remove</button></li>)}
                    </ul>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">Show examples of your work. At least one image is required to publish your service.</p>
                </div>
              </>
            )}

            {role === "freelancer" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="">Select a category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Skills</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.newSkill}
                      onChange={(e) => setForm((f) => ({ ...f, newSkill: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                      placeholder="Add a skill (e.g. React)"
                      className="flex-1 px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={addSkill}
                      className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
                    >
                      Add
                    </button>
                  </div>
                  {form.skills.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {form.skills.map((s) => (
                        <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent text-accent-foreground rounded-lg text-xs font-medium">
                          {s}
                          <button type="button" onClick={() => removeSkill(s)} className="text-muted-foreground hover:text-foreground">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Hourly Rate (GHS)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₵</span>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={form.hourlyRate}
                        onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                        placeholder="50"
                        className="w-full pl-7 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Fixed Rate (GHS)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₵</span>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={form.fixedRate}
                        onChange={(e) => setForm((f) => ({ ...f, fixedRate: e.target.value }))}
                        placeholder="1200"
                        className="w-full pl-7 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 px-4 py-3 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isPending || isUploading}
                className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isUploading ? "Uploading images..." : isPending ? "Saving..." : role === "service_provider" ? "Create Service Profile" : "Complete Profile"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
