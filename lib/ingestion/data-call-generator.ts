/**
 * Data Call Form Schema Generator
 * Phase 8: Tier 2 Dynamic Data Call
 *
 * Reads Phase 7 compliance extractions for a solicitation and produces a
 * dynamic form schema reflecting exactly what that specific RFP requires.
 *
 * The five sections generated:
 *   1. Opportunity Details  — administrative context (prime/sub, NAICS, set-aside)
 *   2. Past Performance     — dynamic reference count from extraction (default: 3)
 *   3. Key Personnel        — one card per required position from extraction (default: 0)
 *   4. Technical Approach   — static narrative fields with SOW context
 *   5. Compliance Verification — certs and clearances from security_reqs + section_l extractions
 *
 * Each field's rfp_citation is derived from the corresponding extraction's field_label
 * so users see exactly which part of the RFP requires each piece of information.
 *
 * IMPORTANT: generateDataCallSchema() never throws — it returns a best-effort schema
 * using sensible defaults when extractions are absent or incomplete.
 */

import { getServerClient } from '@/lib/supabase/client';
import type { ComplianceExtraction } from '@/lib/supabase/compliance-types';
import type {
  DataCallFormSchema,
  DataCallSection,
  DataCallFormField,
  DataCallFieldValidation,
} from '@/lib/supabase/tier2-types';
import type { ISOCMMIStatus } from '@/lib/supabase/company-types';

// ===== COMPANY INTAKE DATA =====

/**
 * Subset of Tier 1 company profile data relevant to data call pre-filling.
 * Fetched once when companyId is provided, then passed to section builders
 * so they can pre-fill fields from company intake data.
 */
interface CompanyIntakeData {
  // Facility clearance
  has_facility_clearance?: boolean | null;
  clearance_level?: string | null;
  sponsoring_agency?: string | null;
  cage_code_cleared?: string | null;

  // Registration & NAICS
  primary_naics?: string | null;
  primary_naics_title?: string | null;
  cage_code?: string | null;

  // Certifications
  iso_cmmi_status?: ISOCMMIStatus | null;

  // Socioeconomic
  socioeconomic_certs?: string[] | null;
  business_size?: string | null;
}

// ===== HELPERS =====

/**
 * Find the first extraction row matching the given category and field_name,
 * then return its field_value cast to T. Returns null if not found.
 */
function getExtractionValue<T = unknown>(
  extractions: ComplianceExtraction[],
  category: string,
  fieldName: string
): T | null {
  const row = extractions.find(
    (e) => e.category === category && e.field_name === fieldName
  );
  if (!row || row.field_value === undefined || row.field_value === null) {
    return null;
  }
  return row.field_value as T;
}

/**
 * Find the first extraction row matching the given category and field_name,
 * then return its field_label for use as an RFP citation.
 * Returns null if not found.
 */
function getExtractionLabel(
  extractions: ComplianceExtraction[],
  category: string,
  fieldName: string
): string | null {
  const row = extractions.find(
    (e) => e.category === category && e.field_name === fieldName
  );
  return row?.field_label ?? null;
}

/**
 * Format an extraction label as a short citation string.
 * Produces "Per [label]" if the label exists, otherwise null.
 */
function makeCitation(label: string | null): string | null {
  if (!label) return null;
  // If label already starts with "Per" treat it as-is
  if (label.startsWith('Per ')) return label;
  return `Per ${label}`;
}

/**
 * Build a citation by looking up the extraction label for a category/field.
 */
function buildCitation(
  extractions: ComplianceExtraction[],
  category: string,
  fieldName: string
): string | null {
  return makeCitation(getExtractionLabel(extractions, category, fieldName));
}

// ===== CONTRACT STYLE DETECTION =====

type DataCallContractStyle = 'it_operations' | 'software_dev' | 'consulting' | 'research' | 'general';

function detectDataCallContractStyle(extractions: ComplianceExtraction[]): DataCallContractStyle {
  const documentType = getExtractionValue<string>(extractions, 'sow_pws', 'document_type');
  const totalServiceAreas = getExtractionValue<number>(extractions, 'sow_pws', 'total_service_areas') || 0;

  // Build a single searchable text from all extraction values per category
  const textByCategory: Record<string, string> = {};
  for (const row of extractions) {
    const val = JSON.stringify(row.field_value || '').toLowerCase();
    textByCategory[row.category] = (textByCategory[row.category] || '') + ' ' + val;
  }
  const allText = Object.values(textByCategory).join(' ');

  // Count unique keyword matches (not duplicates from same keyword in multiple rows)
  function countSignals(text: string, keywords: string[]): number {
    return keywords.filter(kw => text.includes(kw)).length;
  }

  // IT ops: search across technology_reqs AND sow_pws (keywords appear in both)
  const itOpsKeywords = ['servicenow', 'cisco', 'nutanix', 'sccm', 'mecm', 'active directory',
    'vmware', 'solarwinds', 'jamf', 'puppet', 'ansible', 'service desk', 'help desk',
    'it operations', 'it support', 'infrastructure', 'network operations', 'noc',
    'end user', 'desktop support', 'patch management', 'monitoring'];
  const itOpsText = (textByCategory['technology_reqs'] || '') + ' ' + (textByCategory['sow_pws'] || '');
  const itOpsSignals = countSignals(itOpsText, itOpsKeywords);

  if ((documentType === 'SOO' || documentType === 'PWS') && (totalServiceAreas >= 3 || itOpsSignals >= 2)) return 'it_operations';
  if (totalServiceAreas >= 3 && itOpsSignals >= 2) return 'it_operations';
  if (itOpsSignals >= 3) return 'it_operations';

  // Software dev: search sow_pws + technology_reqs
  const devKeywords = ['agile', 'sprint', 'sdlc', 'devops', 'devsecops', 'ci/cd',
    'software development', 'application development', 'coding', 'scrum', 'kanban',
    'continuous integration', 'microservices', 'api development', 'cloud native'];
  const devText = (textByCategory['sow_pws'] || '') + ' ' + (textByCategory['technology_reqs'] || '');
  const devSignals = countSignals(devText, devKeywords);
  if (devSignals >= 2) return 'software_dev';

  // Research: search operational_context + sow_pws
  const researchKeywords = ['research', 'laboratory', 'r&d', 'scientific', 'experiment',
    'prototype', 'proof of concept', 'technical evaluation'];
  const researchText = (textByCategory['operational_context'] || '') + ' ' + (textByCategory['sow_pws'] || '');
  const researchSignals = countSignals(researchText, researchKeywords);
  if (researchSignals >= 2) return 'research';

  // Consulting: search sow_pws + operational_context
  const consultingKeywords = ['advisory', 'assessment', 'strategy', 'consulting', 'analysis',
    'recommendation', 'evaluation', 'roadmap', 'maturity model', 'gap analysis'];
  const consultingText = (textByCategory['sow_pws'] || '') + ' ' + (textByCategory['operational_context'] || '');
  const consultingSignals = countSignals(consultingText, consultingKeywords);
  if (consultingSignals >= 2) return 'consulting';

  // Last resort: if document type is SOO or PWS, it's likely IT ops even without strong signals
  if (documentType === 'SOO' || documentType === 'PWS') return 'it_operations';
  if (documentType === 'SOW') return 'software_dev';

  // Log for debugging in development
  console.log('[data-call-generator] Contract style detection: general (no strong signals)',
    { documentType, totalServiceAreas, itOpsSignals, devSignals, researchSignals, consultingSignals });

  return 'general';
}

