---
phase: 09-draft-generation
plan: 03
subsystem: ui
tags: [react, tailwind, next.js, draft-generation, proposal-ui]

# Dependency graph
requires:
  - plan: 09-01
    provides: DraftGetResponse type, GET/POST /api/solicitations/[id]/draft endpoints, draft-types.ts
  - plan: 09-02
    provides: Inngest pipeline that writes volume content and updates draft status

provides:
  - StrategyConfirmation component (read-only strategy gate with Confirm & Generate)
  - DraftGenerationView component (strategy/generating/complete state machine)
  - Draft tab in solicitation detail page

affects:
  - app/solicitations/[id]/page.tsx (Draft tab added)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - State machine pattern for view transitions (strategy → generating → complete)
    - setInterval polling with cleanup on unmount via pollingRef + useEffect return
    - Inline markdown renderer without external library (headings, bold, bullets, table rows)
    - Page limit progress bar with green/yellow/red color coding matching CONTEXT.md spec

key-files:
  created:
    - app/components/draft/StrategyConfirmation.tsx
    - app/components/draft/DraftGenerationView.tsx
  modified:
    - app/solicitations/[id]/page.tsx

key-decisions:
  - "DraftGenerationView holds the view state machine — StrategyConfirmation is a pure display component that calls onGenerationStarted callback"
  - "Polling uses useRef for interval ID (not useState) — avoids stale closure issues and enables reliable cleanup"
  - "SimpleMarkdown renderer handles headings/bold/bullets/table rows inline without a markdown library — keeps bundle lean"
  - "Back to Data Call uses onTabChange prop threaded from page.tsx through DraftGenerationView to StrategyConfirmation"

requirements-completed: [DRAFT-01, DRAFT-05]

# Metrics
duration: 4min
completed: 2026-02-26
---

# Phase 9 Plan 03: Draft Tab UI Summary

**Draft generation UI: strategy confirmation gate, volume progress display, page limit bars, volume preview with inline markdown renderer, DOCX download, and compliance matrix — wired into solicitation detail page as a new Draft tab**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-26T02:16:59Z
- **Completed:** 2026-02-26T02:21:00Z
- **Tasks:** 2 of 3 complete (Task 3 = checkpoint:human-verify, awaiting user)
- **Files modified:** 3

## Accomplishments

- Created `StrategyConfirmation.tsx` (280 lines): reads GET /api/solicitations/[id]/draft, renders read-only summary in 6 cards (Opportunity Overview, Win Themes, Volume Structure, Evaluation Factors, Key Personnel, Past Performance count), shows Confirm & Generate button (POST trigger) or Regenerate Draft button if draft exists, with Back to Data Call link that calls onTabChange prop
- Created `DraftGenerationView.tsx` (430 lines): state machine managing strategy/generating/complete views; 3-second polling via setInterval + useRef cleanup; GeneratingView with volume checklist and per-volume status icons; CompleteView with summary bar, VolumeCards with page limit bars (green/yellow/red), expandable markdown preview (SimpleMarkdown), DOCX download buttons, compliance matrix section, and Regenerate button
- Updated `app/solicitations/[id]/page.tsx`: imported DraftGenerationView, added Draft tab (Send icon) after Data Call tab, rendered DraftGenerationView with onTabChange prop for cross-tab navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: StrategyConfirmation and DraftGenerationView components** - `509170a` (feat)
2. **Task 2: Add Draft tab to solicitation detail page** - `926b147` (feat)

**Task 3:** Checkpoint:human-verify — awaiting user verification

## Files Created/Modified

- `app/components/draft/StrategyConfirmation.tsx` — read-only strategy confirmation screen with Confirm & Generate
- `app/components/draft/DraftGenerationView.tsx` — full draft generation state machine with polling, progress, preview, download
- `app/solicitations/[id]/page.tsx` — Draft tab added with DraftGenerationView integration

## Decisions Made

- DraftGenerationView holds view state machine, StrategyConfirmation is a pure display component — clean separation of state management from display
- Polling uses `useRef` for interval ID rather than `useState` to avoid stale closure bugs and enable clean unmount cleanup
- Simple inline markdown renderer (no markdown library) handles the common patterns (headings, bold, bullets, table rows) found in generated volume content
- `onTabChange` prop is threaded from page.tsx → DraftGenerationView → StrategyConfirmation to enable "Back to Data Call" without lifting state to page level

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in route handlers (params need await in Next.js 16) are documented in STATE.md and were not caused by this plan.

## Self-Check: PASSED

- `app/components/draft/StrategyConfirmation.tsx` — FOUND (280+ lines, includes Confirm & Generate and Regenerate Draft)
- `app/components/draft/DraftGenerationView.tsx` — FOUND (430+ lines, includes state machine, polling, volume cards, compliance matrix)
- `app/solicitations/[id]/page.tsx` — FOUND (contains DraftGenerationView, Send icon, Draft tab)
- Commit `509170a` — FOUND (Task 1)
- Commit `926b147` — FOUND (Task 2)
- No TypeScript errors in new files (confirmed via tsc --noEmit --skipLibCheck filtered output)

---
*Phase: 09-draft-generation*
*Completed: 2026-02-26*
