"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  GitMerge,
  Layout,
  Shield,
  Upload,
  AlertCircle,
  ArrowLeft,
  Loader2,
  ClipboardCheck,
  Send,
  ScrollText,
  Sparkles,
  Users,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/context/CompanyContext";
import { makeStatusBadge } from "@/app/components/ui/status-badge";
import { Tier1TabLayout, type Tab } from "@/app/components/tier1/Tier1TabLayout";
import { DocumentClassificationTable } from "@/app/components/solicitation/DocumentClassificationTable";
import { AmendmentChainView } from "@/app/components/solicitation/AmendmentChainView";
import { ReconciliationView } from "@/app/components/solicitation/ReconciliationView";
import { TemplateFieldsPanel } from "@/app/components/solicitation/TemplateFieldsPanel";
import { ComplianceExtractionView } from "@/app/components/solicitation/ComplianceExtractionView";
import { DataCallView } from "@/app/components/datacall/DataCallView";
import { BoeView } from "@/app/components/boe/BoeView";
import { P2wView } from "@/app/components/p2w/P2wView";
import { DraftGenerationView } from "@/app/components/draft/DraftGenerationView";
import { TouchupTab } from "@/app/components/touchup/TouchupTab";
import { PipelineLogsView } from "./components/PipelineLogsView";
import type {
  SolicitationWithDocuments,
  SolicitationDocument,
  SolicitationDocumentType,
  TemplateFieldMapping,
} from "@/lib/supabase/solicitation-types";
import type { EnrichedReconciliation } from "@/app/components/solicitation/ReconciliationView";

// ============================================================
// Status badge for the solicitation pipeline status
// ============================================================

const SOL_DETAIL_STATUS: Record<string, { label: string; classes: string }> = {
  uploading:   { label: "Uploading",   classes: "bg-blue-500/15 text-blue-400" },
  classifying: { label: "Classifying", classes: "bg-amber-500/15 text-amber-400" },
  reconciling: { label: "Reconciling", classes: "bg-purple-500/15 text-purple-400" },
  extracting:  { label: "Extracting",  classes: "bg-cyan-500/15 text-cyan-400" },
  ready:       { label: "Ready",       classes: "bg-success/15 text-success" },
  failed:      { label: "Failed",      classes: "bg-destructive/15 text-destructive" },
};

const StatusBadge = makeStatusBadge(SOL_DETAIL_STATUS);

// ============================================================
// Tabs configuration
// ============================================================

const TABS: Tab[] = [
  { id: "documents", label: "Documents", icon: <FileText className="h-4 w-4" /> },
  {
    id: "reconciliation",
    label: "Reconciliation",
    icon: <GitMerge className="h-4 w-4" />,
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: <Shield className="h-4 w-4" />,
  },
  {
    id: "templates",
    label: "Templates",
    icon: <Layout className="h-4 w-4" />,
  },
  {
    id: "data-call",
    label: "Data Call",
    icon: <ClipboardCheck className="h-4 w-4" />,
  },
  {
    id: "boe",
    label: "BOE",
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: "p2w",
    label: "P2W",
    icon: <DollarSign className="h-4 w-4" />,
  },
  {
    id: "draft",
    label: "Draft",
    icon: <Send className="h-4 w-4" />,
  },
  {
    id: "touchup",
    label: "Touchup",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: "logs",
    label: "Logs",
    icon: <ScrollText className="h-4 w-4" />,
  },
];

// ============================================================
// Main solicitation detail page
// ============================================================

/**
 * Solicitation Detail Page
 *
 * Displays the reconciled state of a solicitation package through three tabs:
 * - Documents: Amendment chain + classification table with Fillable/Superseded badges
 * - Reconciliation: Superseded text with strikethrough, source badges, undo/restore
 * - Templates: Fillable template fields with type hints and auto-fill suggestions
 */
