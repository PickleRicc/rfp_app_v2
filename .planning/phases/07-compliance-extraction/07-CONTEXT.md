# Phase 7: Compliance Extraction - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

After document ingestion and classification (Phase 6), the system automatically extracts all compliance obligations from uploaded RFP documents — Section L (instructions to offerors), Section M (evaluation criteria), admin data, and rating scales — and displays them in a structured, editable UI. This phase delivers extraction + display. The Tier 2 data call that consumes this data is Phase 8.

</domain>

<decisions>
## Implementation Decisions

### Extraction Display Layout
- New "Compliance" tab on the solicitation detail page (alongside Documents, Reconciliation, Templates)
- Accordion sections for each extraction category: Section L, Section M, Admin Data, Rating Scales
- Section L data displayed as structured table (columns: Volume Name, Page Limit, Format, Required Attachments)
- Section M evaluation factors displayed as indented tree with colored weight badges (e.g., "Most Important" in green, "Equal" in blue). Subfactors indented below parent factors
- Admin data and rating scales: Claude's discretion on exact format (table or key-value pairs as appropriate)

### Confidence & Editability
- Color-coded confidence indicators on extracted values: green border = high confidence, amber = medium, red = low/uncertain
- Click-to-edit inline: click any extracted value to edit in place, saves immediately
- Edited values get a "User Override" badge to distinguish manual corrections from AI extractions
- Missing values show gray italic "Not found" placeholder — user can click to manually add the value
- Per-section "Re-extract" button on each accordion section — re-runs extraction for just that category
- Re-extract preserves user overrides with confirmation prompt

### Extraction Trigger & Timing
- Auto-extract immediately after document classification completes (no manual trigger needed)
- Use Inngest background job pipeline (matches Phase 6 upload/classification pattern)
- Compliance tab shows skeleton loaders with accordion structure while processing
- Each section updates independently as extraction completes (Section L ✔ while Section M still loading)
- If extraction fails for a section: show empty section with explanation ("No data found — this document may not contain Section M content") with options for manual entry and retry

### Amendment Impact
- When amendments change compliance values: strikethrough on original value + new value beside it, with "Amendment X" source badge (matches reconciliation tab pattern)
- Auto re-extract affected sections when new amendments are uploaded and classified
- Show "Updated from Amendment X" notification on Compliance tab after re-extraction
- Preserve user overrides with conflict flag: "You edited this — amendment may have changed it. Review?" User can accept new value or keep their override
- Inline change indicators: each changed value shows a small "Changed in Amd X" badge (no separate change log)

### Claude's Discretion
- Admin data display format (table vs key-value pairs)
- Rating scales visualization approach
- Exact skeleton loader design
- Error state styling details
- Inngest function naming and step granularity

</decisions>

<specifics>
## Specific Ideas

- Strikethrough + new value pattern for amendments should visually match the reconciliation tab from Phase 6 — consistent visual language across the app
- Confidence color-coding (green/amber/red borders) should align with the classification confidence indicators from Phase 6
- The accordion structure should default to all sections expanded on first load, so users see everything at a glance

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-compliance-extraction*
*Context gathered: 2026-02-24*
