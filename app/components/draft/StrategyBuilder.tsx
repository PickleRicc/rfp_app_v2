"use client";

import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  AlertCircle,
  GripVertical,
  Plus,
  Trash2,
  Zap,
  ArrowLeft,
  Building2,
  Target,
  FileText,
  ShieldAlert,
  BarChart3,
  Lock,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  SolicitationStrategy,
  VolumeStrategy,
  VolumeDiagramRequest,
  RiskPosture,
  StrategyGetResponse,
} from "@/lib/supabase/strategy-types";
import type { DiagramType } from "@/lib/generation/exhibits/diagram-types";

// ============================================================
// Constants
// ============================================================

const RISK_POSTURE_OPTIONS: { value: RiskPosture; label: string; description: string }[] = [
  {
    value: "aggressive",
    label: "Aggressive",
    description: "Bold claims, push win themes hard, lead with metrics",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Factual and professional — default for most bids",
  },
  {
    value: "conservative",
    label: "Conservative",
    description: "Compliance-first, let facts speak, minimal claims",
  },
];

// ============================================================
// Types
// ============================================================

export type GraphicsProfile = "minimal" | "standard";

export interface StrategyBuilderProps {
  solicitationId: string;
  companyId: string;
  onGenerationStarted: (graphicsProfile: GraphicsProfile) => void;
  onTabChange?: (tabId: string) => void;
}

// ============================================================
// Section card wrapper (matches StrategyConfirmation style)
// ============================================================

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-border bg-muted/30 px-5 py-3.5">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ============================================================
// Drag-and-drop win theme list
// ============================================================

