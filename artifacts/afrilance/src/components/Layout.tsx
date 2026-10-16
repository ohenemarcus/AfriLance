import { useUser, useClerk, Show } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./UserAvatar";
import { useGetMyProfile, getGetMyProfileQueryKey, useListNotifications, getListNotificationsQueryKey } from "@workspace/api-client-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const NAV_ITEMS = [
  { href: "/jobs", label: "Find Work" },
  { href: "/freelancers", label: "Find Talent" },
];

const AUTH_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/messages", label: "Messages" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { data: profile } = useGetMyProfile({ query: { enabled: !!user, queryKey: getGetMyProfileQueryKey() } });

  const notifParams = { limit: 1, offset: 0, unreadOnly: true };
  const { data: notifData } = useListNotifications(notifParams, {
    query: {
      enabled: !!user,
      queryKey: getListNotificationsQueryKey(notifParams),
      refetchInterval: 30000,
    },
  });
  const unreadCount = notifData?.total ?? 0;

  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <img src={`${basePath}/afrilance-logo-nav.svg`} alt="AfriLance" className="h-9 w-auto object-contain" />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6">
              <Show when="signed-out">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "text-sm font-medium transition-colors hover:text-primary",
                      location === item.href ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </Show>
              <Show when="signed-in">
                {AUTH_NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "text-sm font-medium transition-colors hover:text-primary",
                      location.startsWith(item.href) ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
                {isAdmin && (
                  <Link
                    to="/admin"
                    className={cn(
                      "text-sm font-medium transition-colors hover:text-primary",
                      location.startsWith("/admin") ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    Admin
                  </Link>
                )}
                {/* Notification Bell */}
                <Link
                  to="/notifications"
                  className="relative p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-primary"
                  title="Notifications"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              </Show>
            </nav>

            {/* Auth buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Show when="signed-out">
                <Link
                  to="/sign-in"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/sign-up"
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Get Started
                </Link>
              </Show>
              <Show when="signed-in">
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 p-1 rounded-lg hover:bg-accent transition-colors"
                  >
                    <UserAvatar
                      name={profile?.name ?? user?.fullName}
                      avatarUrl={profile?.avatarUrl}
                      size="sm"
                    />
                    <span className="text-sm font-medium text-foreground hidden lg:block">
                      {profile?.name ?? user?.fullName ?? "Account"}
                    </span>
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-lg z-20 py-1">
                        <Link
                          to="/dashboard"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          Dashboard
                        </Link>
                        <Link
                          to="/notifications"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <span>Notifications</span>
                          {unreadCount > 0 && (
                            <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </Link>
                        <Link
                          to="/payments"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          Payments
                        </Link>
                        <Link
                          to="/settings"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          Settings
                        </Link>
                        <div className="border-t border-border my-1" />
                        <button
                          onClick={() => { setDropdownOpen(false); signOut({ redirectUrl: basePath + "/" }); }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-accent w-full text-left"
                        >
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </Show>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="px-4 py-3 space-y-1">
              <Show when="signed-out">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-accent rounded-lg"
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="pt-2 flex flex-col gap-2">
                  <Link
                    to="/sign-in"
                    onClick={() => setMobileOpen(false)}
                    className="block text-center px-4 py-2 rounded-lg border border-border text-sm font-medium"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/sign-up"
                    onClick={() => setMobileOpen(false)}
                    className="block text-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
                  >
                    Get Started
                  </Link>
                </div>
              </Show>
              <Show when="signed-in">
                {AUTH_NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-accent rounded-lg"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link to="/notifications" onClick={() => setMobileOpen(false)} className="flex items-center justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent rounded-lg">
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
                <Link to="/payments" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent rounded-lg">
                  Payments
                </Link>
                <Link to="/settings" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent rounded-lg">
                  Settings
                </Link>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent rounded-lg">
                    Admin
                  </Link>
                )}
                <button
                  onClick={() => { setMobileOpen(false); signOut({ redirectUrl: basePath + "/" }); }}
                  className="block w-full text-left px-3 py-2 text-sm font-medium text-destructive hover:bg-accent rounded-lg"
                >
                  Sign Out
                </button>
              </Show>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-primary text-primary-foreground py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold tracking-tight">
                  <span className="text-primary-foreground">Afri</span><span style={{ color: "#FF7A00" }}>Lance</span>
                </span>
              </div>
              <p className="text-sm text-primary-foreground/70 max-w-xs">
                Connecting Africa's best talent with world-class opportunities.
              </p>
            </div>
            <div className="flex gap-8 text-sm text-primary-foreground/70">
              <div className="space-y-2">
                <p className="font-semibold text-primary-foreground">Platform</p>
                <Link to="/jobs" className="block hover:text-secondary transition-colors">Find Work</Link>
                <Link to="/freelancers" className="block hover:text-secondary transition-colors">Find Talent</Link>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-primary-foreground">Account</p>
                <Link to="/sign-up" className="block hover:text-secondary transition-colors">Sign Up</Link>
                <Link to="/sign-in" className="block hover:text-secondary transition-colors">Sign In</Link>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-primary-foreground/20 text-center text-sm text-primary-foreground/50"> All rights reserved.
            &copy; {new Date().getFullYear()} MB Corporation, AfriLance. Built for Africa.
          </div>
        </div>
      </footer>
    </div>
  );
}
