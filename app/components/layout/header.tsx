"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Building2,
  Users,
  ChevronDown,
  Menu,
  X,
  Plus,
  LogOut,
  User,
  FolderOpen,
  Crosshair,
  Telescope,
  Radar,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { useCompany } from "@/lib/context/CompanyContext";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const navigation = [
  { name: "Solicitations", href: "/solicitations", icon: FolderOpen },
  { name: "Capture",       href: "/capture",        icon: Crosshair },
  { name: "Research",      href: "/research",        icon: Telescope },
  { name: "Opportunities", href: "/opportunities",   icon: Radar },
  { name: "Company Data",  href: "/company/profile", icon: Building2 },
  { name: "All Companies", href: "/companies",       icon: Users },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  // Exact match OR child route — use trailing slash to avoid /company matching /companies
  return pathname === href || pathname.startsWith(href + "/");
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedCompany, companies, selectCompany, loading } = useCompany();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const fetchSession = async () => {
      const res = await fetch("/api/auth/me");
      const data = await res.json().catch(() => ({}));
      setUserEmail(data.userEmail ?? null);
    };
    fetchSession();
  }, []);

  const handleLogout = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">

          {/* ── Logo ──────────────────────────────────────────────── */}
          <Link href="/solicitations" className="flex shrink-0 items-center">
            <Image
              src="/ClicklessAI.png"
              alt="ClicklessAI"
              width={260}
              height={65}
              className="h-8 w-auto sm:h-9"
              priority
            />
          </Link>

          {/* ── Desktop nav ───────────────────────────────────────── */}
          {/* md: icons only  |  lg: icon + label */}
          <nav className="hidden md:flex md:items-center md:gap-0.5 lg:gap-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                title={item.name}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors lg:px-3",
                  isActive(item.href, pathname)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="hidden lg:inline">{item.name}</span>
              </Link>
            ))}
          </nav>

          {/* ── Right-side controls ───────────────────────────────── */}
          <div className="flex items-center gap-2">

            {/* Company selector */}
            {loading ? (
              <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted/50 px-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="hidden text-sm text-muted-foreground sm:inline">Loading…</span>
              </div>
            ) : companies.length === 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => router.push("/company?newIntake=1")}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Add Company</span>
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 bg-transparent border-border"
                  >
                    {/* Icon always visible */}
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                    </div>

                    {/* Company name: visible from sm+, max-width grows at lg */}
                    <div className="hidden min-w-0 text-left sm:block">
                      <p className="max-w-[110px] truncate text-sm font-medium lg:max-w-[160px]">
                        {selectedCompany?.company_name ?? "Select company"}
                      </p>
                      {/* CAGE only on lg */}
                      <p className="hidden text-xs text-muted-foreground lg:block">
                        {selectedCompany
                          ? `CAGE: ${selectedCompany.cage_code}`
                          : "Choose from list"}
                      </p>
                    </div>

                    <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-64">
                  {companies.map((company) => (
                    <DropdownMenuItem
                      key={company.id}
                      onClick={() => selectCompany(company.id)}
                      className="flex items-center gap-3 p-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {company.company_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          CAGE: {company.cage_code}
                        </p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    onClick={() => router.push("/companies")}
                    className="mt-1 border-t border-border pt-2"
                  >
                    Manage companies
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/company?newIntake=1")}
                  >
                    + New Company
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* User menu — icon on md, icon+email on lg */}
            {userEmail && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <User className="h-4 w-4 shrink-0" />
                    <span className="hidden max-w-[120px] truncate text-sm lg:inline">
                      {userEmail}
                    </span>
                    <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 lg:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[200px]">
                  {/* Show full email in dropdown so it's always accessible */}
                  <div className="truncate border-b border-border px-2 py-1.5 text-xs text-muted-foreground">
                    {userEmail}
                  </div>
                  <DropdownMenuItem onClick={handleLogout} className="mt-1">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Hamburger — md:hidden (visible on sm and below) */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* ── Mobile drawer ─────────────────────────────────────────── */}
        {mobileMenuOpen && (
          <div className="border-t border-border pb-4 pt-3 md:hidden">

            {/* Nav links */}
            <nav className="flex flex-col gap-0.5">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(item.href, pathname)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Company switcher — only shown below sm where header button is hidden */}
            {companies.length > 0 && (
              <div className="mt-3 border-t border-border pt-3 sm:hidden">
                <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Active Company
                </p>
                <div className="flex flex-col gap-0.5">
                  {companies.map((company) => (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => {
                        selectCompany(company.id);
                        setMobileMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        selectedCompany?.id === company.id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{company.company_name}</p>
                        <p className="text-xs text-muted-foreground">
                          CAGE: {company.cage_code}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Logout */}
            {userEmail && (
              <div className="mt-3 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">Sign out · {userEmail}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