// ===== SECTION BUILDERS =====

/**
 * Section 1: Opportunity Details
 * Static fields pre-filled from admin_data extraction results
 * and Tier 1 company intake data (NAICS, socioeconomic certs).
 */
function buildOpportunityDetailsSection(
  extractions: ComplianceExtraction[],
  companyData?: CompanyIntakeData | null
): DataCallSection {
  const naicsValue = getExtractionValue<string>(extractions, 'admin_data', 'naics_code');
  const sizeValue = getExtractionValue<string>(extractions, 'admin_data', 'size_standard');
  const setAsideValue = getExtractionValue<string>(extractions, 'admin_data', 'set_aside_designation');
  const contractTypeValue = getExtractionValue<string>(extractions, 'admin_data', 'contract_type');

  const fields: DataCallFormField[] = [
    {
      key:          'prime_or_sub',
      label:        'Prime / Sub Role',
      type:         'select',
      required:     true,
      blocking:     true,
      rfp_citation: null,
      options:      ['prime', 'sub', 'teaming'],
      placeholder:  'Select role',
    },
    {
      key:          'teaming_partners',
      label:        'Teaming Partners',
      type:         'textarea',
      required:     false,
      rfp_citation: null,
      placeholder:  'List teaming partners (one per line), or leave blank if not applicable',
    },
    {
      key:           'contract_type',
      label:         'Contract Type',
      type:          'text',
      required:      true,
      rfp_citation:  buildCitation(extractions, 'admin_data', 'contract_type'),
      default_value: contractTypeValue ?? undefined,
      placeholder:   'e.g., FFP, CPFF, T&M',
    },
    {
      key:           'naics_code',
      label:         'NAICS Code',
      type:          'text',
      required:      true,
      rfp_citation:  buildCitation(extractions, 'admin_data', 'naics_code'),
      default_value: naicsValue ?? companyData?.primary_naics ?? undefined,
      placeholder:   companyData?.primary_naics
        ? `Company NAICS: ${companyData.primary_naics}${companyData.primary_naics_title ? ` (${companyData.primary_naics_title})` : ''}`
        : 'e.g., 541330',
    },
    {
      key:           'size_standard',
      label:         'Size Standard',
      type:          'text',
      required:      false,
      rfp_citation:  buildCitation(extractions, 'admin_data', 'size_standard'),
      default_value: sizeValue ?? undefined,
      placeholder:   companyData?.business_size
        ? `Company size: ${companyData.business_size}`
        : 'e.g., $47M',
    },
    {
      key:           'set_aside',
      label:         'Set-Aside Designation',
      type:          'text',
      required:      false,
      rfp_citation:  buildCitation(extractions, 'admin_data', 'set_aside_designation'),
      default_value: setAsideValue ?? (companyData?.socioeconomic_certs && companyData.socioeconomic_certs.length > 0
        ? companyData.socioeconomic_certs[0]
        : undefined),
      placeholder:   companyData?.socioeconomic_certs && companyData.socioeconomic_certs.length > 0
        ? `Company certs: ${companyData.socioeconomic_certs.join(', ')}`
        : 'e.g., SDVOSB, 8(a), Full & Open',
    },
  ];

  return {
    id:          'opportunity_details',
    title:       'Opportunity Details',
    description: 'Administrative context for this bid: your role, team composition, and key contract parameters derived from the solicitation.',
    fields,
  };
}

/**
 * Section 2: Past Performance
 * Dynamic count driven by references_required extraction (default: 3).
 * Fields are template fields for a single reference card.
 * The UI renders dynamic_count copies of these fields with index suffixes.
 */
function buildPastPerformanceSection(
  extractions: ComplianceExtraction[],
  pastPerformanceCount: number = 0
): DataCallSection {
  // Determine required reference count
  const referencesRequired = getExtractionValue<number | string>(
    extractions, 'past_performance', 'references_required'
  );

  let dynamicCount = 3; // sensible default per plan
  if (referencesRequired !== null) {
    const parsed = typeof referencesRequired === 'number'
      ? referencesRequired
      : parseInt(String(referencesRequired), 10);
    if (!isNaN(parsed) && parsed > 0) {
      dynamicCount = parsed;
    }
  }

  // Build citation for the count source
  const countLabel = getExtractionLabel(extractions, 'past_performance', 'references_required');
  const dynamicCountSource = countLabel
    ? `${countLabel}: ${dynamicCount} reference${dynamicCount !== 1 ? 's' : ''} required`
    : `Default: ${dynamicCount} past performance references`;

  // Recency and relevance from extraction for description
  const recency = getExtractionValue<string>(extractions, 'past_performance', 'recency_requirement');
  const relevanceCriteria = getExtractionValue<string[]>(extractions, 'past_performance', 'relevance_criteria');

  // Recency window as numeric years — used for date validation
  const recencyYears = getExtractionValue<number>(extractions, 'past_performance', 'recency_years');
  let recencyCutoffDate: string | undefined;
  if (recencyYears && recencyYears > 0) {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - recencyYears);
    recencyCutoffDate = cutoff.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  let description = `Provide ${dynamicCount} past performance reference${dynamicCount !== 1 ? 's' : ''} that demonstrate relevant experience.`;
  if (pastPerformanceCount > 0) {
    description += ` You have ${pastPerformanceCount} past performance record(s) in your company profile that may be applicable.`;
  }
  if (recency) {
    description += ` Recency requirement: ${recency}.`;
  }
  if (relevanceCriteria && Array.isArray(relevanceCriteria) && relevanceCriteria.length > 0) {
    description += ` Relevance criteria: ${relevanceCriteria.join(', ')}.`;
  }

  // Template fields for one reference card (UI duplicates per dynamic_count)
  const fields: DataCallFormField[] = [
    {
      key:          'project_name',
      label:        'Project / Program Name',
      type:         'text',
      required:     true,
      rfp_citation: buildCitation(extractions, 'past_performance', 'references_required'),
      placeholder:  'e.g., DISA ENCORE III Task Order',
    },
    {
      key:          'client_agency',
      label:        'Client / Agency',
      type:         'text',
      required:     true,
      rfp_citation: null,
      placeholder:  'e.g., Defense Information Systems Agency',
    },
    {
      key:          'contract_number',
      label:        'Contract Number',
      type:         'text',
      required:     true,
      rfp_citation: null,
      placeholder:  'e.g., HC1028-19-D-2001',
    },
    {
      key:          'contract_value',
      label:        'Contract Value',
      type:         'text',
      required:     false,
      rfp_citation: null,
      placeholder:  'e.g., $4.2M',
    },
    {
      key:          'period_of_performance',
      label:        'Period of Performance',
      type:         'text',
      required:     true,
      rfp_citation: buildCitation(extractions, 'past_performance', 'recency_requirement'),
      placeholder:  'e.g., Jan 2021 — Dec 2023',
    },
    {
      key:          'performance_end_date',
      label:        'Contract End Date',
      type:         'text',
      required:     !!recencyYears,
      blocking:     !!recencyYears,
      rfp_citation: buildCitation(extractions, 'past_performance', 'recency_years'),
      placeholder:  recencyYears
        ? `Must be within ${recencyYears} years (after ${recencyCutoffDate}). Format: YYYY-MM-DD`
        : 'e.g., 2023-12-31 (YYYY-MM-DD format)',
      validation:   recencyCutoffDate
        ? {
            recency_cutoff_date: recencyCutoffDate,
            recency_description: recency ?? `Within ${recencyYears} years`,
            validation_hint: `Contract must have ended on or after ${recencyCutoffDate} to meet the ${recency ?? `${recencyYears}-year`} recency requirement`,
          }
        : undefined,
    },
    {
      key:          'relevance_summary',
      label:        'Relevance Summary',
      type:         'textarea',
      required:     true,
      rfp_citation: buildCitation(extractions, 'past_performance', 'relevance_criteria'),
      placeholder:  'Describe how this contract is relevant to the current requirement (scope, complexity, magnitude)',
    },
    {
      key:          'contact_name',
      label:        'Government Point of Contact',
      type:         'text',
      required:     true,
      rfp_citation: null,
      placeholder:  'Full name of COR / COTR / CO',
    },
    {
      key:          'contact_email',
      label:        'Contact Email',
      type:         'text',
      required:     true,
      rfp_citation: null,
      placeholder:  'e.g., jane.smith@agency.gov',
    },
    {
      key:          'contact_phone',
      label:        'Contact Phone',
      type:         'text',
      required:     false,
      rfp_citation: null,
      placeholder:  'e.g., (703) 555-0100',
    },
  ];

  return {
    id:                  'past_performance',
    title:               'Past Performance',
    description,
    fields,
    dynamic_count:        dynamicCount,
    dynamic_count_source: dynamicCountSource,
  };
}

