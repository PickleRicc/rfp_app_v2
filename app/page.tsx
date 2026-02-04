"use client";

import { UploadSection } from "@/app/components/upload/upload-section";
import { Badge } from "@/app/components/ui/badge";
import { useCompany } from "@/lib/context/CompanyContext";

export default function Home() {
  const { selectedCompany } = useCompany();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            RFP Analyzer
          </h1>
          <div className="mt-3 flex items-center gap-3">
            {selectedCompany ? (
              <Badge variant="outline" className="gap-2 py-1.5">
                <span className="h-2 w-2 rounded-full bg-success" />
                Processing for: {selectedCompany.company_name}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-2 py-1.5 border-warning/50 text-warning-foreground">
                <span className="h-2 w-2 rounded-full bg-warning" />
                Select a company from the header to upload
              </Badge>
            )}
          </div>
        </div>
        <UploadSection />
      </main>
    </div>
  );
}
