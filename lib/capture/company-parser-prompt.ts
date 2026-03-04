/**
 * AI Prompt — Company Data Parser
 *
 * Takes raw uploaded company documents (capability statements, past performance
 * summaries, company profiles, etc.) and extracts a structured profile that
 * can be used to search SAM.gov for matching opportunities.
 */

export interface CompanyParserInput {
  documents: Array<{ filename: string; text: string }>;
  /** If we already have a company profile from the database, include it */
  existingProfile?: {
    company_name?: string;
    primary_naics?: string;
    socioeconomic_certs?: string[];
    business_size?: string;
    corporate_overview?: string;
    core_services_summary?: string;
    headquarters_state?: string;
    headquarters_zip?: string;
    clearance_level?: string;
  };
}

export function assembleCompanyParserPrompt(input: CompanyParserInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are an expert federal government contracting business development analyst. Your task is to analyze company data and extract a structured profile that will be used to search for matching federal contract opportunities on SAM.gov.

You must extract the following from the provided documents:
1. **NAICS Codes** — All relevant 6-digit NAICS codes the company operates under
2. **Set-Aside Codes** — Socioeconomic certifications (8(a), HUBZone, SDVOSB, WOSB, EDWOSB, SBA small business, etc.)
3. **Keywords** — 5-10 highly specific keywords that describe the company's core services (used for title search on SAM.gov)
4. **Capabilities Summary** — A 2-3 sentence summary of what the company does
5. **Agency Experience** — Federal agencies the company has worked with
6. **Contract Vehicles** — Any GWAC, BPA, IDIQ, or GSA Schedule mentions
7. **Clearance Level** — Facility or personnel security clearance levels
8. **Business Size** — Small Business, Other Than Small, Large
9. **Location** — Headquarters state and zip code

MAP CERTIFICATIONS TO SAM.GOV SET-ASIDE CODES:
- "8(a)" or "SBA 8(a)" → "8A"
- "HUBZone" → "HZC"
- "Service-Disabled Veteran" or "SDVOSB" → "SDVOSBC"
- "Women-Owned" or "WOSB" → "WOSB"
- "Economically Disadvantaged Women-Owned" or "EDWOSB" → "EDWOSB"
- "Small Business" or "SB" → "SBA"
- If no specific set-aside, but they're a small business → "SBA"

For KEYWORDS: Generate the most specific, contract-relevant terms. Think about what a contracting officer would put in a solicitation title. Examples: "cybersecurity", "cloud migration", "IT staffing", "facilities management", "software development", "data analytics", "help desk support".

RESPONSE FORMAT — Return a single JSON object (no markdown wrapping):
{
  "company_name": "<string>",
  "naics_codes": ["<6-digit code>", ...],
  "set_aside_codes": ["<SAM code>", ...],
  "keywords": ["<keyword>", ...],
  "capabilities_summary": "<2-3 sentences>",
  "agency_experience": ["<agency name>", ...],
  "contract_vehicles": ["<vehicle name>", ...],
  "clearance_level": "<None|Public Trust|Secret|Top Secret|TS/SCI>",
  "business_size": "<Small|Other Than Small|Large>",
  "location": { "state": "<2-letter state code>", "zip": "<5-digit zip>" }
}

Be thorough — capture every NAICS code and certification mentioned. When in doubt, include it. The more search parameters we have, the better we can match opportunities.`;

  let userPrompt = '';

  // Include existing profile data if available
  if (input.existingProfile) {
    const ep = input.existingProfile;
    userPrompt += `=== EXISTING COMPANY PROFILE DATA ===\n`;
    if (ep.company_name) userPrompt += `Company Name: ${ep.company_name}\n`;
    if (ep.primary_naics) userPrompt += `Primary NAICS: ${ep.primary_naics}\n`;
    if (ep.socioeconomic_certs?.length) userPrompt += `Socioeconomic Certs: ${ep.socioeconomic_certs.join(', ')}\n`;
    if (ep.business_size) userPrompt += `Business Size: ${ep.business_size}\n`;
    if (ep.corporate_overview) userPrompt += `Corporate Overview: ${ep.corporate_overview}\n`;
    if (ep.core_services_summary) userPrompt += `Core Services: ${ep.core_services_summary}\n`;
    if (ep.headquarters_state) userPrompt += `HQ State: ${ep.headquarters_state}\n`;
    if (ep.headquarters_zip) userPrompt += `HQ Zip: ${ep.headquarters_zip}\n`;
    if (ep.clearance_level) userPrompt += `Clearance: ${ep.clearance_level}\n`;
    userPrompt += '\n';
  }

  // Include uploaded documents
  userPrompt += `=== UPLOADED COMPANY DOCUMENTS ===\n\n`;
  for (const doc of input.documents) {
    userPrompt += `--- ${doc.filename} ---\n`;
    const truncated = doc.text.length > 40000
      ? doc.text.slice(0, 40000) + '\n\n[TRUNCATED — document exceeds 40,000 characters]'
      : doc.text;
    userPrompt += truncated + '\n\n';
  }

  userPrompt += `\n=== INSTRUCTION ===\nAnalyze all the company data above and extract a structured profile as a JSON object matching the schema described in your instructions. Identify ALL NAICS codes, certifications, and capabilities mentioned.\n`;

  return { systemPrompt, userPrompt };
}
