# Phase 8: Tier 2 Dynamic Data Call - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

User is presented with an RFP-specific intake form — driven by what that particular RFP requires — and can complete it before draft generation begins. The form dynamically generates fields based on Phase 7 extraction results. Covers: opportunity details, past performance references, key personnel uploads, technical approach inputs, and compliance verification data. Draft generation itself is Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Form structure & navigation
- Accordion-based layout — all 5 sections (Opportunity Details, Past Performance, Key Personnel, Technical Approach, Compliance Verification) as collapsible panels on a single page
- All sections start collapsed; multiple can be open simultaneously
- Each section header shows a green checkmark when all required fields in that section are filled
- No enforced completion order — user works sections in whatever order they choose

### Dynamic field behavior
- Inline RFP citation on each dynamic field — small reference like "Per Section L.4.2" or extracted text snippet next to the field, so user understands why each field exists
- Dynamic counts (e.g., "3 past performance references") generate pre-numbered blank cards up front — all cards visible immediately
- When extraction didn't find a specific count, show a sensible default (e.g., 3 references) but let user add/remove entries freely
- Fields distinguished as "Required" or "Optional" based on what extraction flagged as mandatory vs. nice-to-have

### Save & resume flow
- Manual "Save Progress" button — no auto-save
- Field validation runs on submit (when user clicks "Complete Data Call"), not inline
- Allows saving partial/incomplete data without validation blocking
- Standard browser `beforeunload` confirm dialog when navigating away with unsaved changes
- On return, user lands on the same data call page with all sections collapsed; completed sections show checkmarks

### File uploads
- Inline upload per field — each key personnel card, certification field, or LOC slot has its own upload button
- Click-to-browse file picker (no drag-and-drop)
- Uploaded files show as filename + remove/replace button — no thumbnails or previews
- File type and size restrictions at Claude's discretion (sensible defaults for gov proposal context)

### Claude's Discretion
- Whether to include an overall summary/review panel before "Complete Data Call" button
- Exact file type whitelist and size limits
- Loading states and error message styling
- Accordion animation and transition details

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-tier2-dynamic-data-call*
*Context gathered: 2026-02-25*
