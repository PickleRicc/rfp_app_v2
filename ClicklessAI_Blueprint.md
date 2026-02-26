# CLICKLESSAI — Product Development Blueprint

**Two-Tier Data Intake & RFP Response System**

---

**Prepared by:** ClicklessAI Product Team
**Consultant Input:** Mary Morris, Enterprise Proposal Manager
**Date:** February 2026
**Status:** INTERNAL – Development Milestone

---

## 1. Executive Summary

This blueprint defines the development roadmap for upgrading ClicklessAI's proposal generation tool from prototype to production-grade quality. It incorporates direct feedback from our enterprise proposal management consultant, Mary Morris, and maps her recommendations against three sample RFP packages provided for system testing.

The blueprint addresses two critical workstreams that must be resolved before we can begin servicing paying customers:

- **Data Intake Architecture** – How we collect customer information (two-tier approach: enterprise foundation vs. RFP-specific data calls)
- **RFP Ingestion & Compliance Extraction** – How we parse multi-document solicitation packages, track amendments, and extract evaluation criteria
- **Proposal Draft Generation** – How we produce submission-ready content that meets Section L/M requirements

**Achieving production quality on these workstreams is the single most important milestone standing between ClicklessAI and revenue-generating customer engagements.**

---

## 2. Consultant Feedback Summary

Mary Morris identified five core architectural recommendations and one critical testing requirement. Each is summarized below with its implications for our development priorities.

### 2.1 Two-Tier Data Intake Architecture

The central recommendation is to separate customer data collection into two distinct tiers, rather than attempting to collect everything during onboarding. This mirrors how real proposal shops operate and reduces friction for new customers.

| Tier 1: Enterprise Foundation (One-Time) | Tier 2: RFP-Specific Data Call (Per-Bid) |
|---|---|
| Legal entity name, UEI/CAGE, primary NAICS | Prime/Sub role confirmation |
| Business size & socioeconomic certifications | Teaming partners |
| Active contract vehicles | Contract type (FFP/T&M/CPFF) |
| ISO / CMMI / ITIL status | NAICS size confirmation for this opportunity |
| Facility clearance level | Past performance references (number per RFP) |
| DCAA approved systems | Key personnel resumes & certifications |
| Corporate overview & core services | Clearance confirmation for proposed staff |
| Enterprise win themes & differentiators | Summary of technical approach |
| Standard management & transition approach | Tools/platforms, assumptions, risks |

### 2.2 Automated RFP Analysis & Extraction (The Filter)

Upon RFP upload, the system must automatically parse the solicitation and extract structured requirements from three categories: Section L submission instructions (volumes, page limits, required attachments, forms), Section M evaluation factors (factors/subfactors, LPTA vs. tradeoff logic, experience thresholds, key personnel requirements), and administrative data (NAICS code, size standard, set-aside designation). This extraction drives what the Tier 2 data call asks the customer to provide.

### 2.3 Multi-Document Solicitation Ingestion

This is a critical testing requirement. Federal solicitations are never a single document. A typical package includes the base RFP, a performance work statement, pricing templates, past performance forms, clauses/provisions, Q&A responses, DD254 security forms, wage determinations, and one or more formal amendments. The system must ingest all of these, reconcile amendments against original language, and prevent outdated requirements from carrying forward into draft generation.

### 2.4 Human Confirmation Gate

Before draft generation begins, the system must present the customer with a strategy validation checkpoint. This confirms prime/sub role, teaming partners, contract type, and NAICS size standard. No draft should be generated without this human confirmation step, preserving compliance integrity.

### 2.5 Scope Boundaries

Tier 1 explicitly does NOT include the full past performance library or resume bank. These are dynamic, opportunity-specific assets that belong in Tier 2. Attempting to collect them at onboarding adds friction and many companies don't maintain structured libraries of these assets.

---

## 3. Sample RFP Test Packages

Mary provided three solicitation packages from different agencies. Below is our inventory of available documents organized by solicitation, with a mapping to which system capabilities each package tests.

### 3.1 Test Case A: ARL IT Services (Seaport-NxG Task Order)

*Agency: U.S. Army Research Laboratory (ARL) via Seaport-NxG IDIQ*

This is the most complex test case. It involves a contractor-generated PWS requirement, a CPFF contract type, multiple CLINs across base + 4 option years, and a formal amendment that modifies evaluation language.

