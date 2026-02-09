# Phase 4: Pipeline & Output - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

System tracks page allocation, exports to multiple formats, and produces submission-ready packages. This phase completes the generation pipeline by adding page tracking with auto-condensing, PDF export, quality checklist automation, and organized package structure per Framework Parts 8-10.

</domain>

<decisions>
## Implementation Decisions

### Page Tracking & Limits
- Page limits stored where the generation system can access them (document/RFP metadata)
- System MUST comply with page limits — never breach if limits exist
- If content exceeds limit, AI automatically condenses content to fit
- Framework Part 8.2 logic: estimate pages, flag over/under, condense if needed

### PDF Export
- Use LibreOffice CLI (headless) for DOCX to PDF conversion
- Auto-generate PDF alongside DOCX on every generation (not on-demand)
- PDF versions go in Final_Submission/ folder per Framework Part 9.1

### Quality Checklist
- Follow Framework Part 10.1 exactly — four categories: COMPLIANCE, CONTENT, FORMATTING, FINAL_CHECKS
- Output format: Excel (Submission_Checklist.xlsx) per Framework Part 9.1 package structure
- Checklist items warn only, never block PDF generation
- Manual-review items handled at Claude's discretion (AI attempt with confidence, or mark for human review)

### Package Structure
- Follow Framework Part 9.1 PACKAGE_STRUCTURE exactly:
  ```
  /Proposal_[Solicitation#]/
    ├── Volume_I_Technical.docx
    ├── Volume_II_Management.docx
    ├── Volume_III_PastPerformance.docx
    ├── Volume_IV_Price.xlsx
    ├── Appendix_A_Resumes.docx
    ├── Appendix_B_Compliance_Matrix.xlsx
    ├── Graphics/
    │   ├── OrgChart.png
    │   ├── TransitionTimeline.png
    │   └── ProcessDiagram.png
    └── Final_Submission/
        ├── [PDF versions]
        └── Submission_Checklist.xlsx
  ```
- User downloads complete package as a zip file

### Claude's Discretion
- How to handle manual-review checklist items (AI attempt vs mark for human)
- Page estimation heuristics and condensing strategies
- LibreOffice configuration and quality settings
- Exact zip file naming convention

</decisions>

<specifics>
## Specific Ideas

- Framework Part 8.2 defines page checking: "If over: Flag for condensing; If under: Flag for expansion opportunities"
- Framework Part 9.1 defines exact package structure with Graphics/ and Final_Submission/ subfolders
- Framework Part 10.1 defines exact checklist items across 4 categories
- Outline view export for structure review (Framework Part 9.2 OUTLINE_VIEW)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-pipeline-and-output*
*Context gathered: 2026-02-08*
