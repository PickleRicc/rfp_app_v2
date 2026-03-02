'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useFetchWithCompany } from '@/lib/hooks/useFetchWithCompany';
import type { CompanyProfile } from '@/lib/supabase/company-types';
import { validateWordCount, type WordCountResult } from '@/lib/validation/tier1-validators';
import { Sparkles, Loader2 } from 'lucide-react';

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;
type GeneratableField =
  | 'corporate_overview'
  | 'core_services_summary'
  | 'enterprise_win_themes'
  | 'key_differentiators_summary'
  | 'standard_management_approach'
  | 'elevator_pitch_and_descriptions';

interface CapabilitiesPositioningTabProps {
  companyId: string;
  initialProfileData: Partial<CompanyProfile>;
  onSaved: () => void;
  fetchFn?: FetchFn;
}

// ---- Word count indicator component ----
interface WordCountIndicatorProps {
  result: WordCountResult;
  min: number;
  max: number;
}
function WordCountIndicator({ result, min, max }: WordCountIndicatorProps) {
  const pct = result.wordCount / max;
  const isOver = result.wordCount > max;
  const isApproachingMax = !isOver && pct > 0.8;
  const isUnderMin = result.wordCount > 0 && result.wordCount < min;

  const colorClass = isOver
    ? 'text-destructive'
    : isApproachingMax
    ? 'text-warning-foreground'
    : isUnderMin
    ? 'text-warning-foreground'
    : 'text-muted-foreground';

  return (
    <p className={`text-xs mt-1 ${colorClass}`}>
      {result.wordCount} / {max} words
      {isOver && ' — exceeds maximum, must reduce before saving'}
      {isUnderMin && ` — minimum ${min} words recommended`}
    </p>
  );
}

