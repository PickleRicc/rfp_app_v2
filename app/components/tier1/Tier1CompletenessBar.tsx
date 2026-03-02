'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Tier1Completeness } from '@/lib/supabase/company-types';

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

interface Tier1CompletenessBarProps {
  companyId: string;
  /** Optional callback to imperatively trigger a re-fetch (attach a ref if needed) */
  onRefreshRef?: (refresh: () => void) => void;
  /** Optional fetch function override for token-based access */
  fetchFn?: FetchFn;
}

interface StatusResponse {
  completeness: Tier1Completeness;
  missingFields: string[];
  isComplete: boolean;
}

/** Return Tailwind color classes based on score range. */
function getBarColor(score: number): string {
  if (score >= 80) return 'bg-success';
  if (score >= 40) return 'bg-warning';
  return 'bg-destructive';
}

function getTextColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 40) return 'text-warning-foreground';
  return 'text-destructive';
}

function getBorderColor(score: number): string {
  if (score >= 80) return 'border-success/30 bg-success/10';
  if (score >= 40) return 'border-warning/30 bg-warning/10';
  return 'border-destructive/30 bg-destructive/10';
}

/**
 * Tier1CompletenessBar
 *
 * Displays the Tier 1 Enterprise Intake completion status for a company.
 * Shows a color-coded progress bar, per-section scores, and a list of
 * missing fields when the profile is incomplete.
 */
export function Tier1CompletenessBar({ companyId, onRefreshRef, fetchFn }: Tier1CompletenessBarProps) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      setError(null);
      const doFetch = fetchFn || ((url: string, opts?: RequestInit) =>
        fetch(url, { ...opts, headers: { ...Object.fromEntries(new Headers(opts?.headers).entries()), 'X-Company-Id': companyId } }));
      const res = await doFetch('/api/company/tier1-status');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data: StatusResponse = await res.json();
      setStatus(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load completeness status';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [companyId, fetchFn]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Expose the refresh function to parent via ref callback
  useEffect(() => {
    if (onRefreshRef) {
      onRefreshRef(fetchStatus);
    }
  }, [onRefreshRef, fetchStatus]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 mb-6 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-3"></div>
        <div className="h-3 bg-muted rounded w-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 mb-6">
        <p className="text-sm text-muted-foreground">Could not load completeness status: {error}</p>
      </div>
    );
  }

  if (!status) return null;

  const { completeness, missingFields, isComplete } = status;
  const { score, sections } = completeness;

  return (
    <div className={`rounded-lg border p-4 mb-6 ${getBorderColor(score)}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Tier 1 Enterprise Intake Completeness
          </h2>
          {isComplete && (
            <p className="text-xs text-success mt-0.5">
              Tier 1 is complete — you can upload RFP documents.
            </p>
          )}
          {!isComplete && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Complete your profile to unlock RFP uploads.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isComplete ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Tier 1 Complete
            </span>
          ) : (
            <span className={`text-2xl font-bold ${getTextColor(score)}`}>{score}%</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getBarColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Section breakdown */}
      {sections.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {sections.map((section) => {
            const sectionPct = Math.round((section.score / section.maxScore) * 100);
            return (
              <div key={section.name} className="text-center">
                <div className="text-xs text-muted-foreground mb-1 leading-tight">{section.name}</div>
                <div className="text-sm font-semibold text-foreground">
                  {section.score}/{section.maxScore}
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full ${getBarColor(sectionPct)}`}
                    style={{ width: `${sectionPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Missing fields list */}
      {!isComplete && missingFields.length > 0 && (
        <div>
          <p className="text-xs font-medium text-foreground mb-2">
            To complete Tier 1, address the following:
          </p>
          <ul className="space-y-1">
            {missingFields.map((field, idx) => (
              <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="mt-0.5 text-red-400 flex-shrink-0">&#x25CF;</span>
                <span>{field}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
