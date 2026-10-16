import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateJob, getListJobsQueryKey, getListMyJobsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const CATEGORIES = [
  "Software Development", "Design & Creative", "Writing & Content",
  "Digital Marketing", "Data Science", "Video & Animation",
  "Music & Audio", "Business", "Engineering & Architecture",
  "Legal", "Finance & Accounting", "Customer Service", "Consulting",
];

export default function PostJobPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { mutate, isPending } = useCreateJob();

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    skills: [] as string[],
    newSkill: "",
    budgetMin: "",
    budgetMax: "",
    budgetType: "fixed",
    location: "",
    remote: true,
    deadline: "",
  });
  const [error, setError] = useState("");

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
    if (!form.title.trim() || !form.description.trim() || !form.category) {
      setError("Title, description and category are required");
      return;
    }
    setError("");
    mutate(
      {
        data: {
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          skills: form.skills,
          budgetMin: form.budgetMin ? parseFloat(form.budgetMin) : null,
          budgetMax: form.budgetMax ? parseFloat(form.budgetMax) : null,
          budgetType: form.budgetType,
          location: form.location.trim() || null,
          remote: form.remote,
          deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        },
      },
      {
        onSuccess: (job) => {
          queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListMyJobsQueryKey() });
          setLocation(`/jobs/${job.id}`);
        },
        onError: (err: any) => {
          setError(err?.data?.error ?? "Failed to post job. Please try again.");
        },
      },
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Post a Job</h1>
        <p className="text-muted-foreground text-sm">Find the perfect freelancer for your project</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-8 space-y-6">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Job Title *</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Build a React e-commerce website"
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Description *</label>
          <textarea
            rows={6}
            required
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Describe the project in detail. Include requirements, deliverables, and any specific skills needed..."
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Category *</label>
          <select
            required
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Required Skills</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.newSkill}
              onChange={(e) => setForm((f) => ({ ...f, newSkill: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
              placeholder="Add a required skill"
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
            <label className="block text-sm font-medium text-foreground mb-1.5">Budget Type</label>
            <select
              value={form.budgetType}
              onChange={(e) => setForm((f) => ({ ...f, budgetType: e.target.value }))}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="fixed">Fixed Price</option>
              <option value="hourly">Hourly Rate</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Budget Range (GHS) {form.budgetType === "hourly" ? "/hr" : ""}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₵</span>
                <input
                  type="number"
                  min="0"
                  value={form.budgetMin}
                  onChange={(e) => setForm((f) => ({ ...f, budgetMin: e.target.value }))}
                  placeholder="Min"
                  className="w-full pl-7 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₵</span>
                <input
                  type="number"
                  min="0"
                  value={form.budgetMax}
                  onChange={(e) => setForm((f) => ({ ...f, budgetMax: e.target.value }))}
                  placeholder="Max"
                  className="w-full pl-7 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Lagos, Nigeria (or leave blank)"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Deadline</label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              min={new Date().toISOString().split("T")[0]}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="remote"
            checked={form.remote}
            onChange={(e) => setForm((f) => ({ ...f, remote: e.target.checked }))}
            className="rounded border-border text-primary"
          />
          <label htmlFor="remote" className="text-sm font-medium text-foreground cursor-pointer">
            This is a remote-friendly job
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setLocation("/dashboard")}
            className="flex-1 py-3 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isPending ? "Posting..." : "Post Job"}
          </button>
        </div>
      </form>
    </div>
  );
}
