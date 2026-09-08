import { useState } from "react";
import { useLocation } from "wouter";
import { useUpsertMyProfile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const CATEGORIES = [
  "Software Development", "Design & Creative", "Writing & Content",
  "Digital Marketing", "Data Science", "Video & Animation",
  "Music & Audio", "Business", "Engineering & Architecture",
  "Legal", "Finance & Accounting", "Customer Service", "Consulting",
];

export default function OnboardingPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<"freelancer" | "client" | null>(null);
  const [form, setForm] = useState({
    name: "",
    bio: "",
    location: "",
    skills: [] as string[],
    hourlyRate: "",
    fixedRate: "",
    category: "",
    newSkill: "",
  });
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { mutate, isPending } = useUpsertMyProfile();

  const handleRoleSelect = (r: "freelancer" | "client") => {
    setRole(r);
    setForm((f) => ({ ...f, name: user?.fullName ?? "" }));
    setStep(2);
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
    setError("");
    mutate(
      {
        data: {
          role,
          name: form.name.trim(),
          bio: form.bio.trim() || null,
          location: form.location.trim() || null,
          skills: form.skills,
          hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : null,
          fixedRate: form.fixedRate ? parseFloat(form.fixedRate) : null,
          category: form.category || null,
        },
      },
      {
        onSuccess: () => {
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
          <img src={`${basePath}/logo.svg`} alt="AfriLance" className="h-10 mx-auto mb-4" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <button
              onClick={() => handleRoleSelect("freelancer")}
              className="group p-8 bg-card border-2 border-border rounded-2xl text-left hover:border-primary transition-all hover:shadow-md"
            >
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">I'm a Freelancer</h3>
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
              <h3 className="text-xl font-bold text-foreground mb-2">I'm a Client</h3>
              <p className="text-sm text-muted-foreground">
                Post jobs, find top talent across Africa, and grow your business.
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
              <label className="block text-sm font-medium text-foreground mb-1.5">Full Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your full name"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
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

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Lagos, Nigeria"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

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
                disabled={isPending}
                className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Complete Profile"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
