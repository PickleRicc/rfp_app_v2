Got it. Here's the map:

---

# ClicklessAI Extraction Synonym Map — Federal Solicitation Terminology

**Purpose:** The AI extraction engine cannot rely on fixed labels like "Section L" or "Section M." Federal solicitations use wildly different naming conventions depending on the procurement vehicle, agency, and FAR part. The extraction must identify content by *function*, not by label. This map shows every critical extraction concept, every known name it goes by, and the signal keywords to pattern-match against.

---

## 1. INSTRUCTIONS TO OFFERORS (What to submit, how to format it, page limits, volumes)

**Canonical concept:** Submission Instructions

**Known labels across solicitation types:**

- **UCF / FAR Part 15 (full & open):** Section L — Instructions to Offerors
- **SeaPort NxG / IDIQ Task Orders:** "Task Order Proposal Content" or "Submission Instructions" (numbered sections, e.g., Section 3 and Section 4 in W911QX24R0005)
- **GSA Schedule / FAR 8.4:** "Instructions to Offerors and Provisions" or "Quotation Preparation Instructions" (e.g., Section 4 in 140D0423Q0370)
- **FAR Part 12 (Commercial):** Combined within 52.212-1 provisions, often untitled or labeled "Instructions to Offerors — Commercial Products"
- **Simplified Acquisition (FAR 13):** Often just a paragraph under "Submission Requirements" or embedded in the body of the solicitation with no section header at all
- **Navy/SeaPort TORs:** "Proposal Content" or "Task Order Proposal (TOP) Content"
- **Army-specific:** Often uses numbered sections (3.0, 4.0) with no L/M designation

**Signal keywords for pattern matching:**
`instructions to offerors`, `proposal content`, `submission instructions`, `quotation preparation`, `TOP content`, `shall submit`, `page limit`, `page limitation`, `volume`, `shall not exceed`, `file naming convention`, `shall be structured`, `electronic submission`, `due date`, `closing date`, `separate volumes`, `format requirements`, `font size`, `margin`, `shall include`, `shall provide`, `shall address`, `proposal shall`

**What to extract from this section:**
- Volume structure (how many volumes, what goes in each)
- Page limits per volume/section
- File naming conventions
- Format requirements (font, margins, file types accepted)
- Submission method (email, portal, CHESS)
- Deadline (date, time, timezone)
- What counts/doesn't count against page limits (resumes, LOCs, etc.)

---

## 2. EVALUATION CRITERIA (How the government will score/rank proposals)

**Canonical concept:** Evaluation Criteria

**Known labels across solicitation types:**

- **UCF / FAR Part 15:** Section M — Evaluation Factors for Award
- **SeaPort NxG / IDIQ Task Orders:** "Evaluation Criteria" (e.g., Section 5 in W911QX24R0005)
- **GSA Schedule / FAR 8.4:** "Evaluation of Quotations" or "Basis for Award" (e.g., Section 5 in 140D0423Q0370, referencing 52.212-2)
- **FAR Part 12 (Commercial):** Embedded in 52.212-2 "Evaluation — Commercial Products and Commercial Services"
- **Simplified Acquisition (FAR 13):** Usually a short paragraph, may just say "award will be based on best value" or "lowest price technically acceptable"
- **Army TORs:** "Factors to be Evaluated" as a subsection under Evaluation Criteria

**Signal keywords for pattern matching:**
`evaluation criteria`, `evaluation factors`, `factors to be evaluated`, `basis for award`, `award will be made`, `best value`, `tradeoff`, `trade-off`, `LPTA`, `lowest price technically acceptable`, `most important factor`, `more important than`, `when combined`, `significantly more important`, `rating`, `adjectival rating`, `outstanding`, `acceptable`, `marginal`, `unacceptable`, `confidence`, `substantial confidence`, `satisfactory confidence`, `evaluated favorably`, `evaluated unfavorably`, `strengths`, `weaknesses`, `deficiencies`, `will be evaluated`, `will assess`, `evaluated to determine`

**What to extract from this section:**
- Evaluation factors (names and order)
- Factor weighting / relative importance language
- Rating scale (adjectival: Outstanding/Good/Acceptable/Marginal/Unacceptable vs. color-coded vs. confidence ratings)
- Award methodology (best value tradeoff vs. LPTA)
- Minimum threshold for award (e.g., "must receive no less than Acceptable")
- Whether discussions are anticipated or award without discussions
- Sub-factors under each factor

---