/**
 * Section 3: Key Personnel
 * One card per required position from key_personnel extraction.
 * If no positions found, dynamic_count = 0 and the UI shows an "Add Personnel" prompt.
 */
function buildKeyPersonnelSection(
  extractions: ComplianceExtraction[],
  personnelCount: number = 0
): DataCallSection {
  // Positions from extraction
  interface ExtractedPosition {
    title: string;
    qualifications?: string | null;
    clearance?: string | null;
    education?: string | null;
    experience?: string | null;
  }

  const positions = getExtractionValue<ExtractedPosition[]>(
    extractions, 'key_personnel', 'positions'
  );

  const dynamicCount = (positions && Array.isArray(positions) && positions.length > 0)
    ? positions.length
    : 0;

  const locRequirements = getExtractionValue<string>(
    extractions, 'key_personnel', 'loc_requirements'
  );
  const keyPersonnelCitation = buildCitation(extractions, 'key_personnel', 'positions');

  // Backup personnel requirement from extraction
  const backupRequired = getExtractionValue<boolean | string>(
    extractions, 'key_personnel', 'backup_personnel_required'
  );
  const isBackupRequired = backupRequired === true || backupRequired === 'true'
    || (typeof backupRequired === 'string' && backupRequired.toLowerCase().includes('yes'));

  let description = dynamicCount > 0
    ? `${dynamicCount} key personnel position${dynamicCount !== 1 ? 's' : ''} required by the RFP. Provide named candidates with resumes and any required Letters of Commitment.`
    : 'Provide key personnel information for proposed team members. Add positions as required by your technical approach.';

  if (locRequirements) {
    description += ` LOC requirement: ${locRequirements}.`;
  }

  if (personnelCount > 0) {
    description += ` You have ${personnelCount} personnel record(s) in your company profile.`;
  }

  if (isBackupRequired) {
    description += ' IMPORTANT: RFP requires backup/alternate personnel for each key position.';
  }

  // Build default_values from extracted positions (role pre-filled per position)
  // The UI creates dynamic_count cards, each with these fields; role is pre-filled from extraction
  const positionDefaults = (positions && Array.isArray(positions))
    ? positions.map((p) => p.title)
    : [];

  const fields: DataCallFormField[] = [
    {
      key:           'role',
      label:         'Role / Position',
      type:          'text',
      required:      true,
      rfp_citation:  keyPersonnelCitation,
      default_value: positionDefaults[0] ?? undefined, // UI uses index-based lookup per card
      placeholder:   'e.g., Program Manager',
    },
    {
      key:          'name',
      label:        'Candidate Full Name',
      type:         'text',
      required:     true,
      rfp_citation: null,
      placeholder:  personnelCount > 0
        ? 'Select from your company personnel records or enter a new candidate name'
        : 'Full name of proposed candidate',
    },
    {
      key:          'qualifications_summary',
      label:        'Qualifications Summary',
      type:         'textarea',
      required:     true,
      rfp_citation: keyPersonnelCitation,
      placeholder:  'Education, years of experience, clearance level, relevant certifications',
    },
    {
      key:          'resume_file',
      label:        'Resume (PDF or DOCX)',
      type:         'file',
      required:     true,
      rfp_citation: buildCitation(extractions, 'key_personnel', 'resume_format'),
      placeholder:  'Upload resume',
    },
    {
      key:          'certifications_files',
      label:        'Certification Documents (optional)',
      type:         'file',
      required:     false,
      rfp_citation: null,
      placeholder:  'Upload certifications (PMP, CISSP, etc.)',
    },
    {
      key:          'loc_file',
      label:        locRequirements
        ? 'Letter of Commitment (required)'
        : 'Letter of Commitment (if applicable)',
      type:         'file',
      required:     !!locRequirements,
      rfp_citation: buildCitation(extractions, 'key_personnel', 'loc_requirements'),
      placeholder:  'Upload signed LOC',
    },
  ];

  // Backup personnel fields — blocking when RFP mandates backup/alternate personnel
  if (isBackupRequired) {
    fields.push(
      {
        key:          'backup_name',
        label:        'Backup / Alternate Personnel Name',
        type:         'text',
        required:     true,
        blocking:     true,
        rfp_citation: buildCitation(extractions, 'key_personnel', 'backup_personnel_required'),
        placeholder:  'Full legal name of backup candidate for this position',
        validation:   {
          validation_hint: 'RFP requires named backup personnel for each key position. Proposal cannot proceed without a backup candidate.',
        },
      },
      {
        key:          'backup_qualifications',
        label:        'Backup Personnel Qualifications',
        type:         'textarea',
        required:     true,
        blocking:     true,
        rfp_citation: buildCitation(extractions, 'key_personnel', 'backup_personnel_required'),
        placeholder:  'Education, certifications, years of experience for backup candidate',
      }
    );
  }

  const section: DataCallSection = {
    id:          'key_personnel',
    title:       'Key Personnel',
    description,
    fields,
  };

  // Only include dynamic_count fields when positions were found or count matters
  if (dynamicCount > 0 || (positions !== null)) {
    section.dynamic_count        = dynamicCount;
    section.dynamic_count_source = keyPersonnelCitation
      ? `${keyPersonnelCitation}: ${dynamicCount} position${dynamicCount !== 1 ? 's' : ''} identified`
      : `${dynamicCount} key personnel position${dynamicCount !== 1 ? 's' : ''} identified from extraction`;
  }

  // Attach position defaults for the UI to consume (stored in metadata)
  // We encode this via the first field's default_value being the positions array
  if (positionDefaults.length > 0) {
    // Store all position titles as the default_value of the 'role' field
    // UI reads this array and pre-fills each card's role field by index
    fields[0].default_value = positionDefaults;
  }

  return section;
}

/**
 * Section 4: Technical Approach
 * Static narrative fields. rfp_citation pulled from sow_pws task_areas if available.
 */
