"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCompany } from "@/lib/context/CompanyContext";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { Building2, ChevronRight, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CompaniesListPage() {
  const router = useRouter();
  const { companies, selectCompany, selectedCompanyId } = useCompany();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCompanies = companies.filter(
    (company) =>
      company.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.cage_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.uei_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectAndView = (companyId: string) => {
    selectCompany(companyId);
    router.push("/company");
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              All Companies
            </h1>
            <p className="mt-1 text-muted-foreground">
              Manage and switch between your registered companies
            </p>
          </div>
          <Button className="gap-2" onClick={() => router.push("/company?newIntake=1")}>
            <Plus className="h-4 w-4" />
            Add Company
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search companies by name, CAGE, or UEI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {filteredCompanies.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-muted">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {companies.length === 0 ? "No Companies Yet" : "No Matching Companies"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {companies.length === 0
                ? "Get started by creating your first company profile"
                : "Try adjusting your search criteria"}
            </p>
            {companies.length === 0 && (
              <Button onClick={() => router.push("/company?newIntake=1")} className="gap-2">
                <Plus className="h-4 w-4" />
                Create First Company
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCompanies.map((company) => (
              <div
                key={company.id}
                className={cn(
                  "group overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-md cursor-pointer",
                  selectedCompanyId === company.id && "ring-2 ring-primary/30"
                )}
                onClick={() => handleSelectAndView(company.id)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <Badge
                      variant={company.completeness_score >= 70 ? "default" : "secondary"}
                    >
                      {company.completeness_score >= 90
                        ? "Complete"
                        : company.completeness_score >= 70
                        ? "Good"
                        : "Setup"}
                    </Badge>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    {company.company_name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    CAGE: {company.cage_code}
                  </p>
                  <div className="mt-4 flex items-center gap-4 border-t border-border pt-4">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <span>{company.completeness_score}% complete</span>
                    </div>
                    <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {searchQuery && filteredCompanies.length > 0 && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Showing {filteredCompanies.length} of {companies.length} companies
          </div>
        )}
      </main>
    </div>
  );
}
