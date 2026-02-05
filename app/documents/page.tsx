"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/context/CompanyContext";
import { StatCard } from "@/app/components/dashboard/stat-card";
import { FileText, BarChart3, FileCheck, Loader2, Eye, Sparkles, MoreHorizontal, Search, Filter } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type DocumentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "generating_proposal"
  | "proposal_ready";
type DocumentType = "rfp" | "proposal" | "contract" | "other" | "unknown";

interface Document {
  id: string;
  filename: string;
  document_type: DocumentType;
  status: DocumentStatus;
  file_size: number;
  created_at: string;
  updated_at: string;
  client_status?: string | null;
}

const CLIENT_STATUS_OPTIONS = [
  "Pending",
  "Submitted",
  "Under review",
  "In progress",
  "Ready for review",
  "Complete",
];

/** High-contrast colors for client status (portal + staff). */
const CLIENT_STATUS_STYLES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  Pending: {
    bg: "bg-slate-100 dark:bg-slate-800/60",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-300 dark:border-slate-600",
  },
  Submitted: {
    bg: "bg-blue-100 dark:bg-blue-900/50",
    text: "text-blue-800 dark:text-blue-200",
    border: "border-blue-400 dark:border-blue-600",
  },
  "Under review": {
    bg: "bg-amber-100 dark:bg-amber-900/50",
    text: "text-amber-800 dark:text-amber-200",
    border: "border-amber-400 dark:border-amber-600",
  },
  "In progress": {
    bg: "bg-primary/15 dark:bg-primary/25",
    text: "text-primary dark:text-primary",
    border: "border-primary/50 dark:border-primary/60",
  },
  "Ready for review": {
    bg: "bg-violet-100 dark:bg-violet-900/50",
    text: "text-violet-800 dark:text-violet-200",
    border: "border-violet-400 dark:border-violet-600",
  },
  Complete: {
    bg: "bg-emerald-100 dark:bg-emerald-900/50",
    text: "text-emerald-800 dark:text-emerald-200",
    border: "border-emerald-400 dark:border-emerald-600",
  },
};

function getClientStatusStyle(status: string | null | undefined) {
  return CLIENT_STATUS_STYLES[status ?? "Pending"] ?? CLIENT_STATUS_STYLES["Pending"];
}

/** High-contrast pipeline status colors so they stand out from each other. */
const statusStyles: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  completed: {
    bg: "bg-emerald-100 dark:bg-emerald-900/50",
    text: "text-emerald-800 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  proposal_ready: {
    bg: "bg-emerald-100 dark:bg-emerald-900/50",
    text: "text-emerald-800 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  pending: {
    bg: "bg-amber-100 dark:bg-amber-900/50",
    text: "text-amber-800 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  processing: {
    bg: "bg-blue-100 dark:bg-blue-900/50",
    text: "text-blue-800 dark:text-blue-200",
    dot: "bg-blue-500",
  },
  generating_proposal: {
    bg: "bg-primary/15 dark:bg-primary/25",
    text: "text-primary dark:text-primary",
    dot: "bg-primary",
  },
  failed: {
    bg: "bg-red-100 dark:bg-red-900/50",
    text: "text-red-800 dark:text-red-200",
    dot: "bg-red-500",
  },
};

const statusLabels: Record<DocumentStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  generating_proposal: "Generating",
  proposal_ready: "Proposal Ready",
};

const typeLabels: Record<DocumentType, string> = {
  rfp: "RFP",
  proposal: "Proposal",
  contract: "Contract",
  other: "Other",
  unknown: "Unknown",
};

