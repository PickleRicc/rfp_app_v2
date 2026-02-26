# Phase 9: Draft Generation - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

User confirms strategy at a human gate, then receives a compliant first draft that follows the RFP's volume structure, addresses every evaluation factor, and respects all formatting constraints. Draft is built from Tier 1 corporate data, Tier 2 opportunity data, and extracted RFP requirements. Existing v1.0 DOCX generation and Proposal_Response_Generation_Framework.md are the foundation — this phase upgrades them to use the new multi-source data pipeline.

</domain>

<decisions>
## Implementation Decisions

### Strategy Confirmation Gate
- Read-only data summary screen showing prime/sub role, teaming partners, contract type, win themes, key personnel
- User cannot edit on this screen — "Back to Data Call" link sends them to the Data Call tab to make changes, then return
- "Confirm & Generate" starts generation immediately — no additional confirmation dialogs or time estimates
- User can re-generate the draft anytime — "Regenerate Draft" button replaces the old draft (no versioning)

### Draft Generation Experience
- Volume-by-volume progress display: checklist of volumes being generated, each updates as it completes
- In-app preview of each volume (rendered read-only) plus "Download DOCX" button
- Separate DOCX file per volume (Technical, Management, Past Performance, Price) — matches actual submission structure
- Accompanying outputs: compliance matrix (Excel, already exists from v1.0) plus whatever the Blueprint specifies
- Refer to ClicklessAI_Blueprint.md for the complete list of required deliverables

### Content Quality & Style
- Expert government proposal writer style: formal, compliance-focused, action verbs, "Impyrian shall/will" phrasing, mirrors evaluation criteria language
- Win themes woven via theme callout boxes at the start of each major section — evaluators see themes immediately
- Sparse data handled with [PLACEHOLDER: describe X] markers — user fills in during Word review
- Draft organized by Section L volume structure (what to submit), with Section M evaluation factor coverage mapped via compliance matrix

### Page Limit Handling
- AI targets 85-90% of page limit per volume during generation
- Page count estimated via word count heuristic (~250 words/page single-spaced, ~500 double-spaced)
- Page limit status displayed in each volume preview (bar at top) and in summary/download panel (all volumes at once)
- Over-limit volumes flagged with red warning — no auto-condensation, user edits in Word
- Color coding: green (under 85%), yellow (85-100%), red (over limit)

### Claude's Discretion
- Exact AI prompt engineering for each volume type
- How to structure the generation pipeline (parallel volumes vs. sequential)
- Template population approach for fill-in forms
- In-app preview rendering method (HTML, iframe, etc.)
- Compliance matrix format and coverage detail level

</decisions>

<specifics>
## Specific Ideas

- The existing Proposal_Response_Generation_Framework.md defines volume structure, section conventions, and style rules — this is the foundation, not a greenfield design
- v1.0 already has working DOCX generation with professional styling (TOC, headers/footers, exhibits, org charts) — upgrade to use new data sources, not rebuild
- Compliance matrix (Excel) exists from v1.0 — extend to map Section M eval factors to draft locations
- Win theme callout boxes already exist in v1.0 Phase 2 as "benefits callout boxes" — adapt this pattern

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-draft-generation*
*Context gathered: 2026-02-26*