function WinThemeList({
  themes,
  onChange,
}: {
  themes: string[];
  onChange: (themes: string[]) => void;
}) {
  const [newTheme, setNewTheme] = useState("");
  const dragIndex = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragIndex.current = index;
  };

  const handleDrop = (dropIndex: number) => {
    if (dragIndex.current === null || dragIndex.current === dropIndex) return;
    const updated = [...themes];
    const [moved] = updated.splice(dragIndex.current, 1);
    updated.splice(dropIndex, 0, moved);
    onChange(updated);
    dragIndex.current = null;
  };

  const remove = (index: number) =>
    onChange(themes.filter((_, i) => i !== index));

  const add = () => {
    if (!newTheme.trim()) return;
    onChange([...themes, newTheme.trim()]);
    setNewTheme("");
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Drag to reorder — index 1 is highest priority. These are injected into every volume
        prompt in this order.
      </p>

      <div className="space-y-1.5">
        {themes.map((theme, i) => (
          <div
            key={i}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(i)}
            className="flex cursor-grab items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm active:cursor-grabbing"
          >
            <GripVertical size={14} className="shrink-0 text-muted-foreground" />
            <span className="w-5 shrink-0 text-xs font-semibold text-muted-foreground">
              {i + 1}.
            </span>
            <span className="flex-1 text-foreground">{theme}</span>
            <button
              onClick={() => remove(i)}
              className="ml-auto rounded p-0.5 text-muted-foreground hover:text-destructive"
              aria-label="Remove theme"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {themes.length === 0 && (
        <p className="text-xs italic text-muted-foreground">No win themes added yet.</p>
      )}

      {/* Add new theme */}
      <div className="flex gap-2 pt-1">
        <input
          type="text"
          value={newTheme}
          onChange={(e) => setNewTheme(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a win theme…"
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={add}
          disabled={!newTheme.trim()}
          className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Diagram type metadata
// ============================================================

const DIAGRAM_TYPE_META: Record<DiagramType, { label: string; description: string }> = {
  'org-chart': { label: 'Org Chart', description: 'Team hierarchy' },
  'gantt': { label: 'Timeline', description: 'Project schedule' },
  'process-flow': { label: 'Process Flow', description: 'Workflow diagram' },
  'bar-chart': { label: 'Bar Chart', description: 'Data comparison' },
  'raci-matrix': { label: 'RACI Matrix', description: 'Responsibility matrix' },
  'network-diagram': { label: 'Network Diagram', description: 'System architecture' },
  'radar-chart': { label: 'Radar Chart', description: 'Capability assessment' },
  'swimlane': { label: 'Swimlane', description: 'Cross-functional process' },
  'data-table': { label: 'Data Table', description: 'Formatted data table' },
  'comparison-table': { label: 'Comparison Table', description: 'Side-by-side comparison' },
  'milestone-timeline': { label: 'Milestone Timeline', description: 'Key dates and phases' },
  'heat-map': { label: 'Heat Map', description: 'Intensity matrix' },
  'quadrant-chart': { label: 'Quadrant Chart', description: '2x2 analysis matrix' },
  'capability-matrix': { label: 'Capability Matrix', description: 'Skills/capability levels' },
};

const ALL_DIAGRAM_TYPES = Object.keys(DIAGRAM_TYPE_META) as DiagramType[];

// ============================================================
// Volume diagram selector
// ============================================================

function VolumeDiagramSelector({
  diagramRequests,
  onChange,
  rfpRequiredTypes,
  volumeName,
}: {
  diagramRequests: VolumeDiagramRequest[];
  onChange: (updated: VolumeDiagramRequest[]) => void;
  rfpRequiredTypes?: VolumeDiagramRequest[];
  volumeName: string;
}) {
  const [showDropdown, setShowDropdown] = useState(false);

  const addDiagram = (type: DiagramType) => {
    const newReq: VolumeDiagramRequest = {
      type,
      title: '', // Left empty — AI will generate a specific title during generation
      placement_section: '', // Left empty — AI will determine best section from volume content
    };
    onChange([...diagramRequests, newReq]);
    setShowDropdown(false);
  };

  const removeDiagram = (index: number) => {
    onChange(diagramRequests.filter((_, i) => i !== index));
  };

  const updateDiagram = (index: number, field: keyof VolumeDiagramRequest, value: string) => {
    onChange(
      diagramRequests.map((d, i) =>
        i === index ? { ...d, [field]: value } : d
      )
    );
  };

  const rfpRequired = rfpRequiredTypes || [];

  return (
    <div className="space-y-2 border-t border-border pt-3 mt-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <BarChart3 size={13} className="text-muted-foreground" />
          Volume Diagrams
        </label>
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs text-foreground hover:bg-muted/70"
          >
            <Plus size={12} /> Add Diagram <ChevronDown size={11} />
          </button>
          {showDropdown && (
            <div className="absolute right-0 top-full z-20 mt-1 w-64 max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
              {ALL_DIAGRAM_TYPES.map((type) => {
                const meta = DIAGRAM_TYPE_META[type];
                return (
                  <button
                    key={type}
                    onClick={() => addDiagram(type)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/50"
                  >
                    <span className="mt-0.5 text-xs font-semibold text-foreground">
                      {meta.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {meta.description}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RFP-required diagrams (locked) */}
      {rfpRequired.map((req, i) => (
        <div
          key={`rfp-${i}`}
          className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
        >
          <Lock size={12} className="shrink-0 text-amber-600" />
          <span className="text-xs font-semibold text-amber-800">
            {DIAGRAM_TYPE_META[req.type]?.label ?? req.type}
          </span>
          <span className="flex-1 truncate text-xs text-amber-700">
            {req.title}
          </span>
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-800">
            Required by RFP
          </span>
        </div>
      ))}

      {/* PM-added diagram requests */}
      {diagramRequests.map((req, i) => {
        const meta = DIAGRAM_TYPE_META[req.type];
        return (
          <div
            key={i}
            className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
          >
            <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
              {meta?.label ?? req.type}
            </span>
            <input
              type="text"
              value={req.title}
              onChange={(e) => updateDiagram(i, 'title', e.target.value)}
              placeholder="Auto-generated from content (or type a custom title)"
              className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="text"
              value={req.placement_section}
              onChange={(e) => updateDiagram(i, 'placement_section', e.target.value)}
              placeholder="Auto-placed (or type section name)"
              className="w-44 rounded border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => removeDiagram(i)}
              className="rounded p-0.5 text-muted-foreground hover:text-destructive"
              aria-label="Remove diagram"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}

      {rfpRequired.length === 0 && diagramRequests.length === 0 && (
        <p className="text-xs italic text-muted-foreground">
          No diagrams configured. Click &quot;+ Add Diagram&quot; to include visual exhibits in this volume.
        </p>
      )}
    </div>
  );
}

// ============================================================
// Volume strategy card
// ============================================================

function VolumeStrategyCard({
  volumeStrategy,
  onChange,
  smeOwnerOptions,
}: {
  volumeStrategy: VolumeStrategy;
  onChange: (updated: VolumeStrategy) => void;
  smeOwnerOptions: string[];
}) {
  const [newEmphasis, setNewEmphasis] = useState("");

  const addEmphasis = () => {
    if (!newEmphasis.trim()) return;
    onChange({
      ...volumeStrategy,
      emphasis_areas: [...(volumeStrategy.emphasis_areas ?? []), newEmphasis.trim()],
    });
    setNewEmphasis("");
  };

  const removeEmphasis = (index: number) =>
    onChange({
      ...volumeStrategy,
      emphasis_areas: volumeStrategy.emphasis_areas.filter((_, i) => i !== index),
    });

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-4">
      <p className="text-sm font-semibold text-foreground">{volumeStrategy.volume_name}</p>

      {/* Approach notes */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">
          Approach Notes
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            (PM instructions to the writer)
          </span>
        </label>
        <textarea
          value={volumeStrategy.approach_notes}
          onChange={(e) =>
            onChange({ ...volumeStrategy, approach_notes: e.target.value })
          }
          placeholder="e.g. Lead with JWCC contract vehicle. Emphasize FedRAMP High authorization. Address incumbent's known weak spot on transition."
          rows={3}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Emphasis areas */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Emphasis Areas</label>
        <div className="flex flex-wrap gap-1.5">
          {(volumeStrategy.emphasis_areas ?? []).map((area, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700"
            >
              {area}
              <button
                onClick={() => removeEmphasis(i)}
                className="ml-0.5 rounded-full hover:text-red-500"
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newEmphasis}
            onChange={(e) => setNewEmphasis(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEmphasis()}
            placeholder="Add emphasis area…"
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addEmphasis}
            disabled={!newEmphasis.trim()}
            className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground hover:bg-muted/70 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {/* SME owner */}
      {smeOwnerOptions.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">SME Owner</label>
          <select
            value={volumeStrategy.sme_owner ?? ""}
            onChange={(e) =>
              onChange({ ...volumeStrategy, sme_owner: e.target.value || undefined })
            }
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Unassigned</option>
            {smeOwnerOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Volume Diagrams */}
      <VolumeDiagramSelector
        diagramRequests={volumeStrategy.diagram_requests ?? []}
        onChange={(updated) =>
          onChange({ ...volumeStrategy, diagram_requests: updated })
        }
        volumeName={volumeStrategy.volume_name}
      />
    </div>
  );
}

// ============================================================
// Main StrategyBuilder component
// ============================================================

export function StrategyBuilder({
  solicitationId,
  companyId,
  onGenerationStarted,
  onTabChange,
}: StrategyBuilderProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [winThemes, setWinThemes] = useState<string[]>([]);
  const [agencyIntel, setAgencyIntel] = useState("");
  const [competitiveNotes, setCompetitiveNotes] = useState("");
  const [riskPosture, setRiskPosture] = useState<RiskPosture>("balanced");
  const [volumeStrategies, setVolumeStrategies] = useState<VolumeStrategy[]>([]);
  const [graphicsProfile, setGraphicsProfile] = useState<GraphicsProfile>("minimal");
  const [smeOwnerOptions, setSmeOwnerOptions] = useState<string[]>([]);

  const headers = {
    "Content-Type": "application/json",
    "X-Company-Id": companyId,
  };

  // ─── Load existing strategy + volume list ──────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [strategyRes, smeRes] = await Promise.all([
          fetch(`/api/solicitations/${solicitationId}/strategy`, {
            headers: { "X-Company-Id": companyId },
          }),
          fetch(
            `/api/solicitations/${solicitationId}/sme-contributions?approved_only=false`,
            { headers: { "X-Company-Id": companyId } }
          ),
        ]);

        if (!strategyRes.ok) throw new Error("Failed to load strategy data");
        const strategyData: StrategyGetResponse = await strategyRes.json();

        // Populate SME owner options from existing contributions
        if (smeRes.ok) {
          const smeData = await smeRes.json();
          const names: string[] = [
            ...new Set<string>(
              (smeData.contributions ?? []).map(
                (c: { contributor_name: string }) => c.contributor_name
              )
            ),
          ];
          setSmeOwnerOptions(names);
        }

        if (strategyData.strategy) {
          // Load existing saved strategy
          const s: SolicitationStrategy = strategyData.strategy;
          setWinThemes(s.win_theme_priorities ?? []);
          setAgencyIntel(s.agency_intel ?? "");
          setCompetitiveNotes(s.competitive_notes ?? "");
          setRiskPosture(s.risk_posture ?? "balanced");
          setVolumeStrategies(s.volume_strategies ?? []);
        } else {
          // Bootstrap defaults from Tier 1 win themes + Section L volumes
          setWinThemes(strategyData.default_win_themes ?? []);
          setVolumeStrategies(
            strategyData.volumes.map((v) => ({
              volume_name: v.name,
              approach_notes: "",
              emphasis_areas: [],
              sme_owner: undefined,
            }))
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load strategy.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [solicitationId, companyId]);

  // ─── Save draft strategy ───────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/solicitations/${solicitationId}/strategy`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          win_theme_priorities: winThemes,
          agency_intel: agencyIntel || undefined,
          competitive_notes: competitiveNotes || undefined,
          risk_posture: riskPosture,
          volume_strategies: volumeStrategies,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save strategy.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Confirm + generate ────────────────────────────────────
  const handleConfirm = async () => {
    setConfirming(true);
    setSaveError(null);
    try {
      // Save first, then confirm
      const saveRes = await fetch(`/api/solicitations/${solicitationId}/strategy`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          win_theme_priorities: winThemes,
          agency_intel: agencyIntel || undefined,
          competitive_notes: competitiveNotes || undefined,
          risk_posture: riskPosture,
          volume_strategies: volumeStrategies,
        }),
      });
      if (!saveRes.ok) throw new Error("Failed to save strategy before confirming");

      const confirmRes = await fetch(
        `/api/solicitations/${solicitationId}/strategy/confirm`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ graphics_profile: graphicsProfile }),
        }
      );
      if (!confirmRes.ok) {
        const body = await confirmRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Generation failed to start");
      }

      onGenerationStarted(graphicsProfile);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to start generation.");
    } finally {
      setConfirming(false);
    }
  };

  const updateVolumeStrategy = (index: number, updated: VolumeStrategy) => {
    setVolumeStrategies((prev) => prev.map((v, i) => (i === index ? updated : v)));
  };

  // ─── Loading / error states ────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle size={18} className="mt-0.5 text-red-500" />
          <div>
            <p className="text-sm font-semibold text-red-800">Could not load strategy data</p>
            <p className="mt-1 text-xs text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back link */}
      {onTabChange && (
        <button
          onClick={() => onTabChange("data-call")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={13} />
          Back to Data Call
        </button>
      )}

      {/* Win Themes */}
      <SectionCard icon={<Target size={16} />} title="Win Theme Priorities">
        <WinThemeList themes={winThemes} onChange={setWinThemes} />
      </SectionCard>

      {/* Risk Posture */}
      <SectionCard icon={<ShieldAlert size={16} />} title="Risk Posture">
        <div className="grid grid-cols-3 gap-2">
          {RISK_POSTURE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRiskPosture(opt.value)}
              className={cn(
                "rounded-lg border px-3 py-3 text-left transition-colors",
                riskPosture === opt.value
                  ? "border-blue-400 bg-blue-50 ring-1 ring-blue-400"
                  : "border-border bg-background hover:bg-muted/50"
              )}
            >
              <p
                className={cn(
                  "text-sm font-semibold",
                  riskPosture === opt.value ? "text-blue-800" : "text-foreground"
                )}
              >
                {opt.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Agency Intel */}
      <SectionCard icon={<Building2 size={16} />} title="Agency Intelligence">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Optional — share what you know about this agency, buyer tendencies, prior protests,
            or incumbent weaknesses. Injected into every volume prompt.
          </p>
          <textarea
            value={agencyIntel}
            onChange={(e) => setAgencyIntel(e.target.value)}
            placeholder="e.g. This is GSA's 4th attempt at this procurement — prior protests were on price. Incumbent is Booz Allen, known for weak transition plans. Evaluation board values past performance depth over technical novelty."
            rows={4}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </SectionCard>

      {/* Competitive Notes */}
      <SectionCard icon={<Target size={16} />} title="Competitive Positioning">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Optional — known competitors, differentiators to stress, or positioning strategy.
          </p>
          <textarea
            value={competitiveNotes}
            onChange={(e) => setCompetitiveNotes(e.target.value)}
            placeholder="e.g. Primary competitor is Leidos — differentiate on our cleared workforce depth and DISA past performance. Avoid cost competition."
            rows={3}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </SectionCard>

      {/* Volume Strategies */}
      {volumeStrategies.length > 0 && (
        <SectionCard icon={<FileText size={16} />} title="Volume Strategies">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Set specific approach notes and emphasis areas for each proposal volume.
              These instructions go directly to the AI writer.
            </p>
            {volumeStrategies.map((vs, i) => (
              <VolumeStrategyCard
                key={vs.volume_name}
                volumeStrategy={vs}
                onChange={(updated) => updateVolumeStrategy(i, updated)}
                smeOwnerOptions={smeOwnerOptions}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Graphics profile */}
      <SectionCard icon={<FileText size={16} />} title="Graphics Profile">
        <div className="flex gap-3">
          {(["minimal", "standard"] as GraphicsProfile[]).map((p) => (
            <button
              key={p}
              onClick={() => setGraphicsProfile(p)}
              className={cn(
                "flex-1 rounded-lg border px-4 py-3 text-left transition-colors",
                graphicsProfile === p
                  ? "border-blue-400 bg-blue-50 ring-1 ring-blue-400"
                  : "border-border bg-background hover:bg-muted/50"
              )}
            >
              <p
                className={cn(
                  "text-sm font-semibold capitalize",
                  graphicsProfile === p ? "text-blue-800" : "text-foreground"
                )}
              >
                {p}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {p === "minimal" ? "Text only — faster generation" : "Include diagrams and charts"}
              </p>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Errors */}
      {saveError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle size={15} className="mt-0.5 text-red-500" />
          <p className="text-sm text-red-700">{saveError}</p>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
        <button
          onClick={handleSave}
          disabled={saving || confirming}
          className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {saving ? (
            <span className="flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" /> Saving…
            </span>
          ) : (
            "Save Draft Strategy"
          )}
        </button>

        <button
          onClick={handleConfirm}
          disabled={saving || confirming}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {confirming ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Starting generation…
            </>
          ) : (
            <>
              <Zap size={14} />
              Confirm Strategy &amp; Generate
            </>
          )}
        </button>
      </div>
    </div>
  );
}
