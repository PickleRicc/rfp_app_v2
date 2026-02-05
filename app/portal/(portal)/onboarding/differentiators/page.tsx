import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/app/components/ui/button";

export default function PortalOnboardingDifferentiatorsPage() {
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
        <Sparkles className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">Differentiators</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Value propositions, innovations, competitive advantages. API: GET/POST /api/company/differentiators with X-Portal: true.
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
