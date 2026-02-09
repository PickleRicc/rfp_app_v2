# Roadmap: RFP Proposal Generator

## Overview

This roadmap completes full framework alignment for the RFP Proposal Generator, taking it from 70% to 100% compliance with the Proposal Response Generation Framework. The journey moves from visual polish (logos and branding) through professional styling (comprehensive text and table styles), to actual exhibit generation (org charts, diagrams, timelines), and culminates in production-ready output (page tracking, PDF export, quality checks, submission packages).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Logos & Branding** - Professional visual identity across all proposal documents
- [x] **Phase 2: Styles & Content** - Complete text styling and structured content sections
- [x] **Phase 3: Exhibit Generation** - Actual diagram generation (org charts, process flows, timelines)
- [ ] **Phase 4: Pipeline & Output** - Production-ready tracking, export, and packaging

## Phase Details

### Phase 1: Logos & Branding
**Goal**: Proposals have professional branding with company logos and solicitation information visible throughout
**Depends on**: Nothing (first phase)
**Requirements**: ARCH-02, ARCH-04, ARCH-05, FORMAT-04, FORMAT-05, FORMAT-06
**Success Criteria** (what must be TRUE):
  1. Company logo appears on cover page with professional placement and sizing
  2. Company logo appears in headers on every page after cover
  3. Solicitation number appears in headers alongside company name
  4. Proprietary notice appears in footers on every page
  5. Table of Contents auto-updates with field codes when user refreshes in Word
  6. Table of Exhibits is listed in TOC and auto-updates
**Plans**: 3 plans in 3 waves

Plans:
- [x] 01-01-PLAN.md — Foundation utilities (images.ts, toc.ts)
- [x] 01-02-PLAN.md — Header and footer generators
- [x] 01-03-PLAN.md — Generator integration with branding

### Phase 2: Styles & Content
**Goal**: Proposals use complete professional styling system and include deliverables/benefits sections
**Depends on**: Phase 1
**Requirements**: STYLE-02, STYLE-04, STYLE-06, STYLE-07, STYLE-08, CONTENT-05, CONTENT-06, TRACE-04
**Success Criteria** (what must be TRUE):
  1. Headings support Same Page, New Page, and Unnumbered variants per framework spec
  2. Emphasis styles (Bold Intro, Intense Quote, Intense Reference) are applied correctly in generated content
  3. Lists support 3-level bullets and numbered lists with 4 levels matching framework styles
  4. Tables use proper heading, body, bold, and centered variant styles
  5. Every task area includes a Deliverables subsection with structured output descriptions
  6. Every approach section includes a Benefits callout box highlighting value propositions
  7. Compliance matrix shows accurate page numbers (not TBD placeholders)
**Plans**: 6 plans (3 original + 3 gap closure) in 2 waves

Plans:
- [x] 02-01-PLAN.md — Complete styling system (heading variants, emphasis, lists, tables)
- [x] 02-02-PLAN.md — Deliverables subsections and Benefits callout boxes
- [x] 02-03-PLAN.md — Compliance matrix page number estimation
- [x] 02-04-PLAN.md — [GAP CLOSURE] Wire numbering configs, fix bullet style ID mismatch
- [x] 02-05-PLAN.md — [GAP CLOSURE] Apply heading variants and emphasis styles in templates
- [x] 02-06-PLAN.md — [GAP CLOSURE] Apply table styles in table generators

### Phase 3: Exhibit Generation
**Goal**: Proposals include actual generated diagrams (org charts, process flows, timelines) instead of placeholders
**Depends on**: Phase 2
**Requirements**: EXHIBIT-04, EXHIBIT-05, EXHIBIT-06, PIPE-05
**Success Criteria** (what must be TRUE):
  1. Org chart exhibits show actual team structure with names, roles, and reporting lines
  2. Process diagram exhibits visualize workflows with steps, decision points, and flows
  3. Timeline/Gantt chart exhibits display project phases with durations and milestones
  4. All exhibit references in text correspond to actual generated exhibits (no placeholders)
**Plans**: 4 plans (3 original + 1 gap closure) in 3 waves

Plans:
- [x] 03-01-PLAN.md — Diagram rendering infrastructure (cross-platform renderer, branding)
- [x] 03-02-PLAN.md — Refactor diagram generators (org-chart, process, timeline)
- [x] 03-03-PLAN.md — Integrate exhibits into document generator
- [x] 03-04-PLAN.md — [GAP CLOSURE] Verify exhibit cross-references in narrative text

### Phase 4: Pipeline & Output
**Goal**: System tracks page allocation, exports to multiple formats, and produces submission-ready packages
**Depends on**: Phase 3
**Requirements**: PIPE-02, OUTPUT-02, OUTPUT-04, OUTPUT-05, OUTPUT-06
**Success Criteria** (what must be TRUE):
  1. System tracks page counts per volume and warns when approaching RFP limits
  2. Proposals can be exported as PDF files ready for electronic submission
  3. Outline view export shows proposal structure for quick review
  4. Pre-submission quality checklist is auto-generated with framework compliance items
  5. Organized package structure creates folders for volumes, graphics, and final submissions
**Plans**: 5 plans in 3 waves

Plans:
- [ ] 04-01-PLAN.md — Page tracking with auto-condensing (PageTracker, ContentCondenser)
- [ ] 04-02-PLAN.md — PDF conversion via LibreOffice headless CLI
- [ ] 04-03-PLAN.md — Quality checklist generator and outline view
- [ ] 04-04-PLAN.md — Package builder with Framework Part 9.1 structure
- [ ] 04-05-PLAN.md — Pipeline integration and download UI

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Logos & Branding | 3/3 | Complete | 2026-02-02 |
| 2. Styles & Content | 6/6 | Complete | 2026-02-04 |
| 3. Exhibit Generation | 4/4 | Complete | 2026-02-06 |
| 4. Pipeline & Output | 0/5 | Planned | - |

---
*Roadmap created: 2026-02-02*
*Phase 2 planned: 2026-02-04*
*Phase 2 gap closure plans: 2026-02-04*
*Phase 3 planned: 2026-02-05*
*Phase 3 gap closure plan: 2026-02-06*
*Phase 4 planned: 2026-02-09*
