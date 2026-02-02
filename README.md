# RFP Analyzer - Simplified Architecture

A Next.js application that uses Claude AI, Supabase, and Inngest to intelligently analyze RFP documents.

## Architecture Overview

This is a simplified, section-based approach that processes RFP documents in two stages:

### Stage 0: Document Classifier
- Identifies document type (RFP, proposal, contract, or other)
- Uses Claude to classify the document
- Only RFPs proceed to Stage 1

### Stage 1: RFP Intelligence Analyzer
- Analyzes 8 key sections of the RFP:
  1. Executive Summary
  2. Project Scope
  3. Technical Requirements
  4. Timeline and Milestones
  5. Budget and Pricing
  6. Evaluation Criteria
  7. Submission Requirements
  8. Key Stakeholders

## Tech Stack

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Supabase** - Database and storage
- **Inngest** - Workflow orchestration
- **Claude AI (Anthropic)** - Document analysis

## Setup Instructions

### 1. Install Dependencies

Already done! The project has all dependencies installed.

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API to get your keys
3. Run the SQL migrations in Supabase SQL Editor **in this order**:
   
   **Step 1**: Base schema
   - Open `supabase-migration.sql`
   - Copy and paste into Supabase SQL Editor
   - Execute the SQL
   
   **Step 2**: Multi-company support
   - Open `supabase-multicompany-migration.sql`
   - Copy and paste into Supabase SQL Editor
   - Execute the SQL
   
   **Step 3**: Company intake framework
   - Open `supabase-company-intake-migration.sql`
   - Copy and paste into Supabase SQL Editor
   - Execute the SQL
   
   **Step 4**: ⚠️ **REQUIRED for Proposal Generation**
   - Open `supabase-framework-enhancement-migration.sql`
   - Copy and paste into Supabase SQL Editor
   - Execute the SQL
   - **Without this, you'll get "No requirements found" errors when generating proposals**

4. (Optional) Verify all tables exist:
   - Run `scripts/check-migration-status.sql` in Supabase SQL Editor
   - All statuses should show ✅ EXISTS

### 3. Set Up Inngest

1. Sign up at [inngest.com](https://inngest.com)
2. Create a new app
3. Get your Event Key and Signing Key from the dashboard

### 4. Get Anthropic API Key

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Create an API key

### 5. Configure Environment Variables

Edit `.env.local` with your actual keys:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key

# Inngest
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key
```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 7. Connect Inngest to Your Local Server

In a separate terminal:

```bash
npx inngest-cli@latest dev
```

This starts the Inngest Dev Server which connects to your local Next.js app.

## How to Use

1. Start the dev server (`npm run dev`)
2. Start the Inngest dev server (`npx inngest-cli@latest dev`)
3. Open http://localhost:3000
4. Upload an RFP document (txt, pdf, doc, docx)
5. The system will:
   - Classify the document (Stage 0)
   - If it's an RFP, analyze all 8 sections (Stage 1)
   - Save results to Supabase

## Database Schema

### `documents`
- `id` - UUID primary key
- `filename` - Original filename
- `file_path` - Path to stored file
- `document_type` - rfp | proposal | contract | other | unknown
- `status` - pending | processing | completed | failed
- `created_at` - Timestamp
- `updated_at` - Timestamp

### `section_results`
- `id` - UUID primary key
- `document_id` - Foreign key to documents
- `section_name` - Name of the section
- `section_number` - Section order (1-8)
- `content` - JSON content with analysis results
- `metadata` - Additional metadata
- `created_at` - Timestamp

### `processing_logs`
- `id` - UUID primary key
- `document_id` - Foreign key to documents
- `stage` - Which stage (stage-0-classifier, stage-1-rfp-intelligence)
- `status` - started | completed | failed
- `metadata` - Stage-specific metadata
- `error` - Error message if failed
- `created_at` - Timestamp

## Project Structure

```
rfp_app_v2/
├── app/
│   ├── api/
│   │   ├── inngest/
│   │   │   └── route.ts          # Inngest webhook endpoint
│   │   └── upload/
│   │       └── route.ts          # File upload handler
│   └── page.tsx                   # Main UI
├── lib/
│   ├── anthropic/
│   │   └── client.ts             # Claude AI client
│   ├── inngest/
│   │   ├── client.ts             # Inngest client
│   │   └── functions/
│   │       ├── stage0-classifier.ts
│   │       └── stage1-rfp-intelligence.ts
│   └── supabase/
│       ├── client.ts             # Supabase client
│       └── types.ts              # TypeScript types
├── .env.local                     # Environment variables
├── supabase-migration.sql         # Database schema
└── README.md
```

## Key Features

- **Automatic Classification** - Determines if document is an RFP
- **Intelligent Section Analysis** - Extracts key information from 8 critical sections
- **Workflow Orchestration** - Inngest handles the multi-stage processing
- **Progress Tracking** - Logs every stage in the database
- **Simple UI** - Upload and track document processing

## Next Steps

After getting the basic system running, you can:

1. Add a results viewing page to display analyzed sections
2. Implement file storage (use Supabase Storage)
3. Add user authentication
4. Create a dashboard to view all documents
5. Add more sophisticated error handling
6. Implement retry logic for failed stages
7. Add PDF parsing for better text extraction

## Development Notes

- The current implementation uses simple text extraction from uploaded files
- For production, you'll want to implement proper file storage (Supabase Storage)
- PDF parsing may require additional libraries like `pdf-parse`
- Consider adding rate limiting for API calls
- Monitor Claude API usage and costs
