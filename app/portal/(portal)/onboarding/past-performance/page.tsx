import Link from "next/link";
import { BarChart3, ArrowLeft } from "lucide-react";
import { Button } from "@/app/components/ui/button";

export default function PortalOnboardingPastPerformancePage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/portal/onboarding"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to onboarding
      </Link>
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">Past performance</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Contract history and achievements. API: GET/POST /api/company/past-performance with X-Portal: true.
        </p>
        <Link href="/portal/onboarding" className="mt-6 inline-block">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to onboarding
          </Button>
        </Link>
      </div>
    </div>
  );
}
