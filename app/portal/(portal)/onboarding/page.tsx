"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  FileCheck,
  Target,
  BarChart3,
  Users,
  Sparkles,
  FileText,
  ClipboardList,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import { fetchWithPortal } from "@/lib/hooks/useFetchWithPortal";

interface CompletenessScore {
  core_information: number;
  certifications: number;
  capabilities: number;
  past_performance: number;
  personnel: number;
  differentiators: number;
  total: number;
}

export default function PortalOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [completeness, setCompleteness] = useState<CompletenessScore | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchWithPortal("/api/company/status");
        if (!res.ok) {
          setError("Failed to load status");
          return;
        }
        const data = await res.json();
        setHasProfile(data.hasProfile);
        setCompleteness(data.completeness);
      } catch {
        setError("Failed to load status");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Loading onboarding status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-destructive">{error}</p>
        <Link href="/portal" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!hasProfile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Onboarding</h1>
          <p className="text-muted-foreground mt-1">
            Complete your company profile so we can tailor proposals for you.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-8">
          <h2 className="text-xl font-bold text-foreground mb-4">Get started</h2>
          <p className="text-muted-foreground mb-6">
            Start with your company profile. You can complete the rest in any order.
          </p>
          <div className="rounded-xl border border-callout-border bg-callout p-6 mb-6">
            <h3 className="font-semibold text-foreground mb-3">Sections</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Company profile (basics and contacts)</li>
              <li>Certifications & set-asides</li>
              <li>Capabilities</li>
              <li>Past performance</li>
              <li>Personnel</li>
              <li>Differentiators</li>
              <li>Boilerplate library</li>
            </ol>
          </div>
          <button
            onClick={() => router.push("/portal/onboarding/profile")}
            className="rounded-md bg-primary px-8 py-3 text-lg font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Start with company profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Onboarding</h1>
        <p className="text-muted-foreground mt-1">
          Complete and update your company information for proposal generation.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-foreground">Profile completeness</h2>
          <CompletionBadge score={completeness?.total ?? 0} />
        </div>
        <div className="mb-6">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Overall progress</span>
            <span>{completeness?.total ?? 0}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-4">
            <div
              className={`h-4 rounded-full ${getProgressColor(completeness?.total ?? 0)}`}
              style={{ width: `${completeness?.total ?? 0}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <ScoreCard title="Core" score={completeness?.core_information ?? 0} max={25} />
          <ScoreCard title="Certifications" score={completeness?.certifications ?? 0} max={10} />
          <ScoreCard title="Capabilities" score={completeness?.capabilities ?? 0} max={15} />
          <ScoreCard title="Past performance" score={completeness?.past_performance ?? 0} max={20} />
          <ScoreCard title="Personnel" score={completeness?.personnel ?? 0} max={20} />
          <ScoreCard title="Differentiators" score={completeness?.differentiators ?? 0} max={10} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ActionCard
          icon={Building2}
          title="Company profile"
          description="Core details and contacts"
          href="/portal/onboarding/profile"
        />
        <ActionCard
          icon={FileCheck}
          title="Certifications"
          description="Set-asides and NAICS"
          href="/portal/onboarding/certifications"
        />
        <ActionCard
          icon={Target}
          title="Capabilities"
          description="Services and tools"
          href="/portal/onboarding/capabilities"
        />
        <ActionCard
          icon={BarChart3}
          title="Past performance"
          description="Contract history"
          href="/portal/onboarding/past-performance"
        />
        <ActionCard
          icon={Users}
          title="Personnel"
          description="Key team members"
          href="/portal/onboarding/personnel"
        />
        <ActionCard
          icon={Sparkles}
          title="Differentiators"
          description="Win themes"
          href="/portal/onboarding/differentiators"
        />
        <ActionCard
          icon={FileText}
          title="Boilerplate"
          description="Reusable text"
          href="/portal/onboarding/boilerplate"
        />
      </div>

      <Link
        href="/portal"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <LayoutDashboard className="h-4 w-4" />
        Back to dashboard
      </Link>
    </div>
  );
}

function CompletionBadge({ score }: { score: number }) {
  if (score >= 71) {
    return (
      <span className="rounded-full bg-success/10 px-3 py-1.5 text-sm font-semibold text-success">
        Good
      </span>
    );
  }
  if (score >= 41) {
    return (
      <span className="rounded-full bg-warning/10 px-3 py-1.5 text-sm font-semibold text-warning-foreground">
        Basic
      </span>
    );
  }
  return (
    <span className="rounded-full bg-destructive/10 px-3 py-1.5 text-sm font-semibold text-destructive">
      Incomplete
    </span>
  );
}

function getProgressColor(score: number): string {
  if (score >= 71) return "bg-success";
  if (score >= 41) return "bg-warning";
  return "bg-destructive";
}

function ScoreCard({ title, score, max }: { title: string; score: number; max: number }) {
  const pct = max ? (score / max) * 100 : 0;
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground mb-1">{title}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold text-foreground">{score}</span>
        <span className="text-muted-foreground">/ {max}</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 mt-1">
        <div
          className={`h-1.5 rounded-full ${getProgressColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-card p-6 text-left block transition-shadow hover:shadow-md"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </Link>
  );
}