| Document | Type | Role |
|---|---|---|
| formal_task_order_request_w911qx24r0005.pdf | Base TOR | Core RFP |
| formal_task_order_request_w911qx24r0005_amendment_0001.pdf | Amendment 1 | Override |
| attachment_1__statement_of_objectives_soo.pdf | SOO (Original) | Scope |
| attachment_1__statement_of_objectives_soo_amendment_0001.pdf | SOO (Amended) | Scope Override |
| attachment_2__technical_exhibit_to_soo.pdf | Technical Exhibit | Requirements |
| attachment_4__clauses_local_clauses_instructions_amendment_0001.xlsx | Clauses & Instructions | Compliance |
| attachment_7__formal_tor_questions_summary_sheet__government_response.xlsx | Q&A Responses | Clarifications |
| Attachment_1_GFP_Attachment.pdf | GFP Inventory | Reference |
| Attachment_2_SIGNED_DD254.pdf | Security Classification | Clearance Req |
| Attachment_3_List_of_Key_Personnel.docx | Key Personnel Template | Staffing |
| Attachment_4_Subcontractors.xlsx | Subcontractor Template | Teaming |
| Attachment_5_Staffing_Plan_Seaport.xlsx | Staffing Plan Template | Pricing/Labor |
| Attachment_6_Past_Performance_Reference_Seaport.docx | Past Perf Template | Past Perf |
| Attachment_7_Cost_Summary_Template.xlsx | Cost Summary Template | Pricing |
| CDRL_A001 through CDRL_A007 (7 documents) | Contract Data Req Lists | Deliverables |

**Key Testing Value:** Tests multi-document ingestion (18+ files), amendment reconciliation (base TOR vs. amendment 0001, original SOO vs. amended SOO), contractor-generated PWS requirement, CPFF pricing across multiple CLINs, Q&A integration, and template-based form filling.

### 3.2 Test Case B: METC C4/IT Services (GSA Schedule)

*Agency: METC (Military Education & Training Campus) via GSA MAS 54151HEAL*

This solicitation is a best-value tradeoff procurement under FAR 8.4 as a women-owned small business set-aside. It tests the system's ability to handle GSA-specific submission rules.

| Document | Type | Role |
|---|---|---|
| 140D0423Q0370_Solicitation_METC_Amend_1.pdf | Base Solicitation + Amend 1 | Core RFP |
| QA_140D0423Q0370_Amendment_II.pdf | Q&A + Amendment 2 | Clarifications |
| 140D423Q0370_Attachment_2_PWS.pdf | Performance Work Statement | Scope |
| 140D0423Q0370_Attachment_1_Pricing_Template.xlsx | Pricing Template | Pricing |
| 140D0423Q0370_Attachment_3_NDA.pdf | Non-Disclosure Agreement | Compliance |
| 140D0423Q0370_Attachment_4_WD.pdf | Wage Determination | Pricing/Labor |
| 140D0423Q0370_Attachment_5_DD254.pdf | Security Classification | Clearance Req |
| 140D0423Q0370_Attachment_6_Travel_Auth_Form.xlsx | Travel Authorization | Admin |
| Provisions.pdf | Representations & Certs | Compliance |

**Key Testing Value:** Tests GSA schedule-specific rules, women-owned small business set-aside handling, page limit changes via amendment (25 pages expanded to 75 pages in Amendment II Q&A), volume structure reconciliation (Q&A clarified 3 volumes vs. original ambiguity), and tradeoff evaluation methodology.

### 3.3 Test Case Prioritization

We recommend running Test Case A (ARL Seaport) first because it exercises every capability the system needs: multi-document ingestion, amendment tracking, contractor-generated PWS, complex CLIN structures, and the most attachments/templates. Test Case B (METC) should follow as it tests different procurement rules (GSA vs. Seaport) and a different evaluation methodology.

---

## 4. System Architecture Update Plan

Based on the consultant feedback and test case analysis, the following development work is required across five workstreams.

### 4.1 Workstream 1: Enterprise Foundation Data Call (Tier 1)

Build a one-time onboarding intake form that captures stable corporate data. This information persists across all proposals for a given customer.

| Module | Data Fields | Validation Required |
|---|---|---|
| **Corporate Identity** | Legal entity name, UEI, CAGE, primary NAICS, business size, socioeconomic certs | UEI format check; NAICS lookup; SAM.gov cross-reference |
| **Vehicles & Certifications** | Active contract vehicles, ISO/CMMI/ITIL status, facility clearance, DCAA systems | Vehicle validation against known lists; clearance level enumeration |
| **Capabilities & Positioning** | Corporate overview, core services, enterprise win themes, key differentiators, standard mgmt approach | Min/max word counts; completeness checks |

