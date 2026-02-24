# Phase 6: Multi-Document Ingestion - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

User can upload an entire solicitation package (10-20+ files: PDF, DOCX, XLSX) and the system produces a unified, reconciled requirement set with no outdated language carried forward. Documents are auto-classified by type, amendments reconcile against base documents, Q&A modifications are tracked, and fillable templates have their required fields mapped.

</domain>

<decisions>
## Implementation Decisions

### Upload Experience
- Drag-and-drop zone for bulk file upload (multiple files at once)
- Solicitation number auto-detected from uploaded documents — system scans files and pre-fills, user confirms or corrects
- Per-file progress list during upload — each file shows its own status (uploading, processing, classified)
- All files in a batch are expected to work; failures are flagged clearly with error messages but processing continues for valid files

### Document Classification UX
- Table view with colored type badges showing detected document type (base RFP, SOO/SOW/PWS, amendment, Q&A, pricing template, DD254, clauses, CDRLs, wage determination, provisions)
- Dropdown to reclassify — click the type badge to select correct type if misclassified
- Only flag low-confidence classifications with a warning icon — don't show confidence for every file
- Unknown/unrecognized documents labeled as 'Other/Unclassified' with prompt to classify via dropdown

### Amendment Reconciliation
- Inline strikethrough for superseded text with a link/tag to the amendment that replaced it — shows history in context
- Users can override reconciliation with undo/restore action — click to restore superseded text or reject an amendment's change
- Chain view for multi-amendment evolution: Original → Amend 1 → Amend 2, with only the latest version active — full audit trail
- Q&A responses that modify requirements use the same reconciliation mechanism but tagged as 'Q&A-sourced' for clear provenance

### Template & Form Detection
- Fillable templates highlighted in document list with a 'Fillable' badge — click to see required fields mapped out
- Required fields listed with data type hints: field name, expected format (text, number, date), and whether it maps to data already available
- 'Action Required' tag for forms the user must fill out, 'Reference Only' tag for reference documents (wage determinations, etc.)
- System suggests auto-populated values from other uploaded docs (solicitation number, agency name, etc.) — user reviews and confirms pre-fills

### Claude's Discretion
- Exact visual design and spacing of upload drop zone
- Progress animation and timing details
- Classification algorithm thresholds and confidence scoring internals
- Reconciliation diff algorithm implementation
- Template field extraction approach

</decisions>

<specifics>
## Specific Ideas

- Classification should cover the full government solicitation document taxonomy: base RFP, SOO/SOW/PWS, amendment, Q&A, pricing template, DD254, clauses, CDRLs, wage determination, provisions
- Amendment chain view should make it dead simple to see what the "current truth" is for any given section
- The upload-to-classified table transition should feel fast and automatic — user drops files and sees results populate

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-multi-document-ingestion*
*Context gathered: 2026-02-23*
