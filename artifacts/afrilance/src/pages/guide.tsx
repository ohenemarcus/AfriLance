import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";

const WORKFLOWS = {
  freelancer: [
    {
      title: "Build a strong profile",
      detail: "Add your bio, skills, category, rate, languages, and relevant certifications so clients can judge fit before they send an offer.",
      href: "/settings",
      action: "Edit your profile",
    },
    {
      title: "Find the right jobs",
      detail: "Browse open listings, filter by skills and budget, and read the requirements carefully before you apply.",
      href: "/jobs",
      action: "Browse jobs",
    },
    {
      title: "Send a clear proposal",
      detail: "Explain your approach, relevant experience, timeline, and bid amount. A strong proposal is specific and easy to compare.",
      href: "/jobs",
      action: "Find a project",
    },
    {
      title: "Wait for acceptance and funding",
      detail: "If a client accepts your proposal, the job moves to awaiting funding. Work only begins after the client’s payment is confirmed in escrow. Save your bank or Mobile Money payout method in Payments and verify it before the client releases payment, so payment can be sent without asking the client for your account details.",
      href: "/proposals",
      action: "Track proposals",
    },
    {
      title: "Submit your work for review",
      detail: "After the client’s payment is confirmed in escrow and the project is marked In progress, open the project’s job page from your dashboard, or tap a project notification to go there. In the Project progress panel, enter a work summary, attach up to five files if needed, then select Submit work for review. The client reviews it on that same page and can approve it or request changes. If they request revisions, read their note, update the work, and submit it again.",
      href: "/dashboard",
      action: "Open your dashboard",
    },
    {
      title: "Get paid after approval",
      detail: "Once the client approves your work, they release the escrowed payment. AfriLance sends it to the payout method you saved in Payments; clients cannot view or edit your bank or Mobile Money details. Track the payout status there and leave a review after completion.",
      href: "/payments",
      action: "Set up payout and check payments",
    },
  ],
  client: [
    {
      title: "Set up your client profile",
      detail: "Add your company or personal introduction, location, and other details that help freelancers understand the project and your expectations.",
      href: "/settings",
      action: "Edit your profile",
    },
    {
      title: "Post a clear job",
      detail: "Describe the deliverables, required skills, budget, timeline, and any working preferences before you publish the listing.",
      href: "/jobs/post",
      action: "Post a job",
    },
    {
      title: "Review proposals and choose a freelancer",
      detail: "Compare profiles, proposals, and skills from the job page or dashboard. Accept one freelancer for the project at a time.",
      href: "/dashboard",
      action: "View your dashboard",
    },
    {
      title: "Fund the accepted project",
      detail: "Once a freelancer is accepted, the job moves to awaiting funding. Fund the project through Payments so the money is held in escrow before work begins.",
      href: "/payments",
      action: "Open payments",
    },
    {
      title: "Track progress and coordinate",
      detail: "Use Messages and the project progress panel to confirm scope, ask for updates, and review the submitted work or revision notes.",
      href: "/messages",
      action: "Message team",
    },
    {
      title: "Approve work and release payment",
      detail: "Review the submission on the project page and approve it or request revisions. After approval, release the payment from Payments. AfriLance sends it to the freelancer’s verified payout method; you do not need to collect or enter their bank or Mobile Money details. You can follow the transfer status in Payments.",
      href: "/payments",
      action: "Release payout",
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
          <p className="text-sm font-semibold text-primary">Afrlance guide</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">How to use Afrlance</h1>
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