function buildTechnicalApproachSection(
  extractions: ComplianceExtraction[]
): DataCallSection {
  const sowCitation = buildCitation(extractions, 'sow_pws', 'task_areas');
  const taskAreas = getExtractionValue<Array<{ name: string; description?: string | null }>>(
    extractions, 'sow_pws', 'task_areas'
  );

  let description = 'Describe your technical approach for executing the statement of work.';
  if (taskAreas && Array.isArray(taskAreas) && taskAreas.length > 0) {
    const areaNames = taskAreas.slice(0, 5).map((t) => t.name).join(', ');
    const moreCount = taskAreas.length > 5 ? ` and ${taskAreas.length - 5} more` : '';
    description += ` Key task areas: ${areaNames}${moreCount}.`;
  }

  const contractStyle = detectDataCallContractStyle(extractions);

  // Add contract style context to description
  const styleLabels: Record<DataCallContractStyle, string> = {
    it_operations: 'IT Operations & Managed Services',
    software_dev: 'Software Development',
    consulting: 'Consulting & Advisory',
    research: 'Research & Development',
    general: 'Government Services',
  };
  description += ` Contract type detected: ${styleLabels[contractStyle]}.`;

  // Check if site staffing section exists to avoid redundant staffing field
  const hasSiteStaffing = extractions.some(
    r => r.category === 'operational_context' && r.field_name === 'sites' &&
      Array.isArray(r.field_value) && (r.field_value as unknown[]).length > 0
  );

  // Base fields — approach_summary is always required, tools always present
  const fields: DataCallFormField[] = [
    {
      key:          'approach_summary',
      label:        'Technical Approach Summary',
      type:         'textarea',
      required:     true,
      rfp_citation: sowCitation,
      placeholder:  'High-level narrative describing how you will perform the work, address key task areas, and meet performance standards',
    },
    {
      key:          'tools_and_platforms',
      label:        'Tools, Platforms & Methodologies',
      type:         'textarea',
      required:     false,
      rfp_citation: sowCitation,
      placeholder:  'Technologies, frameworks, and methodologies to be employed',
    },
  ];

  // Only include staffing_model if no dedicated site staffing section
  if (!hasSiteStaffing) {
    fields.push({
      key:          'staffing_model',
      label:        'Staffing Model',
      type:         'textarea',
      required:     false,
      rfp_citation: sowCitation,
      placeholder:  'Team structure, labor mix, on-site vs. remote, subcontractor roles',
    });
  }

  fields.push(
    {
      key:          'assumptions',
      label:        'Assumptions',
      type:         'textarea',
      required:     false,
      rfp_citation: null,
      placeholder:  'Key assumptions underlying your technical approach',
    },
    {
      key:          'risks',
      label:        'Risks & Mitigations',
      type:         'textarea',
      required:     false,
      rfp_citation: null,
      placeholder:  'Identified risks and proposed mitigation strategies',
    },
  );

  // Contract-style-specific fields
  if (contractStyle === 'it_operations') {
    fields.push(
      {
        key: 'service_level_targets',
        label: 'Service Level Targets & KPIs',
        type: 'textarea' as const,
        required: false,
        rfp_citation: sowCitation,
        placeholder: 'Proposed SLA targets, response/resolution times, uptime commitments, and performance metrics for each service area',
      },
      {
        key: 'change_management_process',
        label: 'Change & Configuration Management',
        type: 'textarea' as const,
        required: false,
        rfp_citation: sowCitation,
        placeholder: 'Change advisory board process, approval workflows, emergency change procedures, configuration baseline management',
      },
      {
        key: 'incident_response_model',
        label: 'Incident Response & Escalation',
        type: 'textarea' as const,
        required: false,
        rfp_citation: sowCitation,
        placeholder: 'Tiered escalation path, major incident management, root cause analysis approach, and after-action review process',
      },
      {
        key: 'transition_in_plan',
        label: 'Transition-In Plan',
        type: 'textarea' as const,
        required: false,
        rfp_citation: sowCitation,
        placeholder: 'Phase-gate transition approach, knowledge transfer from incumbent, shadow period, risk mitigation during cutover',
      },
    );
  } else if (contractStyle === 'software_dev') {
    fields.push(
      {
        key: 'sdlc_methodology',
        label: 'SDLC Methodology',
        type: 'textarea' as const,
        required: false,
        rfp_citation: sowCitation,
        placeholder: 'Agile/Scrum/SAFe framework, sprint cadence, ceremonies, definition of done, velocity tracking approach',
      },
      {
        key: 'cicd_pipeline',
        label: 'CI/CD & DevSecOps Pipeline',
        type: 'textarea' as const,
        required: false,
        rfp_citation: sowCitation,
        placeholder: 'Build/test/deploy pipeline, automated testing strategy, static code analysis, container security scanning',
      },
      {
        key: 'test_strategy',
        label: 'Test Strategy',
        type: 'textarea' as const,
        required: false,
        rfp_citation: sowCitation,
        placeholder: 'Unit, integration, system, UAT, regression testing approach, test automation coverage targets',
      },
      {
        key: 'architecture_approach',
        label: 'Architecture & Design Approach',
        type: 'textarea' as const,
        required: false,
        rfp_citation: sowCitation,
        placeholder: 'Architecture patterns (microservices, event-driven, etc.), technology stack decisions, scalability approach',
      },
    );
  } else if (contractStyle === 'consulting') {
    fields.push(
      {
        key: 'assessment_methodology',
        label: 'Assessment Methodology',
        type: 'textarea' as const,
        required: false,
        rfp_citation: sowCitation,
        placeholder: 'Assessment framework, data collection methods, stakeholder interview approach, analysis techniques',
      },
      {
        key: 'deliverable_structure',
        label: 'Deliverable Structure & Quality',
        type: 'textarea' as const,
        required: false,
        rfp_citation: sowCitation,
        placeholder: 'Deliverable format, review cycles, quality assurance process, acceptance criteria approach',
      },
      {
        key: 'knowledge_transfer',
        label: 'Knowledge Transfer Plan',
        type: 'textarea' as const,
        required: false,
        rfp_citation: sowCitation,
        placeholder: 'Training approach, documentation standards, organizational readiness assessment, sustainability plan',
      },
    );
  } else if (contractStyle === 'research') {
    fields.push(
      {
        key: 'research_methodology',
        label: 'Research Methodology',
        type: 'textarea' as const,
        required: false,
        rfp_citation: sowCitation,
        placeholder: 'Research design, data collection, analysis methods, validation approach, reproducibility measures',
      },
      {
        key: 'lab_facilities',
        label: 'Laboratory & Equipment',
        type: 'textarea' as const,
        required: false,
        rfp_citation: sowCitation,
        placeholder: 'Available laboratory facilities, specialized equipment, access arrangements, safety protocols',
      },
      {
        key: 'publication_plan',
        label: 'Publication & IP Management',
        type: 'textarea' as const,
        required: false,
        rfp_citation: sowCitation,
        placeholder: 'Publication timeline, intellectual property handling, data sharing plan, technology transfer approach',
      },
    );
  }

  // Deliverable schedule — conditional on extracted deliverables from SOW/PWS
  const deliverables = getExtractionValue<Array<{ name: string; frequency?: string; format?: string }>>(
    extractions, 'sow_pws', 'deliverables'
  );

  if (deliverables && Array.isArray(deliverables) && deliverables.length > 0) {
    const delivNames = deliverables.slice(0, 5).map(d => d.name).join(', ');
    const moreCount = deliverables.length > 5 ? ` and ${deliverables.length - 5} more` : '';
    fields.push({
      key: 'cdrl_delivery_plan',
      label: 'CDRL / Deliverable Delivery Plan',
      type: 'textarea' as const,
      required: false,
      rfp_citation: buildCitation(extractions, 'sow_pws', 'deliverables'),
      placeholder: `Proposed delivery schedule, review cycles, and quality approach for: ${delivNames}${moreCount}`,
    });
  }

  return {
    id:          'technical_approach',
    title:       'Technical Approach',
    description,
    fields,
  };
}

