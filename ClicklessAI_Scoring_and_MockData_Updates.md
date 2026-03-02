# ClicklessAI — Scoring System & Mock Data Update Outline

**Based on:** Army TOR W911QX24R0005 test proposal analysis (4 iterations, 8 volumes)
**Scoring Priority:** Compliance first, human effort second
**Target:** ≤20% human time (16 hrs) across 10-day delivery window

---

## Impact Summary

| Category | False Penalties | % of Total | Fix Location |
|---|---|---|---|
| Mock data contamination | 6 | 31% (of non-real) | Test scripts |
| Scorer bugs | 8 | 18% (of non-real) | Scoring engine |
| Real tool bugs | 31 | 100% real | Generation engine |

14 of 45 total penalties are not real issues.

---

## PART 1: MOCK DATA FIXES

### 1.1 — Personnel Name Conflict [P0 CRITICAL]
- **Volumes affected:** Vol I, Vol II, Vol III, SSP
- **False penalties:** 6
- **Problem:** Test scripts populated the Key Personnel registry with Anderson/Patel/Rodriguez but the resume bundle and LOCs with Gonzalez/Park/Johnson. Scorer correctly detected the mismatch but attributed it to the tool.
- **Fix:** Use one consistent set of names across all test data inputs — personnel registry, resume files, LOC files, and any structured records referencing key personnel.
- **Validation:** Re-run scorer on same output. All 6 name-mismatch fabrication penalties should vanish.
- **Production implication:** Intake form should validate at submission time that every named person has a matching resume and LOC. Block submission if mismatched.

### 1.2 — User Population Count (3,500 vs 4,500) [P0 CRITICAL]
- **Volumes affected:** Vol I, Vol II
- **False penalties:** 2
- **Problem:** SOO says "approximately 3,500." Tool correctly used 3,500. Mock company data form was populated with 4,500. Scorer sided with company data and flagged the RFP-correct number as wrong.
- **Fix:** Update mock data to 3,500 matching the SOO.
- **Scoring implication:** Exposes need for data source hierarchy (see Part 2, item 2.6).

### 1.3 — ARO Location: Durham vs Research Triangle Park [P1]
- **Volumes affected:** Vol I, Vol II
- **False penalties:** 1–2 (ambiguous)
- **Problem:** Mock site data says "Research Triangle Park, NC." Tool wrote "Durham, NC" (possibly from general knowledge). SOO doesn't specify the exact city.
- **Fix:** Confirm which location the SOO appendix uses. Align mock data. Ensure tool always uses client-entered location verbatim over general knowledge.

---

## PART 2: SCORING SYSTEM FIXES

### 2.1 — Eliminate False Positive Fabrications [P0 CRITICAL]
- **Volume affected:** Vol III
- **False penalties:** 3
- **Problem:** Scorer flagged 11 fabrications in Vol III, then verified 3 were factually correct ("this matches. No error.") but still counted them.
- **Fix:** Add verification gate. After flagging a potential fabrication, cross-check against structured data. If claim matches → remove from fabrication list entirely. Log as "verified claim" for audit only. Never show verified-correct items in fabrication output.

### 2.2 — Eliminate Double-Counting (Fabrication + Placeholder) [P0 CRITICAL]
- **Volume affected:** Vol III
- **False penalties:** 4
- **Problem:** Contract type fields counted as BOTH a fabrication ("data exists but shows HUMAN INPUT") AND a placeholder. Same gap, two penalties.
- **Fix:** Each data gap = exactly one penalty. Rule: if item appears in both lists, keep in whichever is more severe, remove from the other.

### 2.3 — Split Fabrication Category Into Three Types [P1]
- **Volumes affected:** All

| Type | Definition | Example | Score Impact |
|---|---|---|---|
| **INCORRECT** | Tool used wrong data despite having correct data | 18 yrs "federal" when record says 14 yrs federal | High |
| **INCOMPLETE** | Tool had data but omitted part of it | CPARS listed 3 of 5 dimensions | Medium |
| **VERIFIED** | System flagged but data confirms claim is correct | 99.8% SOC uptime — confirmed accurate | Zero (remove) |

