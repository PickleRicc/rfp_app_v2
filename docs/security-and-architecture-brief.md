# ClicklessAI RFP Tool — Security & Architecture Brief

**Prepared for: Technical Decision Makers | Classification: Client-Facing**

---

## Platform Overview

ClicklessAI is a proposal automation platform purpose-built for federal contractors. It ingests solicitation documents, extracts compliance requirements, collects company-specific data through guided workflows, and generates evaluation-ready proposal volumes with professional formatting and visual exhibits.

The platform handles sensitive data including company financials, personnel clearance information, proprietary past performance, pricing strategies, and pre-decisional proposal content.

---

## Data Isolation & Multi-Tenancy

- **Company-scoped data access.** Every API endpoint validates company ownership before returning data. Database queries are parameterized and filtered by company identifier. A request for Company A's data cannot return Company B's records.
- **Row-Level Security policies.** The PostgreSQL database enforces Row-Level Security (RLS) policies on all tenant data tables as a defense-in-depth layer, keyed to the authenticated user's company association.
- **No shared data between clients.** Company profiles, personnel records, past performance, pricing data, and proposal drafts are isolated per-tenant. There is no pooled data, no shared training sets, and no cross-client analytics.

---

## Authentication & Access Control

- **Cookie-based session authentication** via Supabase Auth with OAuth/PKCE flow. No passwords stored in the application database. Sessions are managed via signed JWTs with automatic refresh.
- **Two access tiers.** Staff users (proposal managers) have full platform access. Client users access only their company's data through authenticated portal sessions.
- **Token-based client intake forms.** For collecting company data from clients, the platform generates cryptographically secure intake tokens (256-bit random, hex-encoded). Tokens are:
  - Time-limited (configurable, default 30 days)
  - Revocable by staff immediately
  - Scoped to a single company — all queries enforce company isolation
  - Validated with format checks, expiration, and revocation status on every request
  - Tracked with access counts and timestamps
- **API route protection.** Server-side endpoints validate authentication before processing. Intake form endpoints validate the token on every request. Unauthenticated requests receive no data.
- **Mass assignment prevention.** Client-facing update endpoints use explicit field allowlists — clients cannot modify system fields, metadata, or fields outside the permitted set.

---

## AI Processing & Data Handling

- **Your data is not used for AI model training.** All AI processing uses the Anthropic Claude API. Under Anthropic's API terms, inputs and outputs are not used to train or improve models.
- **Stateless processing.** Prompts and responses are transient — processed in-memory and not cached, indexed, or persisted on the AI provider's infrastructure beyond the API call lifecycle.
- **Prompt containment.** Company data is injected into generation prompts only at the moment of processing. Each generation run is stateless — no conversation history is maintained between sessions.
- **No fine-tuning on client data.** The AI models are used as-is via API. We do not fine-tune, embed, or create vector stores from your proprietary content.

---

## Infrastructure & Encryption

- **Encryption in transit.** All data transmitted between the client browser, application servers, database, and AI API uses TLS 1.2+ encryption. No plaintext data crosses any network boundary.
- **Encryption at rest.** Database storage (Supabase managed PostgreSQL) and file storage (Supabase Storage) use AES-256 encryption at rest, managed by the infrastructure provider.
- **Cloud-hosted.** The platform runs on cloud infrastructure. Browser sessions use ephemeral state only.

---

## Document & File Security

- **Uploaded files** (solicitation packages, resumes, LOCs, certifications) are stored in private storage buckets with company-scoped paths. Files are accessible only through authenticated API endpoints.
- **Generated proposal documents** (DOCX, Excel) are stored in company-scoped storage paths and accessible only to authenticated users within the owning company.
- **File upload validation.** Intake form uploads enforce file size limits (10 MB), MIME type allowlists (PDF, DOCX, DOC), and filename sanitization to prevent path traversal.
- **File processing** (PDF text extraction, document classification) occurs on isolated server-side workers. Uploaded content is not exposed to other tenants or external services beyond the AI API.

---

## Pipeline Event Logging

- **Processing event logs.** The proposal generation pipeline logs each processing stage (extraction, generation, scoring, rewriting) with timestamps, duration, status, and metadata to a dedicated `pipeline_logs` table.
- **Token access tracking.** Client intake tokens track `access_count` and `last_accessed_at` for usage monitoring.

---

## Compliance Alignment

The platform's security controls align with the following frameworks. Formal certification is not yet completed.

| Framework | Relevant Controls Implemented |
|-----------|-------------------------------|
| **NIST 800-171** | Access control (AC), media protection (MP), system/communications protection (SC), encryption at rest/transit |
| **CMMC Level 2** | Identity and access management, data isolation, encrypted communications |

---

## What We Don't Do

- We **do not** train AI models on your data
- We **do not** share data between client organizations
- We **do not** expose public APIs or unauthenticated data endpoints
- We **do not** use third-party analytics, tracking, or advertising services on proposal data
- We **do not** fine-tune or customize AI models with proprietary content

---

## Architecture Summary

- **Application Layer** — Next.js server-rendered application with API routes that enforce authentication and authorization on every request.
- **Database Layer** — Managed PostgreSQL (Supabase) with row-level security policies, encrypted connections, automated backups, and schema-level constraints.
- **AI Layer** — Stateless API calls to Anthropic Claude. No model customization, no data retention, no feedback loops.
- **File Storage** — Private encrypted object storage (Supabase Storage) with company-scoped access paths.
- **Background Processing** — Async job processing (Inngest) for long-running operations (document extraction, proposal generation, compliance scoring). Jobs are isolated per-solicitation with independent error handling.
- **Client Data Collection** — Token-based intake forms with cryptographic token generation, expiration, revocation, and company-scoped data isolation.

*ClicklessAI, Inc. | Confidential — For intended recipient only*