export default function DocumentsPage() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<DocumentType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<DocumentStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [generatingProposals, setGeneratingProposals] = useState<Set<string>>(new Set());
  const [updatingClientStatus, setUpdatingClientStatus] = useState<Set<string>>(new Set());
  const documentsRef = useRef<Document[]>([]);
  documentsRef.current = documents;

  const updateClientStatus = async (documentId: string, client_status: string) => {
    setUpdatingClientStatus((s) => new Set(s).add(documentId));
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_status: client_status || null }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setDocuments((prev) =>
        prev.map((d) => (d.id === documentId ? { ...d, client_status: client_status || null } : d))
      );
    } catch {
      // keep previous state on error
    } finally {
      setUpdatingClientStatus((s) => {
        const next = new Set(s);
        next.delete(documentId);
        return next;
      });
    }
  };

  useEffect(() => {
    if (!selectedCompanyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const headers = new Headers();
        headers.set("X-Company-Id", selectedCompanyId);
        const response = await fetch("/api/documents", { headers });
        if (!response.ok) throw new Error("Failed to fetch documents");
        const data = await response.json();
        if (!cancelled) {
          setDocuments(data.documents || []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load documents");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    const interval = setInterval(() => {
      const hasProcessing = documentsRef.current.some(
        (d) => d.status === "processing" || d.status === "generating_proposal"
      );
      if (hasProcessing) load();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedCompanyId]);

  const fetchDocuments = async () => {
    if (!selectedCompanyId) return;
    try {
      const headers = new Headers();
      headers.set("X-Company-Id", selectedCompanyId);
      const response = await fetch("/api/documents", { headers });
      if (!response.ok) throw new Error("Failed to fetch documents");
      const data = await response.json();
      setDocuments(data.documents || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateProposal = async (documentId: string) => {
    setGeneratingProposals((prev) => new Set(prev).add(documentId));
    try {
      const response = await fetch("/api/generate-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start proposal generation");
      }
      await fetchDocuments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate proposal");
      setGeneratingProposals((prev) => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || doc.document_type === filterType;
    const matchesStatus = filterStatus === "all" || doc.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-64">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Documents
              </h1>
              <p className="mt-1 text-muted-foreground">
                View and manage all your uploaded documents, analyses, and proposals
              </p>
            </div>
            {selectedCompany && (
              <div className="rounded-lg border border-border bg-card px-4 py-2">
                <p className="text-xs text-muted-foreground">Viewing documents for</p>
                <p className="text-sm font-semibold text-foreground">
                  {selectedCompany.company_name}
                </p>
              </div>
            )}
          </div>
        </div>

        {!selectedCompany && (
          <div className="mb-8 rounded-xl border border-warning/30 bg-warning/5 p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">No Company Selected</h2>
            <p className="text-muted-foreground mb-4">
              Please select a company from the header above to view its documents.
            </p>
            <Button asChild>
              <Link href="/companies">Manage Companies</Link>
            </Button>
          </div>
        )}

        {selectedCompany && (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Documents"
                value={documents.length}
                icon={FileText}
                variant="primary"
              />
              <StatCard
                title="RFPs Analyzed"
                value={documents.filter((d) => d.document_type === "rfp" && d.status === "completed").length}
                icon={BarChart3}
                variant="success"
              />
              <StatCard
                title="Proposals Ready"
                value={documents.filter((d) => d.status === "proposal_ready").length}
                icon={FileCheck}
                variant="warning"
              />
              <StatCard
                title="Processing"
                value={documents.filter((d) => d.status === "processing" || d.status === "generating_proposal").length}
                icon={Loader2}
                variant="default"
              />
            </div>

            {error && (
              <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                <p className="text-destructive">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search documents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={filterType} onValueChange={(v) => setFilterType(v as DocumentType | "all")}>
                      <SelectTrigger className="w-[140px]">
                        <Filter className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="rfp">RFP</SelectItem>
                        <SelectItem value="proposal">Proposal</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as DocumentStatus | "all")}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="generating_proposal">Generating</SelectItem>
                        <SelectItem value="proposal_ready">Proposal Ready</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button asChild className="gap-2">
                  <Link href="/">
                    <Sparkles className="h-4 w-4" />
                    Upload New Document
                  </Link>
                </Button>
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Document
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Type
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Status
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Client status
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Size
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Uploaded
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredDocuments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                            No documents found. Upload your first document from the home page.
                          </td>
                        </tr>
                      ) : (
                        filteredDocuments.map((doc) => {
                          const style = statusStyles[doc.status] ?? statusStyles.pending;
                          return (
                            <tr
                              key={doc.id}
                              className="group transition-colors hover:bg-muted/30"
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                    <FileText className="h-5 w-5 text-primary" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-foreground line-clamp-1">
                                      {doc.filename}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {doc.id.slice(0, 8)}...
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <Badge variant="secondary" className="font-medium">
                                  {typeLabels[doc.document_type]}
                                </Badge>
                              </td>
                              <td className="px-6 py-4">
                                <div
                                  className={cn(
                                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                                    style.bg,
                                    style.text
                                  )}
                                >
                                  <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                                  {statusLabels[doc.status]}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <Select
                                  value={doc.client_status || "Pending"}
                                  onValueChange={(v) => updateClientStatus(doc.id, v)}
                                  disabled={updatingClientStatus.has(doc.id)}
                                >
                                  <SelectTrigger
                                    className={cn(
                                      "w-[160px] h-9 text-xs font-medium border",
                                      getClientStatusStyle(doc.client_status).bg,
                                      getClientStatusStyle(doc.client_status).text,
                                      getClientStatusStyle(doc.client_status).border
                                    )}
                                  >
                                    <SelectValue placeholder="Portal status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CLIENT_STATUS_OPTIONS.map((opt) => (
                                      <SelectItem key={opt} value={opt} className="text-xs">
                                        {opt}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-6 py-4 text-sm text-muted-foreground">
                                {formatFileSize(doc.file_size)}
                              </td>
                              <td className="px-6 py-4 text-sm text-muted-foreground">
                                {formatDate(doc.created_at)}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  {(doc.status === "completed" ||
                                    doc.status === "generating_proposal" ||
                                    doc.status === "proposal_ready") && (
                                    <Button asChild variant="outline" size="sm" className="gap-1.5 bg-transparent">
                                      <Link href={`/results/${doc.id}`}>
                                        <Eye className="h-3.5 w-3.5" />
                                        View Analysis
                                      </Link>
                                    </Button>
                                  )}
                                  {doc.status === "completed" && doc.document_type === "rfp" && (
                                    <Button
                                      size="sm"
                                      className="gap-1.5"
                                      disabled={generatingProposals.has(doc.id)}
                                      onClick={() => handleGenerateProposal(doc.id)}
                                    >
                                      <Sparkles className="h-3.5 w-3.5" />
                                      {generatingProposals.has(doc.id) ? "Starting..." : "Generate Proposal"}
                                    </Button>
                                  )}
                                  {doc.status === "proposal_ready" && (
                                    <Button asChild size="sm" className="gap-1.5">
                                      <Link href={`/proposals/${doc.id}`}>
                                        <FileCheck className="h-3.5 w-3.5" />
                                        View Proposal
                                      </Link>
                                    </Button>
                                  )}
                                  {(doc.status === "processing" || doc.status === "generating_proposal") && (
                                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                      Processing...
                                    </span>
                                  )}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem>Download</DropdownMenuItem>
                                      <DropdownMenuItem className="text-destructive">
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