## 3. STATEMENT OF WORK / REQUIREMENTS (What the contractor must actually do)

**Canonical concept:** Requirements Definition

**Known labels:**

- **UCF / FAR Part 15:** Section C — Description/Specifications/Statement of Work
- **SeaPort / IDIQ TORs:** Statement of Objectives (SOO) — *note: SOO ≠ SOW, the contractor generates the PWS from the SOO*
- **GSA Schedule:** Performance Work Statement (PWS) — usually an attachment
- **General:** SOW (Statement of Work), PWS (Performance Work Statement), SOO (Statement of Objectives), Technical Exhibit, Technical Requirements Document
- **Army-specific (W911QX24R0005):** SOO is Attachment 1, with a separate Technical Exhibit as Attachment 2. Contractor is required to *generate their own PWS* from the SOO.

**Critical distinction the AI must handle:**
- SOW = government tells contractor exactly what to do
- PWS = government defines performance outcomes, contractor proposes how
- SOO = government defines objectives, contractor proposes both the PWS and technical approach
- When the solicitation uses an SOO, the contractor-generated PWS becomes a deliverable/evaluated volume

**Signal keywords:**
`statement of work`, `SOW`, `performance work statement`, `PWS`, `statement of objectives`, `SOO`, `technical exhibit`, `scope of work`, `requirements`, `the contractor shall`, `task area`, `CLIN`, `contract line item`, `period of performance`, `place of performance`, `deliverables`

---

## 4. CLAUSES AND PROVISIONS (Legal/regulatory requirements)

**Canonical concept:** Contract Clauses & Provisions

**Known labels:**

- **UCF / FAR Part 15:** Section I — Contract Clauses; Section K — Representations, Certifications, and Other Statements of Offerors
- **SeaPort TORs:** Separate attachment, e.g., "Attachment 4 — Clauses, Local Clauses, Instructions"
- **GSA Schedule:** "Solicitation Provisions" within the main document body, plus FAR/DIAR provisions incorporated by reference
- **All types:** May reference FAR 52.xxx-xx clauses by number only, with "incorporated by reference" language

**Signal keywords:**
`clauses`, `provisions`, `FAR 52`, `DFARS 252`, `incorporated by reference`, `representations`, `certifications`, `Section K`, `Section I`, `full text`, `apply to this`, `shall comply with`

**What to extract:**
- Security requirements (DD254, clearance levels, NIST 800-171, CMMC)
- Key compliance clauses (small business utilization, organizational conflict of interest)
- Certifications the offeror must complete and submit
- Any clauses that impose proposal requirements (e.g., system security plan submission)

---

## 5. COST/PRICE PROPOSAL REQUIREMENTS

**Canonical concept:** Pricing Instructions

**Known labels:**

- **UCF / FAR Part 15:** Part of Section L, or a separate "Cost/Price Volume" instruction
- **SeaPort TORs:** Volume IV instructions within "Task Order Proposal Content" (e.g., Section 3.4 in W911QX24R0005)
- **GSA Schedule:** "Firm-Fixed Price Quote including Pricing Attachment" or "Price Quotation" volume
- **All types:** Usually references a government-furnished pricing template as an attachment

**Signal keywords:**
`cost proposal`, `price proposal`, `cost/price`, `cost narrative`, `pricing template`, `shall break out`, `labor categories`, `labor rates`, `travel`, `ODC`, `other direct costs`, `materials`, `subcontractor costs`, `indirect rates`, `fee`, `profit`, `cost realism`, `price reasonableness`, `FAR 15.408`, `Table 15-2`, `Excel format`, `formulas visible`

**What to extract:**
- Contract type (FFP, T&M, cost-reimbursement, hybrid)
- Whether a pricing template is provided (attachment name/number)
- Required cost breakout categories
- Whether cost realism or price reasonableness analysis applies
- Travel estimate instructions (government-furnished estimate vs. offeror-proposed)
- CLIN structure

---

## 6. PAST PERFORMANCE REQUIREMENTS

**Canonical concept:** Past Performance Instructions

**Known labels:**