> ⚠️ **Critical design note:** Do NOT include past performance libraries or resume banks in Tier 1. These are per-opportunity assets that belong exclusively in Tier 2.

### 4.2 Workstream 2: Multi-Document RFP Ingestion Engine

This is the highest-complexity development item. The system must accept an entire solicitation package (not a single PDF) and produce a unified, reconciled requirement set.

| Capability | Description | Priority |
|---|---|---|
| **Multi-file upload** | Accept 10-20+ files per opportunity (PDF, DOCX, XLSX). Group by solicitation number. | 🔴 P0 - Must Have |
| **Document classification** | Auto-detect document type: base RFP, SOO/SOW/PWS, amendment, Q&A, pricing template, DD254, clauses, CDRLs, wage determination, provisions. | 🔴 P0 - Must Have |
| **Amendment reconciliation** | Compare base documents against amendments. Flag superseded language. Ensure latest version controls. Track change history. | 🔴 P0 - Must Have |
| **Q&A integration** | Parse government Q&A responses. Identify answers that materially modify scope, page limits, evaluation criteria, or submission instructions. | 🔴 P0 - Must Have |
| **Template extraction** | Identify fillable templates (staffing plans, cost summaries, past perf forms) and map required fields. | 🟠 P1 - High |
| **Version tracking** | Maintain document version lineage. Display which amendment/Q&A changed which requirement. | 🟠 P1 - High |

### 4.3 Workstream 3: AI-Powered Compliance Extraction (The Filter)

Once the solicitation package is ingested and reconciled, the system must automatically extract structured compliance data in three categories.

| Category | Extracted Fields | Example from Test Cases |
|---|---|---|
| **Section L (Submission)** | Volume structure, page limits per volume, required attachments, forms & certs, formatting rules | ARL: 4 volumes (Tech, Mgmt, Past Perf, Cost). METC: 3 volumes (Tech 75pg, Past Perf 10pg, Price 10pg) |
| **Section M (Evaluation)** | Factors & subfactors, evaluation methodology (LPTA vs. tradeoff), experience thresholds, key personnel requirements, relevancy definitions | ARL: Tech > Mgmt > Past Perf > Cost. METC: Best value tradeoff, minimum Acceptable rating on all non-price factors |
| **Admin Data** | NAICS code, size standard, set-aside designation, contract type, period of performance, CLIN structure | ARL: NAICS 541519, CPFF, base + 3 options + FAR 52.217-8. METC: MAS 54151HEAL, WOSB set-aside |

### 4.4 Workstream 4: RFP-Specific Data Call (Tier 2)

After the AI extraction step, the system auto-generates a tailored data request to the customer. The data call fields are driven by what the RFP requires, not a static template.

| Data Call Module | Fields (Dynamic Based on RFP) | Example: ARL Test Case |
|---|---|---|
| **Opportunity Confirmation** | Prime/Sub, teaming partners, contract type, NAICS size confirmation | Prime; NAICS 541519; CPFF; identify subcontractors performing 10%+ of effort |
| **Past Performance** | Number of projects required, scope summaries, period of performance, contract value, outcomes & relevance | 3 contracts for prime, 3 per major sub; within 3 years of TOR date; relevancy rated Very Relevant to Not Relevant |
| **Key Personnel** | Resume uploads, certifications, clearance confirmation, Letters of Commitment | DoD 8570.01-M certs required on award; LOC on offeror letterhead signed by employer and employee |
| **Technical Inputs** | Summary of approach, tools/platforms, staffing model, assumptions, risks & mitigations | Contractor-generated PWS required; QASP with cost control, resource control, schedule metrics |
| **Compliance Verification** | Required org certs, individual certs, facility clearance, NIST 800-171 score, required attachments | NIST SP 800-171 score of 110+ in SPRS; DFARS 252.204-7012 compliance; DD254 |

### 4.5 Workstream 5: Draft Generation Engine

With Tier 1 enterprise data, Tier 2 opportunity-specific data, and extracted compliance requirements all in hand, the system generates a compliant first draft. The draft must be structured to mirror the volume organization specified in Section L, address every evaluation factor in Section M, and comply with all formatting constraints (page limits, font sizes, margin requirements).

For Test Case A (ARL), this means generating:

- Volume I: Technical Approach with contractor-generated PWS, QASP, labor category tables, and NIST 800-171 compliance documentation
- Volume II: Management plan with organizational structure, retention plan, recruitment approach, and transition plan
- Volume III: Past performance narratives mapped to relevancy criteria (Very Relevant, Relevant, Somewhat Relevant)
- Volume IV: Cost/price proposal in Excel with breakout by CLIN, option year, and cost element
- Required attachments: staffing plan, cost summary, subcontractor forms, past performance references, key personnel list

