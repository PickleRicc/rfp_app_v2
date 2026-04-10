/**
 * Seed Data Call — auto-fills ALL data call fields for a solicitation using Claude.
 *
 * Usage:
 *   env $(cat .env | xargs) npx tsx scripts/seed-data-call.ts <solicitation_id> <company_id>
 *
 * What it does:
 *   1. Fetches the dynamic form schema (same as the UI does)
 *   2. Fetches the company profile + personnel + past performance from Tier 1
 *   3. Fetches compliance extractions for RFP context
 *   4. Calls Claude to generate realistic, RFP-specific answers for every section
 *   5. Saves via direct Supabase upsert (same shape as PUT /data-call)
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const solicitationId = process.argv[2];
const companyId = process.argv[3];

if (!solicitationId || !companyId) {
  console.error('Usage: npx tsx scripts/seed-data-call.ts <solicitation_id> <company_id>');
  process.exit(1);
}

async function main() {
  console.log(`\nSeeding data call for solicitation ${solicitationId} / company ${companyId}\n`);

  // 1. Fetch company profile + personnel
  const [
    { data: company },
    { data: personnel },
    { data: pastPerf },
    { data: certs },
    { data: solicitation },
  ] = await Promise.all([
    supabase.from('company_profiles').select('*').eq('id', companyId).single(),
    supabase.from('personnel').select('*').eq('company_id', companyId),
    supabase.from('past_performance').select('*').eq('company_id', companyId),
    supabase.from('certifications').select('*').eq('company_id', companyId),
    supabase.from('solicitations').select('*').eq('id', solicitationId).single(),
  ]);

  if (!company) { console.error('Company not found'); process.exit(1); }
  if (!solicitation) { console.error('Solicitation not found'); process.exit(1); }

  console.log(`Company: ${company.company_name}`);
  console.log(`Solicitation: ${solicitation.title}`);

  // 2. Fetch compliance extractions for RFP context
  const { data: extractions } = await supabase
    .from('compliance_extractions')
    .select('category, field_name, field_value')
    .eq('solicitation_id', solicitationId)
    .eq('extraction_status', 'completed');

  // Build a condensed RFP summary for Claude
  const extractionSummary: Record<string, Record<string, unknown>> = {};
  for (const row of extractions || []) {
    if (!extractionSummary[row.category]) extractionSummary[row.category] = {};
    extractionSummary[row.category][row.field_name] = row.field_value;
  }

  // 3. Generate the form schema (same as the API does)
  // We'll import the generator dynamically since it needs the Supabase server client
  const { generateDataCallSchema } = await import('../lib/ingestion/data-call-generator');
  const schema = await generateDataCallSchema(solicitationId, companyId);

  console.log(`\nSchema sections (${schema.sections.length}):`);
  for (const s of schema.sections) {
    console.log(`  ${s.id}: ${s.fields.length} fields`);
  }

  // 4. Build the prompt for Claude to fill all sections
  const prompt = `You are filling out a government proposal data call form for ${company.company_name} (${company.legal_name}).

COMPANY PROFILE:
- Overview: ${company.corporate_overview || 'N/A'}
- Core Services: ${company.core_services_summary || 'N/A'}
- Management Approach: ${company.standard_management_approach || 'N/A'}
- Win Themes: ${JSON.stringify(company.enterprise_win_themes || [])}
- Differentiators: ${company.key_differentiators_summary || 'N/A'}
- NAICS: ${company.primary_naics || 'N/A'}
- Clearance: ${company.has_facility_clearance ? `Yes, ${company.clearance_level}` : 'No'}
- Size: ${company.business_size || 'N/A'}
- Socioeconomic: ${JSON.stringify(company.socioeconomic_certs || [])}
- CAGE: ${company.cage_code || 'N/A'}
- UEI: ${company.uei_number || 'N/A'}

PERSONNEL (${(personnel || []).length}):
${JSON.stringify((personnel || []).map(p => ({ name: p.full_name, roles: p.proposed_roles })), null, 1)}

PAST PERFORMANCE (${(pastPerf || []).length}):
${(pastPerf || []).length > 0 ? JSON.stringify(pastPerf, null, 1) : 'None on file — GENERATE 3 realistic past performance references for an SDVOSB IT company with DoD IT operations experience. Make them specific and believable.'}

CERTIFICATIONS (${(certs || []).length}):
${(certs || []).length > 0 ? JSON.stringify(certs, null, 1) : 'None on file — the company likely holds ISO 27001, ISO 9001, and CMMI Level 3 based on their profile.'}

RFP CONTEXT (${solicitation.title}):
${JSON.stringify(extractionSummary, null, 1).slice(0, 8000)}

---

Generate a complete JSON response that fills ALL data call sections. The response must match this exact structure:

{
  "opportunity_details": {
    "prime_or_sub": "prime" or "sub",
    "teaming_partners": string[],
    "contract_type": string,
    "naics_code": string,
    "size_standard": string,
    "set_aside": string or null
  },
  "past_performance": [
    {
      "project_name": string,
      "client_agency": string,
      "contract_number": string,
      "contract_value": string (e.g., "$8.5M"),
      "period_of_performance": string (e.g., "2020-2025"),
      "performance_end_date": string (YYYY-MM-DD format, e.g., "2025-06-30"),
      "relevance_summary": string (2-3 sentences),
      "contact_name": string,
      "contact_email": string,
      "contact_phone": string
    }
    // Generate ${extractionSummary.past_performance?.references_required || 3} references
  ],
  "key_personnel": [
    {
      "name": string,
      "role": string,
      "qualifications_summary": string (detailed: education, years of experience, relevant certifications, clearance, specific project experience — 3-5 sentences),
      "clearance_level": string,
      "years_experience": number,
      "certifications": string
    }
  ],
  "technical_approach": {
    ${schema.sections.find(s => s.id === 'technical_approach')?.fields.map(f =>
      `"${f.key}": string  // ${f.label} — ${f.placeholder?.slice(0, 80) || ''}`
    ).join(',\n    ')}
  },
  "compliance_verification": {
    "org_certifications": { "iso_9001": true, "cmmi_3": true, "iso_27001": true },
    "individual_certifications": [string],
    "facility_clearance_confirmed": boolean,
    "facility_clearance_level": string or "",
    "facility_clearance_sponsoring_agency": string or "",
    "nist_800_171_score": string (number as string, e.g., "98"),
    "required_attachments": {}
    ${schema.sections.find(s => s.id === 'compliance_verification')?.fields
      .filter(f => !['org_certifications', 'individual_certifications', 'facility_clearance_confirmed', 'facility_clearance_level', 'facility_clearance_sponsoring_agency', 'nist_800_171_score', 'required_attachments'].includes(f.key))
      .map(f => `,"${f.key}": ${f.type === 'boolean' ? 'true' : `string  // ${f.label}`}`)
      .join('\n    ') || ''}
  },
  "service_area_approaches": [
    // One object per service area from schema. Fields:
    ${schema.sections.find(s => s.id === 'service_area_approaches')?.fields.slice(0, 4).map(f =>
      `"${f.key}": string`
    ).join(', ') || '{}'}
    // Generate ${schema.sections.find(s => s.id === 'service_area_approaches')?.dynamic_count || 0} entries
  ],
  "site_staffing": [
    // One object per site from schema
    ${schema.sections.find(s => s.id === 'site_staffing')?.fields.slice(0, 3).map(f =>
      `"${f.key}": string`
    ).join(', ') || '{}'}
    // Generate ${schema.sections.find(s => s.id === 'site_staffing')?.dynamic_count || 0} entries
  ],
  "technology_selections": [
    // One object per technology from schema
    ${schema.sections.find(s => s.id === 'technology_selections')?.fields.slice(0, 3).map(f =>
      `"${f.key}": string`
    ).join(', ') || '{}'}
    // Generate ${schema.sections.find(s => s.id === 'technology_selections')?.dynamic_count || 0} entries
  ]
}

RULES:
- Be specific and realistic for a DoD IT operations contract
- Past performance should be realistic DoD/federal IT ops contracts if none exist
- Technical approach must reference the actual SOW task areas
- Service area approaches must address each specific service area from the RFP
- All text should be proposal-quality — specific, quantified claims where possible
- Match the RFP's tone and requirements

KEY PERSONNEL RULES:
- Use ACTUAL personnel names from the company profile
- qualifications_summary must be detailed: education level, years of total and federal experience, relevant certifications (PMP, CISSP, etc.), clearance level, and 1-2 specific project experiences. This is the main field evaluators read.
- Map company personnel to the RFP's required positions. If the RFP requires a "Program Manager", use the company's PM.
- Resume files cannot be uploaded via this script — they must be uploaded through the UI.

Return ONLY the JSON object — no preamble, no explanation.`;

  console.log('\nCalling Claude to generate data call responses...');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Extract JSON from response (handle possible markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Failed to extract JSON from Claude response');
    console.error('Raw response:', text.slice(0, 500));
    process.exit(1);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Failed to parse JSON:', (e as Error).message);
    console.error('Raw JSON:', jsonMatch[0].slice(0, 500));
    process.exit(1);
  }

  console.log('\nGenerated sections:');
  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val)) {
      console.log(`  ${key}: ${val.length} items`);
    } else if (typeof val === 'object' && val) {
      console.log(`  ${key}: ${Object.keys(val).length} fields`);
    }
  }

  // 5. Upsert into data_call_responses
  const { data: upserted, error } = await supabase
    .from('data_call_responses')
    .upsert({
      solicitation_id: solicitationId,
      company_id: companyId,
      status: 'in_progress',
      opportunity_details: data.opportunity_details,
      past_performance: data.past_performance,
      key_personnel: data.key_personnel,
      technical_approach: data.technical_approach,
      compliance_verification: data.compliance_verification,
      service_area_approaches: data.service_area_approaches,
      site_staffing: data.site_staffing,
      technology_selections: data.technology_selections,
    }, {
      onConflict: 'solicitation_id,company_id',
    })
    .select('id, status')
    .single();

  if (error) {
    console.error('\nSupabase upsert error:', error);
    process.exit(1);
  }

  console.log(`\n✅ Data call seeded successfully!`);
  console.log(`   Response ID: ${upserted.id}`);
  console.log(`   Status: ${upserted.status}`);
  console.log(`\n   Open the app and refresh the Data Call tab to see the filled form.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