- **UCF / FAR Part 15:** Part of Section L (instructions) + Section M (how it's evaluated)
- **SeaPort TORs:** "Volume III, Past Performance" (e.g., Section 3.3 in W911QX24R0005)
- **GSA Schedule:** "Volume II: Past Performance" with sub-instructions
- **All types:** May include a government-furnished Past Performance Questionnaire (PPQ) form as an attachment

**Signal keywords:**
`past performance`, `relevant experience`, `similar in scope`, `similar in magnitude`, `similar in complexity`, `within three years`, `within five years`, `recent and relevant`, `contract references`, `CPARS`, `PPQ`, `past performance questionnaire`, `major subcontractor`, `joint venture`, `confidence rating`, `unknown confidence`

**What to extract:**
- Number of references allowed (prime and subs)
- Recency requirement (e.g., within 3 years of TOR issue date)
- Relevance criteria (scope, magnitude, complexity, contract type)
- Required reference data fields (contract number, CO name, COR, dollar value, etc.)
- Whether subcontractor past performance is evaluated separately
- Page limits for past performance volume
- Government-furnished PPQ form (attachment name/number)

---

## 7. KEY PERSONNEL REQUIREMENTS

**Canonical concept:** Key Personnel / Staffing

**Known labels:**

- Embedded within technical volume instructions across all formats
- May appear in SOW/PWS, Section L, or as a standalone attachment (e.g., "Attachment 3 — List of Key Personnel")
- In SeaPort TORs, typically within the Technical Factor instructions

**Signal keywords:**
`key personnel`, `resume`, `resumes`, `letter of commitment`, `LOC`, `qualifications`, `certifications`, `DoD 8570`, `DoD 8140`, `clearance`, `secret`, `top secret`, `TS/SCI`, `years of experience`, `education requirement`, `degree`, `program manager`, `project manager`, `shall not count against page limit`

**What to extract:**
- Which positions are designated key personnel
- Required qualifications per position (certs, clearance, years of experience, education)
- Resume format requirements
- LOC requirements (what must be included, who signs)
- Whether resumes/LOCs count against page limits
- Labor category descriptions and minimum qualifications

---

## 8. MANAGEMENT / TRANSITION / STAFFING PLAN

**Canonical concept:** Management Approach

**Known labels:**

- **UCF / FAR Part 15:** Part of Section L technical volume instructions
- **SeaPort TORs:** Separate evaluated volume, e.g., "Volume II, Management (Factor 2)" in W911QX24R0005
- **GSA Schedule:** Usually folded into "Technical and Management Approach" as a single factor
- May be called: Management Plan, Staffing Plan, Transition Plan, Recruitment/Retention Plan

**Signal keywords:**
`management approach`, `organizational structure`, `org chart`, `transition plan`, `phase-in`, `recruitment plan`, `retention plan`, `staffing plan`, `backup personnel`, `replacement`, `vacant`, `30 days`, `turnover`, `labor market`, `subcontractor management`

---

## 9. SECURITY REQUIREMENTS

**Canonical concept:** Security / Clearance Requirements

**Known labels:**

- DD Form 254 (always an attachment when classified work involved)
- NIST SP 800-171 / CMMC requirements (in clauses or technical instructions)
- System Security Plan and Plan of Action (may be separate submission volumes)
- Facility Clearance Level (FCL) requirements

**Signal keywords:**
`DD 254`, `DD254`, `security classification`, `facility clearance`, `FCL`, `personnel clearance`, `NIST 800-171`, `CMMC`, `CUI`, `controlled unclassified`, `system security plan`, `SSP`, `plan of action`, `POA&M`, `SPRS`, `PIEE`, `assessment score`, `110`

---

## 10. ADMINISTRATIVE DATA (Solicitation metadata)

**Canonical concept:** Solicitation Identification

**Known labels:**

- Always on page 1 or cover page, but labeled differently:
  - "Task Order Request (TOR) Number" (SeaPort)
  - "Solicitation No." (GSA/civilian)
  - "RFP No." or "RFQ No." (general)
  - SF 1449 block entries (commercial)
  - SF 33 block entries (UCF)

**Signal keywords:**
`solicitation number`, `TOR number`, `RFP number`, `RFQ number`, `solicitation no`, `date of issue`, `NAICS`, `size standard`, `set-aside`, `women-owned`, `8(a)`, `HUBZone`, `SDVOSB`, `service-disabled`, `small business`, `unrestricted`, `full and open`, `issuing office`, `contracting officer`, `contract specialist`, `procurement history`

**What to extract:**
- Solicitation/TOR/RFQ number
- Issuing agency and office
- NAICS code and size standard
- Set-aside type
- Contract type (FFP, T&M, CR, IDIQ)
- Due date, time, and timezone
- Question deadline
- Contracting officer and contract specialist names/emails
- Procurement history (incumbent info, prior contract numbers, award amounts)

---

## 11. DELIVERABLES / CDRLs

**Canonical concept:** Contract Deliverables

**Known labels:**

- **DoD:** DD Form 1423 — Contract Data Requirements List (CDRL), usually a separate attachment per deliverable
- **Civilian:** Deliverables table within the SOW/PWS
- **All types:** May be embedded in the SOW/PWS text as "the contractor shall deliver/provide/submit"

**Signal keywords:**
`CDRL`, `DD 1423`, `deliverable`, `shall deliver`, `shall provide`, `shall submit`, `monthly report`, `status report`, `trip report`, `data item description`, `DID`, `frequency`, `distribution`

---

## 12. AMENDMENTS AND Q&A RESPONSES

**Canonical concept:** Solicitation Modifications

**Known labels:**

- "Amendment" (numbered, e.g., Amendment 0001)
- "Modification"
- "Questions and Answers" or "Government Responses" (may be a separate attachment, e.g., Attachment 7 in the Army TOR)
- Changes typically highlighted in yellow

**Critical extraction rule:** Amendments can change *anything* — due dates, evaluation criteria, page limits, requirements, clauses. The extraction engine must treat the latest amendment as authoritative and flag any conflicts with the base solicitation. When an amendment says a specific attachment is unchanged, the system should use the original. When it says an attachment has been amended, the system must use the new version.

**Signal keywords:**
`amendment`, `modification`, `changes highlighted`, `revised`, `updated`, `supersedes`, `previous iteration`, `no changes have been made`, `closing date has been extended`, `questions and answers`, `government response`

---

## CROSS-REFERENCE: HOW YOUR THREE EXAMPLES MAP

| Concept | Army TOR (W911QX24R0005) | METC RFQ (140D0423Q0370) | Navy SeaPort (N6449825R3017) |
|---|---|---|---|
| Instructions to Offerors | Sections 3 & 4: "TOP Content" + "Submission Instructions" | Section 4: "Instructions to Offerors and Provisions" | TBD — likely "Proposal Instructions" or similar numbered section |
| Evaluation Criteria | Section 5: "Evaluation Criteria" with "Factors to be Evaluated" | Section 5: "Evaluation of Quotations" via 52.212-2 | TBD — likely numbered evaluation section |
| Requirements | Attachment 1: SOO + Attachment 2: Technical Exhibit (contractor generates PWS) | Attachment 2: PWS (government-furnished) | Likely a PWS or SOW attachment |
| Clauses | Attachment 4: Clauses, Local Clauses, Instructions | Embedded in Sections 3 & 4 + FAR/DIAR provisions | Likely separate clauses attachment |
| Pricing | Section 3.4 + uses FAR 15.408 Table 15-2 Excel format | Attachment 1: Pricing Template (GSA rates) | Likely Attachment 7: Cost Summary Template |
| Past Performance | Section 3.3 + Attachment 5: PPQ | Volume II within main solicitation | Likely Attachment 6: Past Performance Reference |
| Security | DD254 (Attachment 3) + NIST 800-171 SSP/POA volumes | DD254 (Attachment 5) + NDA (Attachment 3) | DD254 (Attachment 2) + GFP with NMCI/NNPI laptops |

---

## IMPLEMENTATION GUIDANCE FOR THE DEV TEAM

**Rule 1: Never hard-code section labels.** The extractor should scan for functional content, not "Section L" or "Section M" strings.

**Rule 2: Build a keyword-weighted scoring system.** When the AI encounters a block of text, score it against the signal keywords for each concept. The highest-scoring concept is the classification.

**Rule 3: Handle multi-document solicitations.** The instructions, evaluation criteria, requirements, and clauses may live in separate PDFs, separate attachments, or all in one document. The system must ingest all documents in a solicitation package and cross-reference them.

**Rule 4: Amendments override base documents.** Always check for amendments. If an amendment exists, it is the authoritative source for any section it modifies.

**Rule 5: Extract the relationship between L and M.** The evaluation factors (M-equivalent) must map back to the submission requirements (L-equivalent). If Factor 1 is "Technical" and the instructions say the Technical volume has a 25-page limit, those two data points must be linked in the extraction output.

**Rule 6: Handle the SOO → contractor-generated PWS pattern.** When the solicitation provides an SOO (not a SOW/PWS), the system must flag that the contractor is expected to write their own PWS, which changes the entire proposal structure. This is common in SeaPort and Army task orders.

**Rule 7: Recognize attachment references.** When the body text says "see Attachment 3" or "utilize the format in Attachment 1," the system must resolve that reference to the actual file in the uploaded solicitation package.