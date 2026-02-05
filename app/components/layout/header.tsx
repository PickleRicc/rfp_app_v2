"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FileText,
  Upload,
  Building2,
  Users,
  ChevronDown,
  Menu,
  X,
  Plus,
  LogOut,
  User,
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
  { name: "Upload RFP", href: "/", icon: Upload },
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "Company Data", href: "/company", icon: Building2 },
  { name: "All Companies", href: "/companies", icon: Users },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedCompany, companies, selectCompany, loading } = useCompany();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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

  const handleSelectCompany = (companyId: string) => {
    selectCompany(companyId);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-foreground">
                RFP Response Tool
              </p>
              <p className="text-xs text-muted-foreground">
                Multi-Company Management
              </p>
            </div>
          </Link>

          <nav className="hidden md:flex md:items-center md:gap-1">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {loading ? (
              <div className="hidden h-9 items-center gap-2 rounded-md border border-border bg-muted/50 px-3 sm:flex">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">
                  Loading...
                </span>
              </div>
            ) : companies.length === 0 ? (
              <Button
                variant="outline"
                className="hidden gap-2 sm:flex"
                onClick={() => router.push("/company/profile/new")}
              >
                <Plus className="h-4 w-4" />
                Add Company
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="hidden gap-2 sm:flex bg-transparent border-border"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">
                        {selectedCompany?.company_name ?? "Select company"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedCompany
                          ? `CAGE: ${selectedCompany.cage_code}`
                          : "Choose from list"}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {companies.map((company) => (
                    <DropdownMenuItem
                      key={company.id}
                      onClick={() => handleSelectCompany(company.id)}
                      className="flex items-center gap-3 p-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {company.company_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          CAGE: {company.cage_code}
                        </p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    onClick={() => {
                      router.push("/companies");
                    }}
                    className="border-t border-border pt-2"
                  >
                    Manage companies
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/company/profile/new")}
                  >
                    + New Company
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {userEmail && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden gap-2 sm:flex text-muted-foreground hover:text-foreground"
                  >
                    <User className="h-4 w-4" />
                    <span className="max-w-[140px] truncate text-sm">
                      {userEmail}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-border py-4 md:hidden">
            <nav className="flex flex-col gap-1">
              {navigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
              {userEmail && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-5 w-5" />
                  Log out
                </button>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