/**
 * Section 5: Compliance Verification
 * Driven by security_reqs and section_l extractions, enriched with
 * Tier 1 company intake data (facility clearance, ISO/CMMI certs).
 * Generates boolean toggles for org certs, clearance confirmation,
 * NIST score field, and file slots for required attachments.
 */
function buildComplianceVerificationSection(
  extractions: ComplianceExtraction[],
  companyData?: CompanyIntakeData | null
): DataCallSection {
  // Security requirements
  const dd254Required = getExtractionValue<boolean | string>(
    extractions, 'security_reqs', 'dd254_required'
  );
  const clearanceLevels = getExtractionValue<string[]>(
    extractions, 'security_reqs', 'clearance_levels'
  );
  const cmmcLevel = getExtractionValue<string>(
    extractions, 'security_reqs', 'cmmc_level'
  );
  const nistRequired = getExtractionValue<boolean | string>(
    extractions, 'security_reqs', 'nist_800_171_required'
  );

  // Section L required attachments
  const requiredAttachments = getExtractionValue<string[]>(
    extractions, 'section_l', 'required_attachments'
  );
  const requiredForms = getExtractionValue<string[]>(
    extractions, 'section_l', 'required_forms'
  );

  // Build description from findings
  const securityItems: string[] = [];
  if (dd254Required === true || dd254Required === 'true' || dd254Required === 'yes') {
    securityItems.push('DD254 required');
  }
  if (clearanceLevels && Array.isArray(clearanceLevels) && clearanceLevels.length > 0) {
    securityItems.push(`Clearance: ${clearanceLevels.join(', ')}`);
  }
  if (cmmcLevel) {
    securityItems.push(`CMMC Level ${cmmcLevel}`);
  }
  if (nistRequired === true || nistRequired === 'true' || nistRequired === 'yes') {
    securityItems.push('NIST 800-171 compliance required');
  }

  const description = securityItems.length > 0
    ? `Verify compliance with security and certification requirements: ${securityItems.join('; ')}.`
    : 'Confirm organizational certifications, clearance levels, and required attachments for this solicitation.';

  const fields: DataCallFormField[] = [];

  // Organizational certifications — boolean toggles per cert found
  // Pre-fill from Tier 1 company intake ISO/CMMI status
  const certOptions: string[] = [];
  if (cmmcLevel) certOptions.push(`CMMC Level ${cmmcLevel}`);
  if (cmmcLevel && parseInt(cmmcLevel, 10) >= 3) certOptions.push('ISO 27001');
  certOptions.push('ISO 9001', 'CMMI Level 3');

  // Build pre-fill hints from Tier 1 company intake
  const companyHeldCerts: string[] = [];
  if (companyData?.iso_cmmi_status) {
    const iso = companyData.iso_cmmi_status;
    if (iso.iso_9001) companyHeldCerts.push('ISO 9001');
    if (iso.iso_27001) companyHeldCerts.push('ISO 27001');
    if (iso.iso_20000) companyHeldCerts.push('ISO 20000');
    if (iso.cmmi_dev_level && iso.cmmi_dev_level >= 3) companyHeldCerts.push(`CMMI DEV Level ${iso.cmmi_dev_level}`);
    if (iso.cmmi_svc_level && iso.cmmi_svc_level >= 3) companyHeldCerts.push(`CMMI SVC Level ${iso.cmmi_svc_level}`);
    if (iso.itil_certified) companyHeldCerts.push('ITIL Certified');
  }

  fields.push({
    key:          'org_certifications',
    label:        'Organizational Certifications',
    type:         'boolean',
    required:     false,
    rfp_citation: buildCitation(extractions, 'security_reqs', 'cmmc_level'),
    options:      certOptions,
    placeholder:  companyHeldCerts.length > 0
      ? `Company intake: ${companyHeldCerts.join(', ')}. Check all that apply.`
      : 'Check all certifications your organization currently holds',
  });

  fields.push({
    key:          'individual_certifications',
    label:        'Individual Certifications',
    type:         'textarea',
    required:     false,
    rfp_citation: null,
    placeholder:  'List certifications held by proposed personnel (e.g., CISSP, PMP, AWS SA Pro)',
  });

  // DoD 8570/8140 Certification Requirements — per-position blocking confirmations
  // When extraction detects specific mandatory certification requirements per position,
  // generate a blocking confirmation field for each position/cert combination.
  const certReqs = getExtractionValue<Array<{
    position_title: string;
    certifications: string[];
    iat_level?: string | null;
  }>>(extractions, 'key_personnel', 'certification_requirements');

  if (certReqs && Array.isArray(certReqs) && certReqs.length > 0) {
    for (const req of certReqs) {
      if (!req.position_title || !req.certifications || req.certifications.length === 0) continue;

      const certList = req.certifications.join(', ');
      const iatNote = req.iat_level ? ` (${req.iat_level})` : '';
      const fieldKey = `cert_${req.position_title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_confirmed`;

      fields.push({
        key:          fieldKey,
        label:        `${req.position_title}: Required Certifications Confirmed${iatNote}`,
        type:         'boolean',
        required:     true,
        blocking:     true,
        rfp_citation: buildCitation(extractions, 'key_personnel', 'certification_requirements'),
        placeholder:  `Confirm proposed ${req.position_title} holds: ${certList}${iatNote}`,
        validation:   {
          validation_hint: `RFP requires ${req.position_title} to hold: ${certList}${iatNote}. Proposal cannot proceed without confirmation.`,
        },
      });
    }
  }

  // Facility clearance — required when DD254 is required or clearance levels specified
  const clearanceRequired = dd254Required === true || dd254Required === 'true' || dd254Required === 'yes'
    || (clearanceLevels && clearanceLevels.length > 0);

  // Pre-fill from Tier 1 company intake: if company has confirmed clearance in intake,
  // auto-set the confirmation toggle and show their clearance level
  const companyHasClearance = companyData?.has_facility_clearance === true;
  const companyClearanceLevel = companyData?.clearance_level ?? null;

  // Extract the specific RFP-required clearance level for validation
  const rfpRequiredClearanceLevel = getExtractionValue<string>(
    extractions, 'security_reqs', 'required_facility_clearance_level'
  );

  // Build allowed clearance levels for validation: only levels >= RFP requirement
  const clearanceLevelOrder = ['Confidential', 'Secret', 'Top Secret', 'Top Secret/SCI'];
  let allowedLevels: string[] | undefined;
  if (rfpRequiredClearanceLevel) {
    const minIdx = clearanceLevelOrder.indexOf(rfpRequiredClearanceLevel);
    if (minIdx >= 0) {
      allowedLevels = clearanceLevelOrder.slice(minIdx);
    }
  }

  fields.push({
    key:           'facility_clearance_confirmed',
    label:         'Facility Clearance Confirmed',
    type:          'boolean',
    required:      !!clearanceRequired,
    blocking:      !!clearanceRequired,
    rfp_citation:  buildCitation(extractions, 'security_reqs', 'dd254_required'),
    default_value: companyHasClearance ? true : undefined,
    placeholder:   companyHasClearance && companyClearanceLevel
      ? `Company intake: ${companyClearanceLevel} clearance confirmed${clearanceLevels && clearanceLevels.length > 0 ? ` — RFP requires ${clearanceLevels[0]}` : ''}`
      : clearanceLevels && clearanceLevels.length > 0
        ? `Confirm facility clearance at ${clearanceLevels[0]} level or above`
        : 'Confirm facility clearance status',
  });

  // Facility clearance level — pre-filled from Tier 1 intake, required when RFP specifies clearance
  // Blocking: validates that submitted level meets the RFP requirement
  if (clearanceRequired || companyHasClearance) {
    const clearanceValidation: DataCallFieldValidation | undefined = allowedLevels
      ? {
          allowed_values: allowedLevels,
          validation_hint: `Clearance level must be ${rfpRequiredClearanceLevel} or higher (RFP requirement)`,
        }
      : undefined;

    fields.push({
      key:           'facility_clearance_level',
      label:         'Facility Clearance Level',
      type:          'select',
      required:      !!clearanceRequired,
      blocking:      !!clearanceRequired,
      validation:    clearanceValidation,
      rfp_citation:  buildCitation(extractions, 'security_reqs', 'clearance_levels'),
      options:       ['Confidential', 'Secret', 'Top Secret', 'Top Secret/SCI'],
      default_value: companyClearanceLevel ?? undefined,
      placeholder:   companyClearanceLevel
        ? `Company intake: ${companyClearanceLevel}${clearanceLevels && clearanceLevels.length > 0 ? ` — RFP requires: ${clearanceLevels.join(', ')}` : ''}`
        : clearanceLevels && clearanceLevels.length > 0
          ? `RFP requires: ${clearanceLevels.join(', ')}. Select your current level.`
          : 'Select your current facility clearance level',
    });
  }

  // Sponsoring agency — pre-filled from Tier 1 intake when clearance exists
  if ((clearanceRequired || companyHasClearance) && companyData?.sponsoring_agency) {
    fields.push({
      key:           'facility_clearance_sponsoring_agency',
      label:         'Sponsoring Agency',
      type:          'text',
      required:      false,
      rfp_citation:  null,
      default_value: companyData.sponsoring_agency,
      placeholder:   `Company intake: ${companyData.sponsoring_agency}`,
    });
  }

  // NIST 800-171 SPRS score — numeric with threshold validation
  // Blocking: system will not proceed to draft if RFP requires NIST compliance and score is missing/invalid
  const nistIsRequired = nistRequired === true || nistRequired === 'true' || nistRequired === 'yes';
  const sprsMinimum = getExtractionValue<number>(extractions, 'security_reqs', 'sprs_minimum_score');
  const sprsValidation: DataCallFieldValidation = {
    min: sprsMinimum ?? -203,  // SPRS scores range from -203 to 110
    max: 110,
    validation_hint: sprsMinimum
      ? `SPRS score must be at least ${sprsMinimum} (RFP threshold). Valid range: -203 to 110.`
      : 'SPRS score must be between -203 and 110',
  };

  fields.push({
    key:          'nist_800_171_score',
    label:        'NIST SP 800-171 SPRS Score',
    type:         'number',
    required:     nistIsRequired,
    blocking:     nistIsRequired,
    validation:   sprsValidation,
    rfp_citation: buildCitation(extractions, 'security_reqs', 'sprs_score'),
    placeholder:  sprsMinimum
      ? `RFP requires minimum score of ${sprsMinimum}. Enter your current SPRS score.`
      : 'Enter your SPRS self-assessment score (-203 to 110)',
  });

  // Retention rate — numeric percentage, blocking when RFP specifies a threshold
  const retentionRateRequired = getExtractionValue<number>(
    extractions, 'past_performance', 'retention_rate_required'
  );
  if (retentionRateRequired !== null && retentionRateRequired > 0) {
    fields.push({
      key:          'employee_retention_rate',
      label:        'Employee Retention Rate (%)',
      type:         'number',
      required:     true,
      blocking:     true,
      validation:   {
        min: retentionRateRequired,
        max: 100,
        validation_hint: `RFP requires minimum ${retentionRateRequired}% staff retention rate`,
      },
      rfp_citation: buildCitation(extractions, 'past_performance', 'retention_rate_required'),
      placeholder:  `RFP requires minimum ${retentionRateRequired}%. Enter your retention rate.`,
    });
  }

  // Required attachments — shown as informational checklist, NOT required uploads.
  // Proposal volumes (Technical, Management, PP, Cost, PWS, QASP, SSP, POA&M, resumes,
  // LOCs) are GENERATED by the system — they can't exist yet at data call time.
  // External docs (rate documentation, consent letters) are optional uploads here.
  const attachmentList: string[] = [
    ...(requiredAttachments && Array.isArray(requiredAttachments) ? requiredAttachments : []),
    ...(requiredForms && Array.isArray(requiredForms) ? requiredForms : []),
  ];

  // Attachments that the proposal generation system creates — never require upload
  const SYSTEM_GENERATED_PATTERNS = [
    /technical/i, /tech approach/i, /pws/i, /performance work statement/i,
    /qasp/i, /quality assurance/i, /system security plan/i, /plan of action/i,
    /management/i, /mgmt/i, /personnel volume/i, /past performance volume/i,
    /cost narrative/i, /cost proposal/i, /sanitized/i, /resume/i, /letter.*commitment/i,
    /loc\b/i, /dd.*254/i, /dd.*1423/i, /certifications.*representations/i,
  ];

  function isSystemGenerated(name: string): boolean {
    return SYSTEM_GENERATED_PATTERNS.some(p => p.test(name));
  }

  if (attachmentList.length > 0) {
    const seenKeys = new Set<string>();
    attachmentList.forEach((attachment) => {
      // Skip system-generated documents — resumes, technical volumes, org charts,
      // QASPs, security plans, LOCs, etc. are created by the proposal pipeline.
      // Only keep fields for attachments the client must actually provide.
      if (isSystemGenerated(attachment)) return;

      const fieldKey = `attachment_${attachment.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')}`;
      if (seenKeys.has(fieldKey)) return;
      seenKeys.add(fieldKey);

      fields.push({
        key:          fieldKey,
        label:        `Required Attachment: ${attachment}`,
        type:         'file',
        required:     false,
        rfp_citation: buildCitation(extractions, 'section_l', 'required_attachments'),
        placeholder:  `Upload ${attachment} (optional at this stage)`,
      });
    });
  } else {
    fields.push({
      key:          'attachment_other',
      label:        'Supporting Attachments (if any)',
      type:         'file',
      required:     false,
      rfp_citation: null,
      placeholder:  'Upload any required certifications, forms, or attachments',
    });
  }

  // Standards Implementation — conditional on extracted required_standards from technology_reqs
  const requiredStandards = getExtractionValue<Array<{ name: string; context: string }>>(
    extractions, 'technology_reqs', 'required_standards'
  );

  if (requiredStandards && Array.isArray(requiredStandards) && requiredStandards.length > 0) {
    const standardNames = requiredStandards.map(s => s.name).join(', ');
    fields.push({
      key: 'standards_implementation',
      label: 'Standards Implementation Confirmation',
      type: 'textarea' as const,
      required: false,
      blocking: false,
      rfp_citation: buildCitation(extractions, 'technology_reqs', 'required_standards'),
      placeholder: `Describe your implementation approach for required standards: ${standardNames}`,
    });
  }

  // CMMC Maturity Gap — conditional on extracted cmmc_level from security_reqs
  // (cmmcLevel already extracted at the top of this function)
  if (cmmcLevel) {
    fields.push({
      key: 'cmmc_maturity_status',
      label: `CMMC Level ${cmmcLevel} Readiness`,
      type: 'textarea' as const,
      required: false,
      blocking: false,
      rfp_citation: buildCitation(extractions, 'security_reqs', 'cmmc_level'),
      placeholder: `Current CMMC maturity level, target level ${cmmcLevel} readiness, remediation plan for any gaps, timeline to certification`,
    });
  }

  return {
    id:          'compliance_verification',
    title:       'Compliance Verification',
    description,
    fields,
  };
}

