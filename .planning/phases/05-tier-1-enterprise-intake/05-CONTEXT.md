# Phase 5: Tier 1 Enterprise Intake - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

One-time enterprise onboarding form that captures stable corporate data (identity, vehicles/certifications, capabilities/positioning). This data persists across all proposals for a given customer. Replaces the existing company profiles page. Must be complete before user can start an RFP.

Tier 2 (per-RFP) data collection, multi-document ingestion, and proposal generation are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Form Structure
- Tabbed interface with 3 tabs: Corporate Identity, Vehicles & Certifications, Capabilities & Positioning
- Save per tab — each tab has its own Save button, changes held until user explicitly saves that tab
- Users can switch between tabs freely without losing unsaved changes on the current tab

### Onboarding Flow
- Replaces existing company profiles page entirely (not a separate page)
- Mandatory gate: user must complete Tier 1 for their company before uploading any RFP
- "Complete" means all fields necessary for highest-quality output are filled — reverse-engineer required fields from what the blueprint says produces winning proposals
- Always editable after initial onboarding — changes apply to future proposals, not already-generated ones
- No proposal pipeline linkage in this phase — just about capturing and editing enterprise data

### Data Model
- Extend existing `company_profiles` table in Supabase (add new columns for Tier 1 fields)
- Additive migration — keep existing data intact, map existing fields to Tier 1 equivalents
- No data loss during migration

### Claude's Discretion
- Text field format for longer fields (rich text vs plain textarea) — decide based on how data flows into proposal generation
- List field input patterns (add/remove rows vs multi-select chips vs hybrid) — decide based on whether values are standardized or freeform per the blueprint
- JSON arrays vs separate tables for list-type fields (vehicles, certifications) — decide based on query patterns and downstream generation needs
- UEI/NAICS validation behavior (inline vs on-save) and SAM.gov cross-reference implementation
- Which specific fields are marked required vs optional — reverse-engineer from blueprint's Tier 1 module table and what produces the best proposal output
- Min/max word counts for capability text fields

</decisions>

<specifics>
## Specific Ideas

- Blueprint §4.1 defines exact Tier 1 modules and fields — use as the source of truth for form fields
- The 3 tab modules map directly to blueprint: Corporate Identity | Vehicles & Certifications | Capabilities & Positioning
- Blueprint explicitly warns: do NOT include past performance libraries or resume banks in Tier 1 (those are Tier 2, per-opportunity)
- Existing `company_profiles` table already has fields like company name and logo URL that should map naturally

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-tier-1-enterprise-intake*
*Context gathered: 2026-02-23*
