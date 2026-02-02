import { getServerClient } from '@/lib/supabase/client';

/**
 * Boilerplate Management (Framework Part 7)
 * Manages reusable boilerplate content for proposals
 */

export interface BoilerplateContent {
  id: string;
  type: string;
  variant?: string;
  content: string;
}

/**
 * Fetch boilerplate content for a specific section type
 */
export async function getBoilerplate(
  companyId: string,
  sectionType: string,
  variant?: string
): Promise<BoilerplateContent | null> {
  const supabase = getServerClient();

  let query = supabase
    .from('boilerplate_library')
    .select('*')
    .eq('company_id', companyId)
    .eq('type', sectionType);

  if (variant) {
    query = query.eq('variant', variant);
  }

  const { data, error } = await query.limit(1).single();

  if (error || !data) {
    return null;
  }

  return data as BoilerplateContent;
}

/**
 * Merge boilerplate with AI-generated content
 * Strategy: Use AI for RFP-specific content, boilerplate for generic sections
 */
export async function mergeBoilerplate(
  sectionType: string,
  aiGeneratedContent: string,
  companyId: string,
  variant?: string
): Promise<string> {
  const boilerplate = await getBoilerplate(companyId, sectionType, variant);

  if (!boilerplate) {
    return aiGeneratedContent;
  }

  // Merge strategy depends on section type
  switch (sectionType) {
    case 'company_intro':
      // Boilerplate first, then AI adds RFP-specific context
      return `${boilerplate.content}\n\n${aiGeneratedContent}`;

    case 'quality_approach':
      // AI-generated approach first, boilerplate adds detail
      return `${aiGeneratedContent}\n\n${boilerplate.content}`;

    case 'risk_management':
      // Combine both with transition
      return `${aiGeneratedContent}\n\nOur proven risk management framework includes:\n\n${boilerplate.content}`;

    case 'security_procedures':
      // Boilerplate is primary for security/compliance
      return `${boilerplate.content}\n\n${aiGeneratedContent}`;

    default:
      // Default: AI content with boilerplate as supporting detail
      return `${aiGeneratedContent}\n\n${boilerplate.content}`;
  }
}

/**
 * Get all boilerplate sections for a company
 */
export async function getAllBoilerplate(
  companyId: string
): Promise<BoilerplateContent[]> {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('boilerplate_library')
    .select('*')
    .eq('company_id', companyId)
    .order('type');

  if (error || !data) {
    return [];
  }

  return data as BoilerplateContent[];
}

/**
 * Common boilerplate section types
 */
export const BOILERPLATE_TYPES = {
  COMPANY_INTRO: 'company_intro',
  QUALITY_APPROACH: 'quality_approach',
  RISK_MANAGEMENT: 'risk_management',
  SECURITY_PROCEDURES: 'security_procedures',
  CYBERSECURITY: 'cybersecurity',
  DATA_PROTECTION: 'data_protection',
  ETHICAL_STANDARDS: 'ethical_standards',
  CORPORATE_STRUCTURE: 'corporate_structure',
  FACILITIES: 'facilities',
  IT_INFRASTRUCTURE: 'it_infrastructure',
  TRAINING_APPROACH: 'training_approach',
  LESSONS_LEARNED: 'lessons_learned',
} as const;

/**
 * Boilerplate variants (length variations)
 */
export const BOILERPLATE_VARIANTS = {
  SHORT: 'short', // 1-2 paragraphs
  MEDIUM: 'medium', // 3-4 paragraphs
  LONG: 'long', // 5+ paragraphs, detailed
} as const;

/**
 * Recommend boilerplate based on section and page limits
 */
export function recommendBoilerplateVariant(
  sectionType: string,
  availablePages: number
): string | undefined {
  if (availablePages <= 1) {
    return BOILERPLATE_VARIANTS.SHORT;
  } else if (availablePages <= 3) {
    return BOILERPLATE_VARIANTS.MEDIUM;
  } else {
    return BOILERPLATE_VARIANTS.LONG;
  }
}

/**
 * Compliance language patterns (Framework Part 6.1)
 */
export function applyComplianceLanguage(
  requirement: any,
  response: string
): string {
  // Transform "shall" to "will"
  const companyResponse = response.replace(
    /The contractor shall/gi,
    'We will'
  ).replace(
    /Contractor shall/gi,
    'We will'
  );

  // Add explicit compliance statement for mandatory requirements
  if (requirement.priority === 'mandatory') {
    return `${companyResponse}\n\nThis approach fully complies with ${requirement.requirement_number}.`;
  }

  return companyResponse;
}

/**
 * Generate understanding-then-approach pattern (Framework Part 6.1)
 */
export function generateUnderstandingApproachPattern(
  requirement: string,
  approach: string
): string {
  return `We understand that ${requirement.toLowerCase()}. ${approach}`;
}