// ===== NEW SECTION BUILDERS (v2) =====

/**
 * Section 6: Service Area Approaches
 * One card per service area from SOW/PWS extraction service_area_index.
 * Pre-fills area code/name from extraction and includes extracted sub-requirements
 * and technologies in field descriptions.
 */
function buildServiceAreaApproachSection(
  extractions: ComplianceExtraction[]
): DataCallSection | null {
  // Read service area index from sow_pws extractions
  const serviceAreaIndex = getExtractionValue<Array<{ code: string; name: string; summary: string }>>(
    extractions, 'sow_pws', 'service_area_index'
  );

  if (!serviceAreaIndex || !Array.isArray(serviceAreaIndex) || serviceAreaIndex.length === 0) {
    return null; // No service areas extracted — skip this section
  }

  // Build description with service area names
  const areaNames = serviceAreaIndex.slice(0, 5).map(a => `${a.code} ${a.name}`).join(', ');
  const moreCount = serviceAreaIndex.length > 5 ? ` and ${serviceAreaIndex.length - 5} more` : '';
  const description = `Describe your approach for each of the ${serviceAreaIndex.length} service areas identified in the SOW/PWS: ${areaNames}${moreCount}. Each card is pre-filled with the area name and includes extracted requirements.`;

  // For each service area, look up its deep detail extraction
  const fields: DataCallFormField[] = [];
  for (const area of serviceAreaIndex) {
    // Try to find the detail extraction for richer field descriptions
    const detailRow = extractions.find(
      e => e.category === 'sow_pws' && e.field_name === `service_area_detail_${area.code}`
    );
    const detail = detailRow?.field_value as Record<string, unknown> | undefined;

    // Build rich placeholder from extracted details
    let approachPlaceholder = `Describe how you will deliver ${area.name}`;
    if (detail?.sub_requirements && Array.isArray(detail.sub_requirements)) {
      const reqCount = (detail.sub_requirements as Array<unknown>).length;
      approachPlaceholder += ` (${reqCount} requirements identified)`;
    }

    let toolsPlaceholder = 'Tools and platforms for this service area';
    if (detail?.required_technologies && Array.isArray(detail.required_technologies)) {
      const techNames = (detail.required_technologies as Array<{ name: string }>).map(t => t.name).join(', ');
      if (techNames) toolsPlaceholder = `RFP references: ${techNames}`;
    }

    let staffingPlaceholder = 'FTEs, roles, and staffing model';
    if (detail?.staffing_indicators && Array.isArray(detail.staffing_indicators)) {
      const indicators = (detail.staffing_indicators as Array<{ metric: string }>).map(s => s.metric).join('; ');
      if (indicators) staffingPlaceholder = `RFP indicators: ${indicators}`;
    }

    const citation = detailRow?.field_label ? makeCitation(detailRow.field_label) : makeCitation(`SOW/PWS ${area.code}`);

    // Always include the core approach field
    fields.push({
      key:          `sa_${area.code}_approach`,
      label:        `${area.code} — ${area.name}: Approach`,
      type:         'textarea',
      required:     true,
      rfp_citation: citation,
      placeholder:  approachPlaceholder,
    });

    // Only include tools field when RFP extraction found specific technologies
    if (detail?.required_technologies && Array.isArray(detail.required_technologies) && (detail.required_technologies as Array<unknown>).length > 0) {
      fields.push({
        key:          `sa_${area.code}_tools`,
        label:        `${area.code} — ${area.name}: Proposed Tools`,
        type:         'textarea',
        required:     false,
        rfp_citation: citation,
        placeholder:  toolsPlaceholder,
      });
    }

    // Only include staffing field when RFP extraction found staffing indicators
    if (detail?.staffing_indicators && Array.isArray(detail.staffing_indicators) && (detail.staffing_indicators as Array<unknown>).length > 0) {
      fields.push({
        key:          `sa_${area.code}_staffing`,
        label:        `${area.code} — ${area.name}: Proposed Staffing`,
        type:         'textarea',
        required:     false,
        rfp_citation: citation,
        placeholder:  staffingPlaceholder,
      });
    }

    // Differentiator removed — win themes come from the strategy builder, not data call
  }

  return {
    id:                  'service_area_approaches',
    title:               'Service Area Approaches',
    description,
    fields,
    dynamic_count:        serviceAreaIndex.length,
    dynamic_count_source: `${serviceAreaIndex.length} service areas identified from SOW/PWS extraction`,
  };
}

