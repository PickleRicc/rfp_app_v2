import { redirect } from "next/navigation";
import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { FileText, LayoutDashboard, ClipboardList } from "lucide-react";
import { PortalLogout } from "../PortalLogout";

export default async function PortalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireClient();
  } catch {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/portal" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <FileText className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-foreground">Client Portal</p>
                <p className="text-xs text-muted-foreground">Proposal status & onboarding</p>
              </div>
            </Link>
            <nav className="hidden md:flex md:items-center md:gap-1">
              <Link
                href="/portal"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link
                href="/portal/onboarding"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ClipboardList className="h-4 w-4" />
                Onboarding
              </Link>
            </nav>
            <PortalLogout />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
