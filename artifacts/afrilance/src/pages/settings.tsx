import { useState, useEffect, useRef } from "react";
import {
  useGetMyProfile,
  useUpsertMyProfile,
  getGetMyProfileQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { useFileUpload } from "@/hooks/useFileUpload";

const CATEGORIES = [
  "Software Development", "Design & Creative", "Writing & Content",
  "Digital Marketing", "Data Science", "Video & Animation",
  "Music & Audio", "Business", "Engineering & Architecture",
  "Legal", "Finance & Accounting", "Customer Service", "Consulting",
];

type PortfolioItem = {
  id: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  projectUrl?: string | null;
};

let nextPortfolioId = Date.now();

function UploadButton({
  label,
  hint,
  accept,
  maxSizeMB,
  currentUrl,
  onUploaded,
  icon,
}: {
  label: string;
  hint: string;
  accept: string[];
  maxSizeMB: number;
  currentUrl: string | null | undefined;
  onUploaded: (path: string) => void;
  icon: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress, error } = useFileUpload({
    accept,
    maxSizeMB,
    onSuccess: onUploaded,
  });

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="border border-border rounded-xl p-4 bg-background">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-foreground">{label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
          {currentUrl && (
            <a
              href={`/api/storage${currentUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View current file
            </a>
          )}
          {error && (
            <p className="text-xs text-destructive mt-1">{error}</p>
          )}
          {isUploading && (
            <div className="mt-2">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Uploading...</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="flex-shrink-0 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {currentUrl ? "Replace" : "Upload"}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept.join(",")}
        onChange={handleChange}
      />
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() },
  });
  const { mutate, isPending } = useUpsertMyProfile();

  const [form, setForm] = useState({
    name: "",
    bio: "",
    location: "",
    skills: [] as string[],
    newSkill: "",
    hourlyRate: "",
    fixedRate: "",
    category: "",
    portfolioItems: [] as PortfolioItem[],
    avatarUrl: null as string | null,
    resumeUrl: null as string | null,
    verificationDocUrl: null as string | null,
  });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [portfolioTab, setPortfolioTab] = useState<"list" | "add" | number>("list");
  const [portfolioForm, setPortfolioForm] = useState({ title: "", description: "", imageUrl: "", projectUrl: "" });

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const portfolioImageInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile: uploadAvatar, isUploading: avatarUploading, error: avatarError } = useFileUpload({
    accept: ["image/"],
    maxSizeMB: 5,
    onSuccess: (path) => setForm((f) => ({ ...f, avatarUrl: path })),
  });

  const { uploadFile: uploadPortfolioImage, isUploading: portfolioImageUploading, error: portfolioImageError } = useFileUpload({
    accept: ["image/"],
    maxSizeMB: 5,
    onSuccess: (path) => setPortfolioForm((f) => ({ ...f, imageUrl: path })),
  });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? "",
        bio: profile.bio ?? "",
        location: profile.location ?? "",
        skills: profile.skills ?? [],
        newSkill: "",
        hourlyRate: profile.hourlyRate != null ? String(profile.hourlyRate) : "",
        fixedRate: (profile as any).fixedRate != null ? String((profile as any).fixedRate) : "",
        category: profile.category ?? "",
        portfolioItems: (profile.portfolioItems ?? []) as PortfolioItem[],
        avatarUrl: profile.avatarUrl ?? null,
        resumeUrl: (profile as any).resumeUrl ?? null,
        verificationDocUrl: (profile as any).verificationDocUrl ?? null,
      });
    }
  }, [profile]);

  const addSkill = () => {
    const skill = form.newSkill.trim();
    if (skill && !form.skills.includes(skill)) {
      setForm((f) => ({ ...f, skills: [...f.skills, skill], newSkill: "" }));
    }
  };

  const removeSkill = (skill: string) => {
    setForm((f) => ({ ...f, skills: f.skills.filter((s) => s !== skill) }));
  };

  const addPortfolioItem = () => {
    if (!portfolioForm.title.trim()) return;
    const newItem: PortfolioItem = {
      id: ++nextPortfolioId,
      title: portfolioForm.title.trim(),
      description: portfolioForm.description.trim() || null,
      imageUrl: portfolioForm.imageUrl.trim() || null,
      projectUrl: portfolioForm.projectUrl.trim() || null,
    };
    setForm((f) => ({ ...f, portfolioItems: [...f.portfolioItems, newItem] }));
    setPortfolioForm({ title: "", description: "", imageUrl: "", projectUrl: "" });
    setPortfolioTab("list");
  };

  const removePortfolioItem = (id: number) => {
    setForm((f) => ({ ...f, portfolioItems: f.portfolioItems.filter((p) => p.id !== id) }));
  };

  const editPortfolioItem = (id: number) => {
    const item = form.portfolioItems.find((p) => p.id === id);
    if (!item) return;
    setPortfolioForm({
      title: item.title,
      description: item.description ?? "",
      imageUrl: item.imageUrl ?? "",
      projectUrl: item.projectUrl ?? "",
    });
    setPortfolioTab(id);
  };

  const savePortfolioEdit = (id: number) => {
    if (!portfolioForm.title.trim()) return;
    setForm((f) => ({
      ...f,
      portfolioItems: f.portfolioItems.map((p) =>
        p.id === id
          ? { ...p, title: portfolioForm.title.trim(), description: portfolioForm.description.trim() || null, imageUrl: portfolioForm.imageUrl.trim() || null, projectUrl: portfolioForm.projectUrl.trim() || null }
          : p,
      ),
    }));
    setPortfolioForm({ title: "", description: "", imageUrl: "", projectUrl: "" });
    setPortfolioTab("list");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    setError("");
    setSuccess(false);
    mutate(
      {
        data: {
          role: profile?.role ?? "freelancer",
          name: form.name.trim(),
          bio: form.bio.trim() || null,
          location: form.location.trim() || null,
          skills: form.skills,
          hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : null,
          fixedRate: form.fixedRate ? parseFloat(form.fixedRate) : null,
          category: form.category || null,
          portfolioItems: form.portfolioItems,
          avatarUrl: form.avatarUrl,
          resumeUrl: form.resumeUrl,
          verificationDocUrl: form.verificationDocUrl,
        } as any,
      },
      {
        onSuccess: () => {
          setSuccess(true);
          queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
          setTimeout(() => setSuccess(false), 3000);
        },
        onError: () => {
          setError("Failed to update profile. Please try again.");
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const isEditing = typeof portfolioTab === "number";
  const isAddingPortfolio = portfolioTab === "add";
  const showPortfolioForm = isEditing || isAddingPortfolio;

  const verificationStatus = (profile as any)?.verificationStatus ?? "none";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
        <p className="text-muted-foreground text-sm">Update your public profile information</p>
      </div>

      {/* Profile Picture */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-card border border-border rounded-xl">
        <div className="relative flex-shrink-0">
          <UserAvatar name={profile?.name} avatarUrl={form.avatarUrl} size="lg" />
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarUploading}
            className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
            title="Upload profile photo"
          >
            {avatarUploading ? (
              <svg className="w-3.5 h-3.5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await uploadAvatar(file);
              if (avatarInputRef.current) avatarInputRef.current.value = "";
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground">{profile?.name}</div>
          <div className="text-sm text-muted-foreground capitalize">{profile?.role}</div>
          {profile?.completedJobs != null && (
            <div className="text-xs text-muted-foreground">{profile.completedJobs} jobs completed</div>
          )}
          {avatarError && <p className="text-xs text-destructive mt-1">{avatarError}</p>}
          <p className="text-xs text-muted-foreground mt-1">Click the camera icon to upload a profile photo (JPG, PNG, WebP · max 5MB)</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-8 space-y-5">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">{error}</div>
        )}
        {success && (
          <div className="p-3 bg-emerald-100 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            Profile updated successfully!
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Full Name *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Bio</label>
          <textarea
            rows={4}
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            placeholder="Tell people about yourself..."
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

        {profile?.role === "freelancer" && (
          <>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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
                  placeholder="Add a skill"
                  className="flex-1 px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <button type="button" onClick={addSkill} className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
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

            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">Pricing</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Hourly Rate (₵/hr)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₵</span>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={form.hourlyRate}
                      onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                      placeholder="e.g. 80"
                      className="w-full pl-7 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Fixed Rate per project (₵)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₵</span>
                    <input
                      type="number"
                      min="1"
                      max="1000000"
                      value={form.fixedRate}
                      onChange={(e) => setForm((f) => ({ ...f, fixedRate: e.target.value }))}
                      placeholder="e.g. 500"
                      className="w-full pl-7 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Set one or both rates. Clients will see whichever you provide.</p>
            </div>

            {/* Documents Section */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">Documents</label>

              <UploadButton
                label="Resume / CV"
                hint="PDF or Word document · max 10MB"
                accept={["application/pdf", ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]}
                maxSizeMB={10}
                currentUrl={form.resumeUrl}
                onUploaded={(path) => setForm((f) => ({ ...f, resumeUrl: path }))}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
              />

              <UploadButton
                label="Identity Verification Document"
                hint="Ghana Card, Voter's ID, or ECOWAS card · JPG, PNG, or PDF · max 10MB"
                accept={["image/jpeg", "image/png", "image/webp", "application/pdf"]}
                maxSizeMB={10}
                currentUrl={form.verificationDocUrl}
                onUploaded={(path) => setForm((f) => ({ ...f, verificationDocUrl: path }))}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                }
              />

              {/* Verification status banner */}
              {verificationStatus === "pending" && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Your ID is under review. You'll get the Verified badge once approved.
                </div>
              )}
              {verificationStatus === "approved" && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Identity verified! Your Verified badge is active.
                </div>
              )}
              {verificationStatus === "rejected" && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Your ID was not accepted. Please upload a clearer photo and resubmit.
                </div>
              )}
              {verificationStatus === "none" && form.verificationDocUrl && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Save your profile to submit your ID for admin review.
                </div>
              )}
            </div>

            {/* Portfolio */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-foreground">Portfolio / Work Samples</label>
                {!showPortfolioForm && (
                  <button
                    type="button"
                    onClick={() => { setPortfolioForm({ title: "", description: "", imageUrl: "", projectUrl: "" }); setPortfolioTab("add"); }}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    + Add item
                  </button>
                )}
              </div>

              {showPortfolioForm ? (
                <div className="border border-border rounded-xl p-4 bg-background space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {isEditing ? "Edit Portfolio Item" : "New Portfolio Item"}
                  </p>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Title *</label>
                    <input
                      type="text"
                      value={portfolioForm.title}
                      onChange={(e) => setPortfolioForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Project name"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={portfolioForm.description}
                      onChange={(e) => setPortfolioForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="What did you build?"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Portfolio Image</label>
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => portfolioImageInputRef.current?.click()}
                        disabled={portfolioImageUploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                      >
                        {portfolioImageUploading ? (
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                        {portfolioImageUploading ? "Uploading..." : "Upload Image"}
                      </button>
                      {portfolioImageError && <span className="text-xs text-destructive">{portfolioImageError}</span>}
                    </div>
                    <input
                      ref={portfolioImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) await uploadPortfolioImage(file);
                        if (portfolioImageInputRef.current) portfolioImageInputRef.current.value = "";
                      }}
                    />
                    <input
                      type="url"
                      value={portfolioForm.imageUrl.startsWith("/") ? "" : portfolioForm.imageUrl}
                      onChange={(e) => setPortfolioForm((f) => ({ ...f, imageUrl: e.target.value }))}
                      placeholder="Or paste an image URL..."
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    {portfolioForm.imageUrl && (
                      <img
                        src={portfolioForm.imageUrl.startsWith("/") ? `/api/storage${portfolioForm.imageUrl}` : portfolioForm.imageUrl}
                        alt="Preview"
                        className="mt-2 h-20 w-full object-cover rounded-lg bg-muted"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Project URL</label>
                    <input
                      type="url"
                      value={portfolioForm.projectUrl}
                      onChange={(e) => setPortfolioForm((f) => ({ ...f, projectUrl: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => isEditing ? savePortfolioEdit(portfolioTab as number) : addPortfolioItem()}
                      disabled={!portfolioForm.title.trim()}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
                    >
                      {isEditing ? "Save Changes" : "Add Item"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPortfolioTab("list"); setPortfolioForm({ title: "", description: "", imageUrl: "", projectUrl: "" }); }}
                      className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : form.portfolioItems.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
                  No portfolio items yet. Add your best work to impress clients!
                </div>
              ) : (
                <div className="space-y-2">
                  {form.portfolioItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 border border-border rounded-xl bg-background">
                      {item.imageUrl && (
                        <img src={item.imageUrl.startsWith("/") ? `/api/storage${item.imageUrl}` : item.imageUrl} alt={item.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-muted" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground truncate">{item.title}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</div>
                        )}
                        {item.projectUrl && (
                          <a href={item.projectUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-0.5 block truncate" onClick={(e) => e.stopPropagation()}>
                            {item.projectUrl}
                          </a>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button type="button" onClick={() => editPortfolioItem(item.id)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button type="button" onClick={() => removePortfolioItem(item.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setPortfolioForm({ title: "", description: "", imageUrl: "", projectUrl: "" }); setPortfolioTab("add"); }}
                    className="w-full py-2 text-xs text-primary border border-dashed border-primary/40 rounded-lg hover:bg-primary/5 transition-colors font-medium"
                  >
                    + Add another item
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
