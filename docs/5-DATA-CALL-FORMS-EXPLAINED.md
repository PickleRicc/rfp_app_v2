# How Data Call Forms Work

This document explains how the application builds custom forms for each RFP, what data they collect, and how that data feeds into proposal generation.

---

## What Is a Data Call?

A **Data Call** is a questionnaire that the application generates for your company to fill out. It asks for all the company-specific information needed to write a proposal response to a particular RFP.

Think of it like this:

- The **RFP** tells us what the government is asking for
- The **Data Call** asks your company how you plan to deliver it

Every RFP is different, so every Data Call form is different.

---

## How the Form Gets Built

The form is **not** a static template. It is dynamically generated based on what the AI finds inside the uploaded RFP documents. Here is the step-by-step process:

### Step 1: Upload RFP Documents

The user uploads the solicitation PDFs (the RFP package from the government).

### Step 2: AI Extracts Key Information

The system reads through those documents and pulls out structured data, including:

| What It Finds | Where It Looks | Example |
|---|---|---|
| Task areas / service areas | Statement of Work (SOW) or Performance Work Statement (PWS) | "3.1 Planning Support", "3.2.1 Service Desk Operations" |
| Required technologies | Technology requirements sections | "ServiceNow", "Nutanix", "Cisco ISE" |
| Work sites | Operational context sections | "Aberdeen Proving Ground", "Adelphi Laboratory" |
| Evaluation factors | Section M | "Technical Approach", "Management Approach" |
| Page limits | Section L | "Volume I: 50 pages", "Volume II: 30 pages" |
| Compliance requirements | Various sections | NIST 800-171, facility clearance level, NAICS code |

All of this extracted data is stored in the database as **compliance extractions**.

### Step 3: The Form Generator Reads the Extractions

The function `generateDataCallSchema()` takes all of those extractions and builds a custom form. It decides:

- **Which sections to include** (some sections only appear if relevant data was found)
- **How many cards to show** in each dynamic section (one per task area, one per site, one per technology)
- **What placeholder text to display** (pulled from the RFP so the user knows what the government is asking for)
- **Which fields are required vs. optional**

### Step 4: The User Fills Out the Form

The generated form is presented in the UI. The user (typically a capture manager or proposal lead) fills in their company's specific answers.

### Step 5: The AI Uses the Answers to Write the Proposal

Everything the user enters flows directly into the AI prompt that generates the proposal volumes. Nothing in the form is decorative — every field is used.

---

## The 7 Sections

Every Data Call has up to 7 sections. The first 5 always appear. The last 3 only appear when the RFP has relevant content.

### Always Present (5 Core Sections)

#### 1. Opportunity Details

**What it asks for:** Basic information about the opportunity and your bid strategy.

**Example fields:**
- Are you bidding as Prime or Sub?
- Contract type (Fixed Price, Cost Plus, T&M)
- Set-aside status (SDVOSB, 8(a), HUBZone, etc.)
- NAICS code and size standard
- Teaming partners (names, roles, workshare percentages)
- CAGE code

**How the AI uses it:** Woven into the management volume, pricing context, and compliance sections. Teaming partner capabilities are referenced when describing how work will be performed.

---

#### 2. Past Performance

**What it asks for:** 3-5 relevant contract references.

**Example fields per reference:**
- Contract name and number
- Agency / client
- Contract value
- Period of performance
- Relevance to this opportunity
- CPARS rating

**How the AI uses it:** The entire Past Performance volume is built from these entries. The AI matches each reference to the evaluation factors and explains why it's relevant.

---

#### 3. Key Personnel

**What it asks for:** Information about proposed staff for key positions.

**Example fields per person:**
- Name and proposed role
- Qualifications summary
- Resume (PDF upload)
- Letter of Commitment (PDF upload)
- Certifications (PDF upload)

**How the AI uses it:** Personnel bios in the management volume, org chart references, and the AI reads the actual PDF content from resumes and LOCs to cite specific experience.

---

#### 4. Technical Approach

**What it asks for:** Your overall technical strategy.

**Example fields:**
- Approach summary (how you will deliver the work)
- Tools and platforms you plan to use
- Staffing model (how many people, what roles, what ratio)
- Key assumptions
- Risks and mitigations

**How the AI uses it:** This is the foundation of the technical volume. The AI expands on your summary, integrating it with the RFP requirements and your service area approaches.

---

#### 5. Compliance Verification

**What it asks for:** Regulatory and certification compliance details.

**Example fields:**
- SPRS score and assessment date
- NIST 800-171 compliance status
- Facility clearance level and sponsoring agency
- ISO certifications (9001, 27001)
- CMMI level