---

## 5. Development Phasing & Milestones

| Phase | Deliverable | Test Validation | Status Gate |
|---|---|---|---|
| **Phase 1** | Tier 1 Enterprise Intake Form: Build onboarding UI that captures all enterprise foundation fields | Populate Tier 1 for a mock company and verify all fields persist across sessions | All Tier 1 fields captured and stored |
| **Phase 2** | Multi-Document Ingestion: Accept full solicitation packages, classify documents, reconcile amendments | Upload all 18+ ARL files. Verify system classifies each, identifies amendment changes, reconciles SOO versions | ARL package fully ingested with no data loss |
| **Phase 3** | AI Compliance Extraction: Auto-extract Section L, Section M, and admin data from reconciled package | Compare extracted requirements against manual analysis of ARL TOR. Validate volume structure, eval factors, page limits, key personnel reqs | 95%+ extraction accuracy on test cases |
| **Phase 4** | Tier 2 Dynamic Data Call: Auto-generate RFP-specific intake based on extraction results | Verify data call for ARL asks for 3 past perf refs, DoD 8570 certs, LOCs, contractor-generated PWS | Data call matches RFP requirements |
| **Phase 5** | Draft Generation: Produce compliant first draft from combined Tier 1 + Tier 2 + extraction data | Generate ARL Volume I draft. Verify compliance matrix coverage, page limit adherence, correct volume structure | Draft passes consultant quality review |
| **Phase 6** | Second Test Case: Run METC solicitation through complete pipeline end-to-end | Verify system handles GSA-specific rules, WOSB set-aside, different volume structure, Q&A-driven page limit changes | Both test cases pass end-to-end |

---

## 6. Acceptance Criteria for Production Readiness

The system is considered production-ready when all of the following criteria are met:

1. **Multi-document ingestion:** System accepts 10+ files per solicitation and correctly classifies each document type.
2. **Amendment reconciliation:** System identifies superseded language and uses only the latest requirements for extraction and draft generation.
3. **Q&A integration:** Government Q&A responses that modify scope, page limits, or evaluation criteria are reflected in extraction output.
4. **Section L extraction:** Volume structure, page limits, required attachments, and formatting requirements are correctly identified.
5. **Section M extraction:** All evaluation factors, subfactors, and rating scales are captured with correct relative weightings.
6. **Tier 1 data persists:** Enterprise foundation data collected once is available for all subsequent proposals.
7. **Tier 2 data call is dynamic:** RFP-specific intake form fields vary based on what the RFP actually requires (number of past perf refs, specific cert requirements, etc.).
8. **Human confirmation gate:** No draft generation begins without customer confirmation of prime/sub role, teaming, and strategy.
9. **Draft compliance:** Generated draft follows correct volume structure, respects page limits, and addresses all evaluation factors.
10. **Template handling:** System identifies required fill-in templates (staffing plans, cost summaries, past perf forms) and maps data to correct fields.

---

## 7. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Single-document assumption in current tool | High: System cannot process real-world solicitations | Confirmed: Current design assumes single PDF input | Phase 2 addresses this directly |
| Amendment language is inconsistently structured across agencies | Medium: AI extraction may miss amendment changes | High: Every agency formats amendments differently | Test against both ARL and METC amendment styles; build amendment detection heuristics |
| Excel template formats vary significantly | Medium: Template auto-fill may break | Medium: Staffing plans and cost templates differ per solicitation | Map templates per solicitation rather than assuming standard formats |
| Customers lack structured past perf libraries | Medium: Tier 2 data collection slows down | High: Many small contractors use ad hoc methods | Provide structured input forms with guided prompts; allow free-text fallback |
| Over-collecting data at onboarding reduces adoption | High: Customers abandon onboarding | Medium: Without two-tier separation | Tier 1 is lightweight by design; Tier 2 is only triggered per-bid |

---

## 8. Immediate Next Steps

1. Review and approve this blueprint as the development specification.
2. Begin Phase 1 (Tier 1 intake form) implementation.
3. Manually analyze ARL test case to establish ground-truth extraction benchmark for Phase 3 validation.
4. Schedule follow-up with Mary Morris to review Phase 2 multi-document ingestion design before development begins.
5. Define data model and storage schema for Tier 1 enterprise data and Tier 2 per-opportunity data.

---

*CONFIDENTIAL – Internal Use Only | ClicklessAI Product Development Blueprint*