/**
 * Section 7: Site Staffing Plan
 * One card per site from operational_context extraction.
 * Pre-fills site name and location.
 */
function buildSiteStaffingSection(
  extractions: ComplianceExtraction[]
): DataCallSection | null {
  const sites = getExtractionValue<Array<{ name: string; abbreviation: string; location: string; description: string; is_primary: boolean }>>(
    extractions, 'operational_context', 'sites'
  );

  if (!sites || !Array.isArray(sites) || sites.length === 0) {
    return null; // No sites extracted — skip this section
  }

  // Include network info if available
  const networks = getExtractionValue<Array<{ name: string; classification: string }>>(
    extractions, 'operational_context', 'networks'
  );
  let description = `Provide staffing plans for each of the ${sites.length} site(s) identified in the solicitation.`;
  if (networks && Array.isArray(networks) && networks.length > 0) {
    const netNames = networks.map(n => `${n.name} (${n.classification})`).join(', ');
    description += ` Networks in use: ${netNames}.`;
  }

  const fields: DataCallFormField[] = [];
  for (const site of sites) {
    const siteLabel = site.abbreviation ? `${site.name} (${site.abbreviation})` : site.name;
    const citation = makeCitation(`Operational Context: ${siteLabel}`);

    fields.push(
      {
        key:           `site_${site.abbreviation || site.name.replace(/\s+/g, '_')}_fte`,
        label:         `${siteLabel}: Proposed FTE Count`,
        type:          'text',
        required:      true,
        rfp_citation:  citation,
        placeholder:   `Number of FTEs at ${siteLabel}`,
      },
      {
        key:          `site_${site.abbreviation || site.name.replace(/\s+/g, '_')}_roles`,
        label:        `${siteLabel}: Key Roles`,
        type:         'textarea',
        required:     true,
        rfp_citation: citation,
        placeholder:  `Key roles assigned to ${siteLabel} (e.g., Site Lead, 3 Network Engineers)`,
      },
      {
        key:          `site_${site.abbreviation || site.name.replace(/\s+/g, '_')}_reqs`,
        label:        `${siteLabel}: Special Requirements`,
        type:         'textarea',
        required:     false,
        rfp_citation: citation,
        placeholder:  `Clearance, on-site days, special access requirements for ${siteLabel}`,
      }
    );
  }

  return {
    id:                  'site_staffing',
    title:               'Site Staffing Plan',
    description,
    fields,
    dynamic_count:        sites.length,
    dynamic_count_source: `${sites.length} site(s) identified from operational context extraction`,
  };
}

