import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser, useAuth } from "@clerk/react"; // 👈 Added useAuth here
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { useGetMyProfile, getGetMyProfileQueryKey, setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
// lib\api-client-react\src\custom-fetch.ts

import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import OnboardingPage from "@/pages/onboarding";
import DashboardPage from "@/pages/dashboard";
import JobsPage from "@/pages/jobs";
import JobDetailPage from "@/pages/job-detail";
import PostJobPage from "@/pages/post-job";
import FreelancersPage from "@/pages/freelancers";
import FreelancerProfilePage from "@/pages/freelancer-profile";
import ProposalsPage from "@/pages/proposals";
import MessagesPage from "@/pages/messages";
import NotificationsPage from "@/pages/notifications";
import PaymentsPage from "@/pages/payments";
import SettingsPage from "@/pages/settings";
import AdminPage from "@/pages/admin";



// Fallback directly to the environment variable if dynamic parsing fails
// const clerkPubKey = publishableKeyFromHost(
//   window.location.hostname,
//   import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
// ) || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// if (!clerkPubKey) {
//   throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables.");
// }



// When deployed with a separate API server (e.g. Railway), point all API calls there.
if (import.meta.env.VITE_API_BASE_URL) {
  setBaseUrl(import.meta.env.VITE_API_BASE_URL as string);
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Look for the env key first. If it's missing, fall back to empty string so it doesn't crash the compiler.
const rawKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
console.log("DEBUG: Your Clerk Env Key is:", import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

const clerkPubKey = rawKey.startsWith("pk_") 
  ? rawKey 
  : publishableKeyFromHost(window.location.hostname, rawKey);

if (!clerkPubKey) {
  console.warn("Clerk publishable key could not be resolved.");
}
// const clerkPubKey = publishableKeyFromHost(
//   window.location.hostname,
//   import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
// ) || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// if (!clerkPubKey) {
//   throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables.");
// }

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk" as const,
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/afrilance-logo-nav.svg`,
  },
  variables: {
    colorPrimary: "hsl(151, 68%, 14%)",
    colorForeground: "hsl(151, 40%, 12%)",
    colorMutedForeground: "hsl(151, 10%, 40%)",
    colorDanger: "hsl(0, 70%, 50%)",
    colorBackground: "hsl(0, 0%, 100%)",
    colorInput: "hsl(40, 20%, 94%)",
    colorInputForeground: "hsl(151, 40%, 12%)",
    colorNeutral: "hsl(151, 20%, 60%)",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-bold",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground font-medium",
    footerActionLink: "text-primary font-medium hover:underline",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-emerald-600",
    alertText: "text-foreground",
    logoBox: "flex justify-center",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border border-border bg-background hover:bg-muted",
    formButtonPrimary: "bg-primary hover:opacity-90 text-primary-foreground font-semibold",
    formFieldInput: "bg-input border-border text-foreground",
    footerAction: "bg-muted/50",
    dividerLine: "bg-border",
    alert: "border-border",
    otpCodeFieldInput: "border-border",
    formFieldRow: "",
    main: "",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsub = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsub;
  }, [addListener, qc]);

  return null;
}

// ---------------------------------------------------------------------------
// 👇 NEW: Component to register your Token Bridge with customFetch
// ---------------------------------------------------------------------------
function ClerkTokenBridge() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      // Set the token generator to use Clerk's engine
      setAuthTokenGetter(async () => {
        try {
          return await getToken();
        } catch (err) {
          console.error("Failed to retrieve authentication token from Clerk:", err);
          return null;
        }
      });
    } else {
      // Drop the token getter cleanly if the session ends
      setAuthTokenGetter(null);
    }
  }, [isSignedIn, getToken]);

  return null;
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/onboarding`}
      />
    </div>
  );
}

function HomeRoute() {
  return (
    <>
      <Show when="signed-in">
        <HomeAuthCheck />
      </Show>
      <Show when="signed-out">
        <Layout>
          <LandingPage />
        </Layout>
      </Show>
    </>
  );
}

function HomeAuthCheck() {
  const { data: profile, isLoading } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() },
  });

  if (isLoading) return null;
  if (!profile) return <Redirect to="/onboarding" />;
  return <Redirect to="/dashboard" />;
}

function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <Layout>{children}</Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function OnboardingRoute() {
  const { user } = useUser();
  if (!user) return <Redirect to="/sign-in" />;
  return <OnboardingPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/onboarding">
        <Show when="signed-in">
          <OnboardingRoute />
        </Show>
        <Show when="signed-out">
          <Redirect to="/sign-in" />
        </Show>
      </Route>
      <Route path="/dashboard">
        <AuthenticatedRoute><DashboardPage /></AuthenticatedRoute>
      </Route>
      <Route path="/jobs/post">
        <AuthenticatedRoute><PostJobPage /></AuthenticatedRoute>
      </Route>
      <Route path="/jobs/:id">
        <Layout><JobDetailPage /></Layout>
      </Route>
      <Route path="/jobs">
        <Layout><JobsPage /></Layout>
      </Route>
      <Route path="/freelancers/:id">
        <Layout><FreelancerProfilePage /></Layout>
      </Route>
      <Route path="/freelancers">
        <Layout><FreelancersPage /></Layout>
      </Route>
      <Route path="/proposals">
        <AuthenticatedRoute><ProposalsPage /></AuthenticatedRoute>
      </Route>
      <Route path="/messages">
        <AuthenticatedRoute><MessagesPage /></AuthenticatedRoute>
      </Route>
      <Route path="/notifications">
        <AuthenticatedRoute><NotificationsPage /></AuthenticatedRoute>
      </Route>
      <Route path="/payments">
        <AuthenticatedRoute><PaymentsPage /></AuthenticatedRoute>
      </Route>
      <Route path="/settings">
        <AuthenticatedRoute><SettingsPage /></AuthenticatedRoute>
      </Route>
      <Route path="/admin">
        <AuthenticatedRoute><AdminPage /></AuthenticatedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  const localization = {
  signIn: {
    start: {
      title: "Welcome back to AfriLance",
      subtitle: "Sign in to access your account",
    },
  },
  signUp: {
    start: {
      title: "Join AfriLance",
      subtitle: "Connect with top African talent and opportunities",
    },
  },
};


  return (
    <ClerkProvider
      localization={localization}
      publishableKey={clerkPubKey}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        {/* 👇 INJECTED HERE: Resolves 401s by feeding customFetch your Clerk key */}
        <ClerkTokenBridge /> 
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}