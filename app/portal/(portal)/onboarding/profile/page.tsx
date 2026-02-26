"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchWithPortal } from "@/lib/hooks/useFetchWithPortal";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { ArrowLeft } from "lucide-react";

const defaultForm = {
  company_name: "",
  legal_name: "",
  cage_code: "",
  uei_number: "",
  sam_status: "Active" as string,
  sam_expiration: "",
  year_founded: new Date().getFullYear(),
  website: "",
  employee_count: 1,
  elevator_pitch: "",
  proposal_poc: { name: "", title: "", email: "", phone: "" },
  headquarters_address: {
    street: "",
    suite: "",
    city: "",
    state: "",
    zip: "",
    country: "USA",
  },
};

export default function PortalOnboardingProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchWithPortal("/api/company/profile");
        const data = await res.json();
        if (data.profile) {
          const p = data.profile;
          setFormData({
            company_name: p.company_name ?? "",
            legal_name: p.legal_name ?? "",
            cage_code: p.cage_code ?? "",
            uei_number: p.uei_number ?? "",
            sam_status: p.sam_status ?? "Active",
            sam_expiration: p.sam_expiration ?? "",
            year_founded: p.year_founded ?? new Date().getFullYear(),
            website: p.website ?? "",
            employee_count: p.employee_count ?? 1,
            elevator_pitch: p.elevator_pitch ?? "",
            proposal_poc: p.proposal_poc ?? defaultForm.proposal_poc,
            headquarters_address: p.headquarters_address ?? defaultForm.headquarters_address,
          });
        }
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithPortal("/api/company/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to save");
      router.push("/portal/onboarding");
    } catch {
      setError("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/portal/onboarding"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to onboarding
      </Link>
      <h1 className="text-2xl font-bold text-foreground">Company profile</h1>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Identity</h2>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Company name *</label>
            <Input
              required
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              placeholder="Acme Federal Solutions, LLC"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Legal name *</label>
            <Input
              required
              value={formData.legal_name}
              onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
              placeholder="If different from company name"
            />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Registration</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">CAGE code *</label>
              <Input
                required
                maxLength={5}
                value={formData.cage_code}
                onChange={(e) => setFormData({ ...formData, cage_code: e.target.value.toUpperCase() })}
                placeholder="1ABC2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">UEI number *</label>
              <Input
                required
                maxLength={12}
                value={formData.uei_number}
                onChange={(e) => setFormData({ ...formData, uei_number: e.target.value.toUpperCase() })}
                placeholder="12 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">SAM status *</label>
              <select
                required
                value={formData.sam_status}
                onChange={(e) => setFormData({ ...formData, sam_status: e.target.value as "Active" | "Pending" | "Expired" | "Not Registered" })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Expired">Expired</option>
                <option value="Not Registered">Not Registered</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">SAM expiration *</label>
              <Input
                type="date"
                required
                value={formData.sam_expiration}
                onChange={(e) => setFormData({ ...formData, sam_expiration: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Year founded *</label>
              <Input
                type="number"
                required
                min={1900}
                max={new Date().getFullYear()}
                value={formData.year_founded}
                onChange={(e) => setFormData({ ...formData, year_founded: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Employee count</label>
              <Input
                type="number"
                min={1}
                value={formData.employee_count}
                onChange={(e) => setFormData({ ...formData, employee_count: parseInt(e.target.value, 10) || 1 })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Website</label>
            <Input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Elevator pitch</label>
            <textarea
              value={formData.elevator_pitch}
              onChange={(e) => setFormData({ ...formData, elevator_pitch: e.target.value })}
              placeholder="Short description of your company"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              rows={3}
            />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Proposal point of contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
              <Input
                value={formData.proposal_poc.name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    proposal_poc: { ...formData.proposal_poc, name: e.target.value },
                  })
                }
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Title</label>
              <Input
                value={formData.proposal_poc.title}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    proposal_poc: { ...formData.proposal_poc, title: e.target.value },
                  })
                }
                placeholder="Job title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email *</label>
              <Input
                type="email"
                value={formData.proposal_poc.email}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    proposal_poc: { ...formData.proposal_poc, email: e.target.value },
                  })
                }
                placeholder="email@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
              <Input
                type="tel"
                value={formData.proposal_poc.phone}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    proposal_poc: { ...formData.proposal_poc, phone: e.target.value },
                  })
                }
                placeholder="(555) 000-0000"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save profile"}
          </Button>
          <Link href="/portal/onboarding">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