export function CapabilitiesPositioningTab({
  companyId,
  initialProfileData,
  onSaved,
  fetchFn,
}: CapabilitiesPositioningTabProps) {
  const { fetchWithCompany } = useFetchWithCompany();
  const doFetch: FetchFn = fetchFn || fetchWithCompany;

  // ---- Form state ----
  const [corporateOverview, setCorporateOverview] = useState('');
  const [coreServicesSummary, setCoreServicesSummary] = useState('');
  const [winThemes, setWinThemes] = useState<string[]>([]);
  const [winThemeInput, setWinThemeInput] = useState('');
  const [keyDifferentiatorsSummary, setKeyDifferentiatorsSummary] = useState('');
  const [standardManagementApproach, setStandardManagementApproach] = useState('');

  // Migrated from old profile page
  const [elevatorPitch, setElevatorPitch] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [missionStatement, setMissionStatement] = useState('');
  const [visionStatement, setVisionStatement] = useState('');
  const [coreValues, setCoreValues] = useState<string[]>([]);
  const [coreValueInput, setCoreValueInput] = useState('');

  // ---- Save state ----
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ---- Unsaved-changes guard ----
  const [isDirty, setIsDirty] = useState(false);
  const hydratedRef = useRef(false);

  const markDirty = useCallback(() => {
    if (hydratedRef.current) setIsDirty(true);
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ---- AI generation state ----
  const [generatingField, setGeneratingField] = useState<GeneratableField | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const handleGenerate = async (field: GeneratableField) => {
    const hasContent = {
      corporate_overview: !!corporateOverview.trim(),
      core_services_summary: !!coreServicesSummary.trim(),
      enterprise_win_themes: winThemes.length > 0,
      key_differentiators_summary: !!keyDifferentiatorsSummary.trim(),
      standard_management_approach: !!standardManagementApproach.trim(),
      elevator_pitch_and_descriptions: !!(elevatorPitch.trim() || fullDescription.trim() || missionStatement.trim() || visionStatement.trim()),
    }[field];

    if (hasContent && !confirm('This will replace your current content with AI-generated text. Continue?')) {
      return;
    }

    setGeneratingField(field);
    setGenError(null);

    try {
      const res = await doFetch('/api/company/capabilities/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      const result = data.result;

      switch (field) {
        case 'corporate_overview':
          setCorporateOverview(result as string);
          break;
        case 'core_services_summary':
          setCoreServicesSummary(result as string);
          break;
        case 'enterprise_win_themes':
          setWinThemes(result as string[]);
          break;
        case 'key_differentiators_summary':
          setKeyDifferentiatorsSummary(result as string);
          break;
        case 'standard_management_approach':
          setStandardManagementApproach(result as string);
          break;
        case 'elevator_pitch_and_descriptions': {
          const bundle = result as {
            elevator_pitch: string;
            full_description: string;
            mission_statement: string;
            vision_statement: string;
            core_values: string[];
          };
          setElevatorPitch(bundle.elevator_pitch || '');
          setFullDescription(bundle.full_description || '');
          setMissionStatement(bundle.mission_statement || '');
          setVisionStatement(bundle.vision_statement || '');
          if (bundle.core_values?.length) setCoreValues(bundle.core_values);
          break;
        }
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'AI generation failed');
    } finally {
      setGeneratingField(null);
    }
  };

  // ---- Initialize from initialProfileData ----
  useEffect(() => {
    if (!initialProfileData) return;
    setCorporateOverview(initialProfileData.corporate_overview || '');
    setCoreServicesSummary(initialProfileData.core_services_summary || '');
    setWinThemes(initialProfileData.enterprise_win_themes || []);
    setKeyDifferentiatorsSummary(initialProfileData.key_differentiators_summary || '');
    setStandardManagementApproach(initialProfileData.standard_management_approach || '');
    setElevatorPitch(initialProfileData.elevator_pitch || '');
    setFullDescription(initialProfileData.full_description || '');
    setMissionStatement(initialProfileData.mission_statement || '');
    setVisionStatement(initialProfileData.vision_statement || '');
    setCoreValues(initialProfileData.core_values || []);
    setIsDirty(false);
    requestAnimationFrame(() => { hydratedRef.current = true; });
  }, [initialProfileData]);

  // ---- Word count results (live) ----
  const overviewWC = validateWordCount(corporateOverview, 50, 500);
  const coreServicesWC = validateWordCount(coreServicesSummary, 30, 300);
  const differentiatorWC = validateWordCount(keyDifferentiatorsSummary, 30, 300);
  const managementWC = validateWordCount(standardManagementApproach, 50, 500);

  // ---- Win theme helpers ----
  const addWinTheme = () => {
    const trimmed = winThemeInput.trim();
    if (trimmed && trimmed.length <= 100) {
      setWinThemes([...winThemes, trimmed]);
      setWinThemeInput('');
    }
  };
  const removeWinTheme = (idx: number) => {
    setWinThemes(winThemes.filter((_, i) => i !== idx));
  };

  // ---- Core values helpers ----
  const addCoreValue = () => {
    if (coreValueInput.trim()) {
      setCoreValues([...coreValues, coreValueInput.trim()]);
      setCoreValueInput('');
    }
  };
  const removeCoreValue = (idx: number) => {
    setCoreValues(coreValues.filter((_, i) => i !== idx));
  };

  // ---- Validate before save ----
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (corporateOverview && !overviewWC.valid && overviewWC.wordCount > 500) {
      errors.corporate_overview = overviewWC.error || 'Word count exceeded';
    }
    if (coreServicesSummary && !coreServicesWC.valid && coreServicesWC.wordCount > 300) {
      errors.core_services = coreServicesWC.error || 'Word count exceeded';
    }
    if (keyDifferentiatorsSummary && !differentiatorWC.valid && differentiatorWC.wordCount > 300) {
      errors.differentiators = differentiatorWC.error || 'Word count exceeded';
    }
    if (
      standardManagementApproach &&
      !managementWC.valid &&
      managementWC.wordCount > 500
    ) {
      errors.management = managementWC.error || 'Word count exceeded';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ---- Save handler ----
  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const payload = {
        corporate_overview: corporateOverview,
        core_services_summary: coreServicesSummary,
        enterprise_win_themes: winThemes,
        key_differentiators_summary: keyDifferentiatorsSummary,
        standard_management_approach: standardManagementApproach,
        elevator_pitch: elevatorPitch,
        full_description: fullDescription,
        mission_statement: missionStatement,
        vision_statement: visionStatement,
        core_values: coreValues,
      };

      const response = await doFetch('/api/company/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save Capabilities & Positioning');
      }

      setSaveSuccess(true);
      setIsDirty(false);
      onSaved();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" onChange={markDirty}>
      {/* Success / Error banners */}
      {saveSuccess && (
        <div className="bg-success/10 border border-success/20 rounded-lg p-4">
          <p className="text-success font-medium">Capabilities & Positioning saved successfully.</p>
        </div>
      )}
      {saveError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive">{saveError}</p>
        </div>
      )}

      {genError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive text-sm">{genError}</p>
        </div>
      )}

      {/* Corporate Overview */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Corporate Overview</h2>
          <GenerateButton field="corporate_overview" generating={generatingField} onGenerate={handleGenerate} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Corporate Overview</label>
          <p className="text-xs text-muted-foreground mb-2">
            Detailed corporate overview used in proposal executive summaries. Describe your company&apos;s mission, history, and core competencies.
          </p>
          <textarea
            rows={8}
            maxLength={3000}
            value={corporateOverview}
            onChange={(e) => setCorporateOverview(e.target.value)}
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent resize-y bg-background ${
              fieldErrors.corporate_overview ? 'border-destructive bg-destructive/10' : 'border-input'
            }`}
            placeholder="Provide a comprehensive overview of your company — history, mission, core competencies, and value delivered to federal clients..."
          />
          <WordCountIndicator result={overviewWC} min={50} max={500} />
          {fieldErrors.corporate_overview && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.corporate_overview}</p>
          )}
        </div>
      </div>

      {/* Core Services */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Core Services</h2>
          <GenerateButton field="core_services_summary" generating={generatingField} onGenerate={handleGenerate} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Core Services Summary</label>
          <p className="text-xs text-muted-foreground mb-2">
            Summarize your primary service offerings. This feeds into proposal Technical Approach sections.
          </p>
          <textarea
            rows={6}
            maxLength={2000}
            value={coreServicesSummary}
            onChange={(e) => setCoreServicesSummary(e.target.value)}
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent resize-y bg-background ${
              fieldErrors.core_services ? 'border-destructive bg-destructive/10' : 'border-input'
            }`}
            placeholder="Describe your primary service offerings and areas of expertise..."
          />
          <WordCountIndicator result={coreServicesWC} min={30} max={300} />
          {fieldErrors.core_services && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.core_services}</p>
          )}
        </div>
      </div>

      {/* Enterprise Win Themes */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Enterprise Win Themes</h2>
          <GenerateButton field="enterprise_win_themes" generating={generatingField} onGenerate={handleGenerate} />
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Reusable win themes that highlight your competitive advantages. Example: &ldquo;Proven transition methodology with zero disruption to operations&rdquo;
        </p>

        {winThemes.length < 3 && (
          <div className="mb-3 px-3 py-2 bg-warning/10 border border-warning/30 rounded-md">
            <p className="text-xs text-warning-foreground">
              Recommended: at least 3 win themes ({winThemes.length}/3 added)
            </p>
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            maxLength={100}
            value={winThemeInput}
            onChange={(e) => setWinThemeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addWinTheme();
              }
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Proven zero-downtime transition methodology"
          />
          <button
            type="button"
            onClick={addWinTheme}
            disabled={!winThemeInput.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Max 100 characters per theme</p>

        <div className="space-y-2">
          {winThemes.map((theme, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg"
            >
              <span className="flex-1 text-sm text-foreground">{theme}</span>
              <button
                type="button"
                onClick={() => removeWinTheme(idx)}
                className="text-muted-foreground hover:text-foreground text-lg leading-none"
              >
                &times;
              </button>
            </div>
          ))}
          {winThemes.length === 0 && (
            <p className="text-muted-foreground text-sm">No win themes added yet.</p>
          )}
        </div>
      </div>

      {/* Key Differentiators */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Key Differentiators</h2>
          <GenerateButton field="key_differentiators_summary" generating={generatingField} onGenerate={handleGenerate} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Key Differentiators Summary</label>
          <p className="text-xs text-muted-foreground mb-2">
            Describe what sets you apart from competitors. This content is used across proposal sections to reinforce your value.
          </p>
          <textarea
            rows={6}
            maxLength={2000}
            value={keyDifferentiatorsSummary}
            onChange={(e) => setKeyDifferentiatorsSummary(e.target.value)}
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent resize-y bg-background ${
              fieldErrors.differentiators ? 'border-destructive bg-destructive/10' : 'border-input'
            }`}
            placeholder="Describe your unique competitive advantages and proof points..."
          />
          <WordCountIndicator result={differentiatorWC} min={30} max={300} />
          {fieldErrors.differentiators && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.differentiators}</p>
          )}
        </div>
      </div>

      {/* Standard Management Approach */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Standard Management Approach</h2>
          <GenerateButton field="standard_management_approach" generating={generatingField} onGenerate={handleGenerate} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Standard Management Approach</label>
          <p className="text-xs text-muted-foreground mb-2">
            Your standard approach to program management, quality assurance, and risk management. Used as the foundation for Management Volume content.
          </p>
          <textarea
            rows={8}
            maxLength={3000}
            value={standardManagementApproach}
            onChange={(e) => setStandardManagementApproach(e.target.value)}
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent resize-y bg-background ${
              fieldErrors.management ? 'border-destructive bg-destructive/10' : 'border-input'
            }`}
            placeholder="Describe your approach to program management, quality assurance, risk management, and continuous improvement..."
          />
          <WordCountIndicator result={managementWC} min={50} max={500} />
          {fieldErrors.management && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.management}</p>
          )}
        </div>
      </div>

      {/* Elevator Pitch & Descriptions (migrated from old profile page) */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Elevator Pitch & Company Descriptions</h2>
          <GenerateButton field="elevator_pitch_and_descriptions" generating={generatingField} onGenerate={handleGenerate} />
        </div>
        <div className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Elevator Pitch <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Describe your company in 2-3 sentences. Used in proposal cover letters and brief company overviews.
            </p>
            <textarea
              rows={3}
              maxLength={500}
              value={elevatorPitch}
              onChange={(e) => setElevatorPitch(e.target.value)}
              className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent resize-y"
              placeholder="Acme Federal Solutions is a veteran-owned IT services firm specializing in enterprise program management and agile transformation for federal agencies..."
            />
            <p className="text-xs text-muted-foreground mt-1">{elevatorPitch.length} / 500 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Full Description</label>
            <textarea
              rows={5}
              maxLength={2000}
              value={fullDescription}
              onChange={(e) => setFullDescription(e.target.value)}
              className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent resize-y"
              placeholder="Extended company description..."
            />
            <p className="text-xs text-muted-foreground mt-1">{fullDescription.length} / 2000 characters</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Mission Statement</label>
              <textarea
                rows={2}
                maxLength={300}
                value={missionStatement}
                onChange={(e) => setMissionStatement(e.target.value)}
                className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent resize-y"
              />
              <p className="text-xs text-muted-foreground mt-1">{missionStatement.length} / 300 characters</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Vision Statement</label>
              <textarea
                rows={2}
                maxLength={300}
                value={visionStatement}
                onChange={(e) => setVisionStatement(e.target.value)}
                className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent resize-y"
              />
              <p className="text-xs text-muted-foreground mt-1">{visionStatement.length} / 300 characters</p>
            </div>
          </div>

          {/* Core Values */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Core Values</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={coreValueInput}
                onChange={(e) => setCoreValueInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCoreValue();
                  }
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Integrity, Excellence, Innovation"
              />
              <button
                type="button"
                onClick={addCoreValue}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {coreValues.map((value, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-2"
                >
                  {value}
                  <button
                    type="button"
                    onClick={() => removeCoreValue(idx)}
                    className="text-primary hover:text-primary/80"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-primary-foreground px-8 py-3 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {saving ? 'Saving...' : 'Save Capabilities & Positioning'}
        </button>
      </div>
    </div>
  );
}

function GenerateButton({
  field,
  generating,
  onGenerate,
}: {
  field: GeneratableField;
  generating: GeneratableField | null;
  onGenerate: (f: GeneratableField) => void;
}) {
  const isGenerating = generating === field;
  const anyGenerating = generating !== null;

  return (
    <button
      type="button"
      disabled={anyGenerating}
      onClick={() => onGenerate(field)}
      className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isGenerating ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      {isGenerating ? 'Generating...' : 'Generate with AI'}
    </button>
  );
}
