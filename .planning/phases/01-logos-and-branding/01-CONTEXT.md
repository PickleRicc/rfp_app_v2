# Phase 1: Logos & Branding - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Professional visual identity across all proposal documents. Company logos appear on cover page and headers, solicitation information is visible, proprietary notices are in footers, and Table of Contents uses dynamic field codes for auto-updating.

</domain>

<decisions>
## Implementation Decisions

### Logo Placement & Sizing
- Cover page logo: Top center, above the title block
- Cover page logo size: Moderate (1-1.5 inches) — professional but not dominant
- Header logo: Small logo on left side of header
- Logo source: Pull from company profile data in Supabase (logo URL field)

### Header/Footer Layout
- Cover page: No header or footer (clean cover, branding in body)
- Interior pages header: Small logo left, other elements per framework spec
- Interior pages footer: Proprietary notice + page numbers
- Page numbering: Cover is unnumbered, first numbered page is page 1 (TOC or cover letter)

### Proprietary Notice
- Text: Standard short format — "PROPRIETARY - Use or disclosure subject to restrictions"
- Styling: Small italic — subtle, doesn't distract from content
- Placement: Left side of footer

### TOC Content
- Table of Exhibits includes: Diagrams + tables (all visual elements with exhibit numbers)
- TOC depth and Table of Exhibits placement: Follow framework specification

### Claude's Discretion
- Header content layout (volume title placement, solicitation number position)
- Footer content arrangement
- TOC placement for Table of Exhibits
- Exact TOC heading depth (framework says 3 levels)
- Font sizes for header/footer elements

</decisions>

<specifics>
## Specific Ideas

- Logo should come from company profile data so different companies can have their own branding
- Cover page should be clean without header/footer clutter
- Proprietary notice should be present but not prominent

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-logos-and-branding*
*Context gathered: 2026-02-02*
