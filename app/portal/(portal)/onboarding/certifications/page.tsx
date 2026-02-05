import Link from "next/link";
import { FileCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/app/components/ui/button";

export default function PortalOnboardingCertificationsPage() {
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
        <FileCheck className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">Certifications</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Certifications, NAICS codes, contract vehicles, and facility clearances. This section uses the same data as the staff company intake.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the API with <code className="rounded bg-muted px-1">X-Portal: true</code> to load and save. You can build the form here or ask staff to complete this section.
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
