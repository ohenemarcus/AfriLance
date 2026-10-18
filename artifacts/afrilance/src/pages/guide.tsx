import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";

const WORKFLOWS = {
  freelancer: [
    {
      title: "Build a useful profile",
      detail: "Add a clear bio, your category, skills, rate, and examples of your work so clients can assess fit.",
      href: "/settings",
      action: "Edit your profile",
    },
    {
      title: "Find projects that fit",
      detail: "Browse open jobs and use the search and filters to narrow by category, skills, budget, and work style.",
      href: "/jobs",
      action: "Browse jobs",
    },
    {
      title: "Send a thoughtful proposal",
      detail: "Open a job, review its requirements, then explain your approach, relevant experience, price, and timeline.",
      href: "/jobs",
      action: "Find a project",
    },
    {
      title: "Track replies and keep work moving",
      detail: "Check proposal status, respond to clients in Messages, and review payment status before starting or wrapping up work.",
      href: "/proposals",
      action: "View proposals",
    },
  ],
  client: [
    {
      title: "Set up your client profile",
      detail: "Add your location and a short introduction so freelancers know who is posting the work.",
      href: "/settings",
      action: "Edit your profile",
    },
    {
      title: "Publish a clear job",
      detail: "Describe the deliverables, required skills, budget, and expected timeline before posting.",
      href: "/jobs/post",
      action: "Post a job",
    },
    {
      title: "Compare proposals",
      detail: "Review applicants from your dashboard, compare profiles and proposals, and shortlist the best fit.",
      href: "/dashboard",
      action: "View your dashboard",
    },
    {
      title: "Coordinate and manage payment",
      detail: "Use Messages to clarify project details. Follow payment status in Payments and confirm work before releasing funds.",
      href: "/payments",
      action: "View payments",
    },
  ],
};

export default function GuidePage() {
  const { isSignedIn } = useAuth();
  const { data: profile } = useGetMyProfile({
    query: { enabled: !!isSignedIn, queryKey: getGetMyProfileQueryKey() },
  });
  const [role, setRole] = useState<"client" | "freelancer">("client");

  useEffect(() => {
    if (profile?.role === "client" || profile?.role === "freelancer") setRole(profile.role);
  }, [profile?.role]);

  const steps = WORKFLOWS[role];

  return (
    <main className="min-h-[70vh] bg-background px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-primary">AfriLance guide</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">How to use AfriLance</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Follow the steps for your role. You can switch roles at any time to see the other workflow.</p>
        </div>

        <div className="mt-7 inline-flex rounded-lg border border-border bg-card p-1" role="tablist" aria-label="Choose your workflow">
          {([
            ["client", "I’m hiring"],
            ["freelancer", "I’m freelancing"],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={role === value} onClick={() => setRole(value)} className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${role === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>

        <ol className="mt-8 divide-y divide-border border-y border-border">
          {steps.map((step, index) => (
            <li key={step.title} className="grid gap-4 py-6 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-start">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span>
              <div>
                <h2 className="font-semibold text-foreground">{step.title}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{step.detail}</p>
              </div>
              <Link to={step.href} className="self-center text-sm font-semibold text-primary hover:underline">{step.action} <span aria-hidden="true">→</span></Link>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">Need help with an account, job, or payment?</p>
          <Link to="/support" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">Contact support</Link>
        </div>
      </div>
    </main>
  );
}