**How the AI uses it:** Cited directly in compliance sections, security approach narratives, and the compliance matrix. Prevents the AI from fabricating compliance claims.

---

### Dynamic Sections (Only Appear When Relevant)

These sections are built directly from what the AI found in the RFP. The number of cards (items) in each section varies per solicitation.

#### 6. Service Area Approaches

**When it appears:** When the SOW/PWS contains identifiable task areas or service areas.

**What it asks for:** One card per task area, each with:
- Your approach narrative (how you will perform this work)
- Proposed tools and platforms
- Proposed staffing for this area
- Key differentiator (what makes you better than competitors)

**How card count is determined:** The AI reads the SOW/PWS and identifies each numbered task area. If the SOW says "3.1 Planning Support, 3.2.1 Service Desk, 3.2.2 End-User Device Management..." you get one card per area.

**How the AI uses it:** Each task area in the technical volume maps directly to these entries. The AI combines your approach with the RFP's requirements for that area to write a complete section.

---

#### 7. Site Staffing

**When it appears:** When the RFP mentions specific work locations.

**What it asks for:** One card per work site, each with:
- Proposed FTE count
- Key roles assigned to that site
- Special requirements (clearances, on-site hours, etc.)

**How card count is determined:** The AI reads the RFP for location references. If the RFP mentions "Aberdeen Proving Ground, Adelphi Laboratory, and remote work," you get 3 cards.

**How the AI uses it:** Staffing tables in the technical and management volumes, transition planning, and multi-site management approach. The AI also cross-references these numbers for consistency.

---

#### 8. Technology Selections

**When it appears:** When the RFP specifies required or preferred technologies.

**What it asks for:** One card per technology, each with:
- Your company's experience with this technology
- How you plan to use it on this contract
- Relevant certifications your team holds

**How card count is determined:** The AI scans the RFP for mandatory and current-environment technologies. If the RFP mentions "ServiceNow, Nutanix, Cisco ISE, SCCM..." you get one card per technology.

**How the AI uses it:** Technology references throughout the technical volume, staffing justifications (certified staff for specific tools), and differentiators.

---

## Real-World Scenarios

To show how the form changes based on the RFP, here are three examples:

### Scenario A: ARL IT Operations Support (This Solicitation)

| Section | Card Count | Why |
|---|---|---|
| Service Area Approaches | **18 cards** | The SOW has 18 task areas (Planning Support, Service Desk, End-User Devices, Network Engineering, Cybersecurity, etc.) |
| Site Staffing | **3 cards** | RFP mentions Aberdeen, Adelphi, and Remote |
| Technology Selections | **10 cards** | RFP requires ServiceNow, Nutanix, Nagios, SolarWinds, Cisco ISE, SCCM, JAMF, Intune, HBSS/ESS, Splunk |
| **Total dynamic fields** | **~111** | 18×4 + 3×3 + 10×3 |

### Scenario B: Custom Software Development Contract

| Section | Card Count | Why |
|---|---|---|
| Service Area Approaches | **4 cards** | SOW defines 4 phases: Requirements, Design, Development, Testing |
| Site Staffing | **1 card** | Work is performed at one government site |
| Technology Selections | **5 cards** | RFP requires React, AWS GovCloud, PostgreSQL, Docker, Jenkins |
| **Total dynamic fields** | **~34** | 4×4 + 1×3 + 5×3 |

### Scenario C: Simple Consulting Services

| Section | Card Count | Why |
|---|---|---|
| Service Area Approaches | **0 cards** | SOW doesn't define discrete task areas — section is skipped entirely |
| Site Staffing | **0 cards** | No specific sites mentioned — section is skipped entirely |
| Technology Selections | **0 cards** | No required technologies — section is skipped entirely |
| **Total dynamic fields** | **0** | Only the 5 core sections appear |

---

## Summary: Data Flow from RFP to Proposal

```
RFP Documents (uploaded PDFs)
        │
        ▼
AI Extraction (reads PDFs, pulls out structured data)
        │
        ▼
Compliance Extractions (stored in database)
        │
        ▼
Data Call Form Generator (builds custom form from extractions)
        │
        ▼
Data Call Form (user fills in company-specific answers)
        │
        ▼
Proposal Draft Generator (AI reads form answers + extractions + company profile)
        │
        ▼
Generated Proposal Volumes (DOCX files per volume)
        │
        ▼
Touchup Scorer (AI scores each volume against RFP requirements)
        │
        ▼
Touchup Rewriter (AI rewrites to fix gaps found by scorer)
```

Every stage builds on the previous one. The Data Call form is the critical bridge between "what the government wants" (extracted from the RFP) and "what your company offers" (entered by the user). The more detailed and accurate the Data Call answers, the better the generated proposal.