/**
 * Section 8: Technology Selections
 * One card per required/mandatory technology from technology_reqs extraction.
 * Pre-fills technology name.
 */
function buildTechnologySelectionSection(
  extractions: ComplianceExtraction[]
): DataCallSection | null {
  const platforms = getExtractionValue<Array<{ name: string; category: string; context: string; requirement_level: string }>>(
    extractions, 'technology_reqs', 'required_platforms'
  ) || [];
  const infraPlatforms = getExtractionValue<Array<{ name: string; category: string; context: string }>>(
    extractions, 'technology_reqs', 'infrastructure_platforms'
  ) || [];

  // Filter to mandatory and current_environment technologies
  const requiredPlatforms = platforms.filter(
    p => p.requirement_level === 'mandatory' || p.requirement_level === 'current_environment'
  );

  // Combine with infrastructure platforms (which are implicitly current_environment)
  const allTechs = [
    ...requiredPlatforms.map(p => ({ name: p.name, category: p.category, context: p.context })),
    ...infraPlatforms.map(p => ({ name: p.name, category: p.category, context: p.context })),
  ];

  // Deduplicate by name
  const seen = new Set<string>();
  const uniqueTechs = allTechs.filter(t => {
    if (seen.has(t.name)) return false;
    seen.add(t.name);
    return true;
  });

  if (uniqueTechs.length === 0) {
    return null; // No required technologies — skip this section
  }

  const description = `Provide your experience and proposed usage for ${uniqueTechs.length} key technologies identified in the solicitation.`;

  const fields: DataCallFormField[] = [];
  for (const tech of uniqueTechs) {
    const techKey = tech.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const citation = makeCitation(`Technology Requirements: ${tech.name}`);

    fields.push(
      {
        key:          `tech_${techKey}_experience`,
        label:        `${tech.name} (${tech.category}): Company Experience`,
        type:         'textarea',
        required:     true,
        rfp_citation: citation,
        placeholder:  `Years of experience, number of deployments, team expertise with ${tech.name}. Context: ${tech.context}`,
      },
      {
        key:          `tech_${techKey}_usage`,
        label:        `${tech.name}: Proposed Usage`,
        type:         'textarea',
        required:     false,
        rfp_citation: citation,
        placeholder:  `How you will use ${tech.name} on this contract`,
      },
      {
        key:          `tech_${techKey}_certs`,
        label:        `${tech.name}: Certifications Held`,
        type:         'textarea',
        required:     false,
        rfp_citation: null,
        placeholder:  `Relevant certifications held by team members for ${tech.name}`,
      }
    );
  }

  return {
    id:                  'technology_selections',
    title:               'Technology Selections',
    description,
    fields,
    dynamic_count:        uniqueTechs.length,
    dynamic_count_source: `${uniqueTechs.length} key technologies identified from technology requirements extraction`,
  };
}

// ===== MAIN EXPORT =====

/**
 * Generate a dynamic data call form schema for the given solicitation.
 *
 * Queries compliance_extractions for all extractions belonging to the solicitation,
 * then builds a 5-section schema with RFP-specific field counts, pre-filled values,
 * and source citations.
 *
 * When companyId is provided, also fetches Tier 1 company intake data to pre-fill
 * fields like facility clearance level, NAICS code, certifications, and socioeconomic
 * designations — bridging the gap between Tier 1 intake and Tier 2 data call.
 *
 * Returns a best-effort schema using sensible defaults when extractions are
 * absent or incomplete. Never throws — errors are caught and logged.
 *
 * @param solicitationId  UUID of the solicitation to generate the schema for
 * @param companyId       Optional UUID of the company for Tier 1 pre-fill
 * @returns               DataCallFormSchema ready to be returned to the UI and cached
 */
export async function generateDataCallSchema(
  solicitationId: string,
  companyId?: string
): Promise<DataCallFormSchema> {
  const supabase = getServerClient();

  // Fetch all extractions for this solicitation
  const { data: extractions, error } = await supabase
    .from('compliance_extractions')
    .select(
      'id, solicitation_id, source_document_id, category, field_name, field_label, field_value, confidence, is_user_override, original_ai_value, extraction_status, error_message, created_at, updated_at'
    )
    .eq('solicitation_id', solicitationId)
    .eq('extraction_status', 'completed')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[data-call-generator] Failed to fetch extractions:', error);
  }

  const rows: ComplianceExtraction[] = extractions ?? [];

  // Fetch Tier 1 company intake data for pre-filling when companyId is available
  let companyData: CompanyIntakeData | null = null;
  if (companyId) {
    const { data: profile, error: profileError } = await supabase
      .from('company_profiles')
      .select(
        'has_facility_clearance, clearance_level, sponsoring_agency, cage_code_cleared, ' +
        'primary_naics, primary_naics_title, cage_code, ' +
        'iso_cmmi_status, socioeconomic_certs, business_size'
      )
      .eq('id', companyId)
      .maybeSingle();

    if (profileError) {
      console.error('[data-call-generator] Failed to fetch company profile:', profileError);
    }

    if (profile) {
      companyData = profile as CompanyIntakeData;
    }
  }

  // Fetch Tier 1 past performance and personnel counts for pre-fill hints
  let pastPerformanceCount = 0;
  let personnelCount = 0;
  if (companyId) {
    const [ppResult, persResult] = await Promise.all([
      supabase.from('past_performance').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('personnel').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    ]);
    pastPerformanceCount = ppResult.count ?? 0;
    personnelCount = persResult.count ?? 0;
  }

  // Build the core 5 sections + optional new sections
  // Pass company intake data to sections that benefit from Tier 1 pre-fill
  const sections: DataCallSection[] = [
    buildOpportunityDetailsSection(rows, companyData),
    buildPastPerformanceSection(rows, pastPerformanceCount),
    buildKeyPersonnelSection(rows, personnelCount),
    buildTechnicalApproachSection(rows),
    buildComplianceVerificationSection(rows, companyData),
  ];

  // Append new v2 sections when extraction data exists
  const serviceAreaSection = buildServiceAreaApproachSection(rows);
  if (serviceAreaSection) sections.push(serviceAreaSection);

  const siteStaffingSection = buildSiteStaffingSection(rows);
  if (siteStaffingSection) sections.push(siteStaffingSection);

  const techSelectionSection = buildTechnologySelectionSection(rows);
  if (techSelectionSection) sections.push(techSelectionSection);

  // SME Contributions — always present as the last section
  sections.push({
    id:          'sme_contributions',
    title:       'SME Contributions',
    description: 'Subject matter experts can add detailed technical narratives here. Approved contributions are injected directly into the AI generation prompt as authoritative source material.',
    fields:      [],
  });

  return {
    solicitation_id: solicitationId,
    generated_at:    new Date().toISOString(),
    sections,
  };
}