export default function SolicitationDetailPage() {
  const params = useParams();
  const solicitationId = params.id as string;
  const { selectedCompanyId } = useCompany();

  const [activeTab, setActiveTab] = useState("documents");

  // Data state
  const [solicitation, setSolicitation] = useState<SolicitationWithDocuments | null>(
    null
  );
  const [reconciliations, setReconciliations] = useState<EnrichedReconciliation[]>(
    []
  );
  const [templateFields, setTemplateFields] = useState<
    Record<string, TemplateFieldMapping[]>
  >({});

  // Loading / error state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // Data fetching
  // ============================================================

  const fetchSolicitation = useCallback(async () => {
    if (!selectedCompanyId) return;
    try {
      const headers = new Headers({ "X-Company-Id": selectedCompanyId });
      const response = await fetch(`/api/solicitations/${solicitationId}`, {
        headers,
      });
      if (!response.ok) {
        if (response.status === 404) {
          setError("Solicitation not found.");
        } else {
          setError("Failed to load solicitation.");
        }
        return;
      }
      const data = await response.json();
      setSolicitation(data.solicitation);
    } catch (err) {
      console.error("Fetch solicitation error:", err);
      setError("Network error loading solicitation.");
    }
  }, [solicitationId, selectedCompanyId]);

  const fetchReconciliations = useCallback(async () => {
    if (!selectedCompanyId) return;
    try {
      const headers = new Headers({ "X-Company-Id": selectedCompanyId });
      const response = await fetch(
        `/api/solicitations/${solicitationId}/reconciliations`,
        { headers }
      );
      if (response.ok) {
        const data = await response.json();
        setReconciliations(data.reconciliations || []);
      }
    } catch (err) {
      console.error("Fetch reconciliations error:", err);
    }
  }, [solicitationId, selectedCompanyId]);

  const fetchTemplateFields = useCallback(async (docs: SolicitationDocument[]) => {
    if (!selectedCompanyId) return;
    // For each document, fetch its template fields (only for docs with template-eligible types)
    const templateEligibleTypes: SolicitationDocumentType[] = [
      "pricing_template",
      "cdrls",
      "dd254",
      "provisions",
      "other_unclassified",
    ];
    const candidateDocs = docs.filter(
      (d) =>
        d.document_type &&
        templateEligibleTypes.includes(d.document_type as SolicitationDocumentType)
    );

    const headers = new Headers({ "X-Company-Id": selectedCompanyId });
    const results: Record<string, TemplateFieldMapping[]> = {};

    await Promise.allSettled(
      candidateDocs.map(async (doc) => {
        try {
          const response = await fetch(
            `/api/solicitations/${solicitationId}/documents/${doc.id}`,
            { headers }
          );
          if (response.ok) {
            const data = await response.json();
            const fields: TemplateFieldMapping[] = data.template_fields || [];
            if (fields.length > 0) {
              results[doc.id] = fields;
            }
          }
        } catch {
          // Non-blocking — skip this doc
        }
      })
    );

    setTemplateFields(results);
  }, [solicitationId, selectedCompanyId]);

  // Initial load
  useEffect(() => {
    if (!selectedCompanyId) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      await fetchSolicitation();
      await fetchReconciliations();
      setLoading(false);
    };

    load();
  }, [selectedCompanyId, fetchSolicitation, fetchReconciliations]);

  // Fetch template fields once we have documents
  useEffect(() => {
    if (solicitation?.documents && solicitation.documents.length > 0) {
      fetchTemplateFields(solicitation.documents);
    }
  }, [solicitation?.documents, fetchTemplateFields]);

  // ============================================================
  // Action handlers
  // ============================================================

  const handleToggleReconciliation = async (
    reconciliationId: string,
    isActive: boolean
  ) => {
    if (!selectedCompanyId) return;

    try {
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Company-Id": selectedCompanyId,
      });

      const response = await fetch(
        `/api/solicitations/${solicitationId}/reconciliations`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            reconciliation_id: reconciliationId,
            is_active: isActive,
          }),
        }
      );

      if (response.ok) {
        // Optimistically update local state
        setReconciliations((prev) =>
          prev.map((r) =>
            r.id === reconciliationId ? { ...r, is_active: isActive } : r
          )
        );
      }
    } catch (err) {
      console.error("Toggle reconciliation error:", err);
    }
  };

  const handleReclassify = async (
    docId: string,
    newType: SolicitationDocumentType
  ) => {
    if (!selectedCompanyId) return;

    try {
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Company-Id": selectedCompanyId,
      });

      const response = await fetch(
        `/api/solicitations/${solicitationId}/documents/${docId}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ document_type: newType }),
        }
      );

      if (response.ok) {
        // Update local solicitation state
        setSolicitation((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            documents: prev.documents.map((d) =>
              d.id === docId
                ? {
                    ...d,
                    document_type: newType,
                    document_type_label: newType
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase()),
                    classification_confidence: "high",
                  }
                : d
            ),
          };
        });
      }
    } catch (err) {
      console.error("Reclassify error:", err);
    }
  };

  // ============================================================
  // Render states
  // ============================================================

  if (!selectedCompanyId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-6 text-center">
          <p className="text-sm font-medium text-warning-foreground">
            No company selected. Please select a company from the header.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !solicitation) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
          <p className="text-sm font-medium text-foreground">
            {error ?? "Solicitation not found."}
          </p>
          <Link
            href="/solicitations"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary underline hover:no-underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Solicitations
          </Link>
        </div>
      </div>
    );
  }

  const documents = solicitation.documents ?? [];
  const docsWithTemplateFields = documents.filter((d) => templateFields[d.id]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Back link */}
      <Link
        href="/solicitations"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Solicitations
      </Link>

      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              {solicitation.solicitation_number}
            </h1>
            <StatusBadge status={solicitation.status} />
          </div>
          {solicitation.agency && (
            <p className="mt-1 text-sm text-muted-foreground">
              {solicitation.agency}
            </p>
          )}
          {solicitation.title && (
            <p className="mt-0.5 text-sm text-foreground">
              {solicitation.title}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {documents.length} document
            {documents.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Upload more link */}
        <Link
          href={`/solicitations/new?id=${solicitationId}`}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Upload className="h-4 w-4" />
          Upload More Documents
        </Link>
      </div>

      {/* Tabbed layout */}
      <Tier1TabLayout
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {/* ======= DOCUMENTS TAB ======= */}
        {activeTab === "documents" && (
          <div className="space-y-6">
            {/* Amendment chain view */}
            <AmendmentChainView
              documents={documents}
              reconciliations={reconciliations}
            />

            {/* Classification table with Fillable / Superseded badges */}
            <EnhancedDocumentTable
              solicitationId={solicitationId}
              documents={documents}
              templateFields={templateFields}
              onReclassify={handleReclassify}
            />
          </div>
        )}

        {/* ======= RECONCILIATION TAB ======= */}
        {activeTab === "reconciliation" && (
          <ReconciliationView
            reconciliations={reconciliations}
            documents={documents}
            onToggle={handleToggleReconciliation}
          />
        )}

        {/* ======= COMPLIANCE TAB ======= */}
        {activeTab === "compliance" && solicitation && selectedCompanyId && (
          <ComplianceExtractionView
            solicitationId={solicitation.id}
            companyId={selectedCompanyId}
          />
        )}

        {/* ======= TEMPLATES TAB ======= */}
        {activeTab === "templates" && (
          <TemplateFieldsPanel
            documents={docsWithTemplateFields}
            templateFields={templateFields}
          />
        )}

        {/* ======= DATA CALL TAB ======= */}
        {activeTab === "data-call" && solicitation && selectedCompanyId && (
          <DataCallView
            solicitationId={solicitation.id}
            companyId={selectedCompanyId}
          />
        )}

        {/* ======= BOE TAB ======= */}
        {activeTab === "boe" && solicitation && selectedCompanyId && (
          <BoeView
            solicitationId={solicitation.id}
            companyId={selectedCompanyId}
          />
        )}

        {/* ======= P2W TAB ======= */}
        {activeTab === "p2w" && solicitation && selectedCompanyId && (
          <P2wView
            solicitationId={solicitation.id}
            companyId={selectedCompanyId}
          />
        )}

        {/* ======= DRAFT TAB ======= */}
        {activeTab === "draft" && selectedCompanyId && (
          <DraftGenerationView
            solicitationId={solicitationId}
            companyId={selectedCompanyId}
            onTabChange={setActiveTab}
          />
        )}

        {/* ======= TOUCHUP TAB ======= */}
        {activeTab === "touchup" && selectedCompanyId && (
          <TouchupTab
            solicitationId={solicitationId}
            companyId={selectedCompanyId}
          />
        )}

        {/* ======= LOGS TAB ======= */}
        {activeTab === "logs" && solicitation && (
          <PipelineLogsView solicitationId={solicitation.id} />
        )}
      </Tier1TabLayout>
    </div>
  );
}

// ============================================================
// EnhancedDocumentTable — wraps DocumentClassificationTable
// with Fillable and Superseded badges overlaid
// ============================================================

interface EnhancedDocumentTableProps {
  solicitationId: string;
  documents: SolicitationDocument[];
  templateFields: Record<string, TemplateFieldMapping[]>;
  onReclassify: (docId: string, newType: SolicitationDocumentType) => void;
}

/**
 * Wraps DocumentClassificationTable adding:
 * - "Fillable" badge next to documents with template_field_mappings
 * - "Superseded" badge on documents where is_superseded=true
 *
 * Per user decision: "Fillable templates highlighted in document list with a 'Fillable' badge"
 */
function EnhancedDocumentTable({
  solicitationId,
  documents,
  templateFields,
  onReclassify,
}: EnhancedDocumentTableProps) {
  const fillableDocIds = new Set(Object.keys(templateFields));
  const supersededDocIds = new Set(
    documents.filter((d) => d.is_superseded).map((d) => d.id)
  );

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Badge legend */}
      {(fillableDocIds.size > 0 || supersededDocIds.size > 0) && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {fillableDocIds.size > 0 && (
            <span className="flex items-center gap-1">
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                Fillable
              </span>
              = has template fields
            </span>
          )}
          {supersededDocIds.size > 0 && (
            <span className="flex items-center gap-1">
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 line-through">
                Superseded
              </span>
              = replaced by later amendment
            </span>
          )}
        </div>
      )}

      {/* Annotated document list */}
      <div className="space-y-1.5">
        {/* Badges strip above the classification table */}
        {(fillableDocIds.size > 0 || supersededDocIds.size > 0) && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Filename
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Tags
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {documents
                    .filter(
                      (d) =>
                        fillableDocIds.has(d.id) || supersededDocIds.has(d.id)
                    )
                    .map((doc) => (
                      <tr key={doc.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2">
                          <span
                            className="block max-w-[300px] truncate text-sm font-medium text-foreground"
                            title={doc.filename}
                          >
                            {doc.filename}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {fillableDocIds.has(doc.id) && (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                                Fillable
                              </span>
                            )}
                            {supersededDocIds.has(doc.id) && (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 line-through">
                                Superseded
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Full classification table */}
      <DocumentClassificationTable
        solicitationId={solicitationId}
        documents={documents}
        onReclassify={onReclassify}
      />
    </div>
  );
}