### 2.4 — Split Placeholder Category Into Two Types [P1]
- **Volumes affected:** All

| Type | Definition | Example | Score Impact |
|---|---|---|---|
| **AUTO-FILLABLE** | System has the data, tool didn't use it | CAGE code, contract type, recency calc | High (tool bug → dev backlog) |
| **LEGITIMATE** | Genuinely requires human input | UEI, CO contact info | Low–Medium (expected human task) |

### 2.5 — Deduplicate Same Bug Across Sections [P2]
- **Volume affected:** Vol II
- **Problem:** Rodriguez CISSP expiry flagged 3 times (Sections 3, 5, 8). One bug, three penalties.
- **Fix:** Count once per volume with location list. Remediation is one find-and-replace, not three tasks.

### 2.6 — Add Data Source Hierarchy [P1]
- **Problem:** When RFP data and company data conflict, scorer has no rule for which wins. It sided with company data for user count (wrong).
- **Fix:**

| Data Type | Primary Source | Secondary Source |
|---|---|---|
| Requirement facts (user counts, SLAs, site locations, page limits) | RFP extraction | Company form |
| Company facts (names, CAGE, certs, past performance, rates) | Company intake form | N/A (RFP won't have this) |
| Mixed facts (staffing levels, labor categories) | Company form validated against RFP | Flag conflict for human review |

### 2.7 — Add Compliance-Weighted Scoring Tiers [P0 CRITICAL]
- **Problem:** All deficiencies weighted roughly equally. But a page limit violation (instant rejection) is categorically different from omitting a CPARS dimension (minor weakness).
- **Fix:**

| Tier | Definition | Score Impact |
|---|---|---|
| **TIER 1: FATAL** | Would cause rejection before evaluation (page limit, missing volume, wrong format) | Auto-fail. Score capped at 30. |
| **TIER 2: DEFICIENCY** | Scored as Significant Weakness (missing eval factor section, name mismatch with resumes) | -15 to -25 per instance. 3+ = fail. |
| **TIER 3: WEAKNESS** | Scored as Weakness (missing SOO sub-objective, SLA without basis) | -5 to -10 per instance |
| **TIER 4: ENHANCEMENT** | Missed opportunity, no eval impact (omitted favorable CPARS, no confidence self-assessment) | -2 to -5 per instance |

### 2.8 — Add Human Effort Estimation [P1]
- **Rationale:** Score should predict how much work a human has to do, since that determines whether we hit the 7-day delivery.
- **Effort benchmarks:**

| Issue Type | Est. Hours | Who |
|---|---|---|
| Auto-fillable placeholder | 0 hrs | Dev fix (shouldn't exist) |
| Quick lookup (UEI, CO contact) | 0.25 hrs | Client / proposal mgr |
| Find-and-replace (wrong data) | 0.5 hrs | Proposal mgr |
| Missing paragraph (data available) | 0.5–1 hr | Writer or AI regen |
| Missing section (new content) | 1–3 hrs | Proposal writer |
| Missing visual (org chart) | 1–2 hrs | Writer + designer |
| Page limit compression | 1–4 hrs | Proposal editor |
| Name reconciliation (cross-volume) | 1–2 hrs | Proposal mgr |
| Cross-volume consistency audit | 2–4 hrs | Red team reviewer |

- **Pass/fail:** If any single volume > 16 hrs or full package > 40 hrs, flag for regeneration.

### 2.9 — Add Cross-Volume Consistency Scoring [P1]
- **Problem:** Scorer evaluates each volume independently. Biggest compliance risks were cross-volume: different names in Vol I vs Vol II, different labor categories, personnel appearing inconsistently.
- **Fix:** After individual scoring, run package-level consistency pass checking:
  1. Key personnel names identical across all volumes + match resumes/LOCs
  2. User count identical everywhere
  3. FTE count and site allocations consistent across Vol I, II, PWS, Vol IV
  4. Labor categories consistent (same titles, qualifications, FTE counts)
  5. SPRS score, CAGE, CMMI level, teaming % identical everywhere
  6. CDRL mappings consistent between Vol I, PWS, QASP
  7. Site names and locations identical in every volume
- Each inconsistency = Tier 2 (Deficiency) compliance issue.

---

## PART 3: REAL TOOL BUGS (Confirmed by Scorer)

These are legitimate issues the scoring system correctly caught. They'd occur with real client data.

### Compliance-Critical (P0–P1)

| Pri | Bug | Impact | Fix |
|---|---|---|---|
| P0 | Vol II exceeds 10-page limit | Non-responsive → rejected | Add page count estimator; warn at limits; compress or split |
| P0 | Missing Recruitment Plan (M.2.2) and Retention Plan (M.2.3) in Vol II | Significant Weakness on two evaluation subfactors | Add section generators using company data inputs |
| P0 | Section M eval factor names not used as headings | Evaluators can't trace scoring to factors | Extract factor names from RFP; use verbatim as section headings |
| P1 | Cert expiry not checked | Rodriguez CISSP expires mid-performance; undisclosed risk | Validate all certs against estimated contract start; flag if expiring within 12 months |
| P1 | Availability field not checked | Patel "2 Weeks Notice" but tool implies Day 1 | Check availability per person; adjust transition language |

### Quality Issues (P1–P3)

| Pri | Bug | Fix |
|---|---|---|
| P1 | CPARS outputs 3 of 5 dimensions (omits Management, Cost Control) | Output ALL available CPARS dimensions; never selectively omit |
| P1 | Auto-fillable data left as HUMAN INPUT | Post-generation auto-fill pass: check every placeholder against intake data |
| P2 | Experience field precision (total vs federal) | Map "federal experience" to federal_experience_years field specifically |
| P2 | Site count inconsistency (8 vs 7 vs 6 within same doc) | Derive once, store as variable, reference everywhere |
| P2 | Missing named technologies (HPRM, AllSight, Tanium) | Build named-technology checklist from SOW; cross-check after generation |
| P2 | No org chart visual in Vol II | Explore auto-generation from hierarchy data |
| P3 | Missing Small Business participation section (M.3.4) | Add SB generator using teaming data |
| P3 | Missing PPQ/Attachment 5 references in Vol III | Add boilerplate cross-references per Section L |

---

## PART 4: PROJECTED SCORES AFTER FIXES

### Current vs Corrected (Mock Data + Scorer Fixes Only)

| Volume | Current Score | After Mock Data Fix | After Scorer Fix | Remaining Real Issues |
|---|---|---|---|---|
| Vol I | 61 | ~72 (+11) | ~75 (+3) | CDRL format placeholders, eval factor headings, cert/availability checks |
| Vol II | 42 | ~58 (+16) | ~60 (+2) | Missing recruitment/retention plans, page limit, org chart |
| Vol III | 62 | ~65 (+3) | ~78 (+13) | Missing SB section, PPQ refs, CPARS completeness |

### After All Fixes (Mock Data + Scorer + Tool Bugs)

| Volume | Projected Score | Primary Remaining Work |
|---|---|---|
| Vol I | 88–92 | Client-specific data entry (eval factor mapping, format specs) |
| Vol II | 75–82 | Recruitment/retention plans need client labor market input |
| Vol III | 85–90 | CO contact info, UEI lookups (legitimate human tasks) |

---

## IMPLEMENTATION PRIORITY ORDER

1. **Fix mock data** (1–2 hours) — unblocks accurate testing of everything else
2. **Scorer: eliminate false positives and double-counting** (2.1, 2.2) — immediate accuracy improvement
3. **Scorer: add compliance tiers** (2.7) — fundamentally changes how scores map to submission risk
4. **Scorer: add data source hierarchy** (2.6) — prevents RFP vs company data conflicts
5. **Scorer: split fabrication and placeholder categories** (2.3, 2.4) — better signal for dev prioritization
6. **Scorer: add cross-volume consistency** (2.9) — catches the highest-impact compliance risks
7. **Scorer: add human effort estimation** (2.8) — enables 7-day delivery confidence
8. **Scorer: deduplicate** (2.5) — cleanup, lower priority
9. **Tool fixes** — work the P0→P3 backlog from Part 3
