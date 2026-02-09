# Phase 4: Pipeline & Output - Research

**Researched:** 2026-02-09
**Domain:** Document pipeline automation, PDF conversion, Excel generation, ZIP packaging
**Confidence:** HIGH

## Summary

This phase implements the final output pipeline for the RFP proposal system: page tracking with auto-condensing, PDF export via LibreOffice headless conversion, quality checklist generation in Excel format, and organized package structure with ZIP download. The research focused on the locked technology stack decisions from CONTEXT.md (LibreOffice CLI, ExcelJS, Archiver) and investigated their implementation patterns, common pitfalls, and integration strategies.

The standard approach uses LibreOffice's headless CLI for DOCX-to-PDF conversion, ExcelJS for creating formatted checklist spreadsheets, and Archiver for streaming ZIP file generation. All three technologies are mature and production-ready, with the primary challenges being LibreOffice process management (zombie processes, memory leaks) and proper error handling for stream-based operations.

Key findings indicate that LibreOffice requires careful process lifecycle management to avoid zombie processes in headless mode, ExcelJS provides comprehensive formatting capabilities but has known issues with data validation persistence, and Archiver requires explicit error event handling for both 'warning' and 'error' events. Page estimation should use 500-600 words per page (3000-3500 characters with spaces) as a baseline heuristic.

**Primary recommendation:** Use libreoffice-convert npm wrapper for simplified API, implement graceful cleanup for temp files with the tmp library, handle all stream errors explicitly with Archiver, and structure the package generation pipeline to fail gracefully at each stage with clear error messages.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| LibreOffice | 7.x+ | DOCX to PDF conversion | Industry standard office suite, headless CLI mode, free/open-source, handles complex DOCX formatting |
| ExcelJS | 4.4.0 | Excel file generation | Most feature-complete Node.js Excel library, supports formatting/validation/formulas, active maintenance (15.1k stars) |
| Archiver | 7.0.1 | ZIP file creation | De-facto standard for ZIP in Node.js, streaming interface, supports multiple sources (files/buffers/streams) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| libreoffice-convert | 0.0.4 | LibreOffice wrapper | Simplifies callback-based API for DOCX conversion, handles platform detection |
| tmp | Latest | Temporary file management | Creating temp directories for document processing, automatic cleanup on exit |
| page-count | 0.0.4 | Page count verification | Validating estimated page counts against actual rendered pages (optional) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LibreOffice | Pandoc, Puppeteer | Pandoc loses formatting fidelity; Puppeteer requires HTML intermediate step |
| ExcelJS | xlsx (SheetJS) | SheetJS simpler but less formatting control, ExcelJS better for styled output |
| Archiver | adm-zip, JSZip | adm-zip is synchronous (blocking), JSZip works but Archiver has better streaming API |

**Installation:**
```bash
# Libraries already installed in package.json
npm install archiver @types/archiver exceljs

# Supporting libraries
npm install libreoffice-convert tmp

# System dependencies (must be pre-installed)
# Ubuntu: sudo apt install libreoffice-core libreoffice-writer
# macOS: brew install --cask libreoffice
# Windows: Download from https://www.libreoffice.org/
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
├── pipeline/
│   ├── page-tracker.ts          # Page allocation and limit tracking
│   ├── content-condenser.ts     # AI-driven content reduction
│   ├── pdf-converter.ts         # LibreOffice integration
│   ├── checklist-generator.ts   # Excel checklist creation
│   └── package-builder.ts       # ZIP package assembly
├── utils/
│   ├── temp-files.ts            # Temporary file management
│   └── stream-helpers.ts        # Stream error handling
app/api/
├── download/
│   └── route.ts                 # ZIP download endpoint
```

### Pattern 1: Pipeline with Cascading Stages
**What:** Each stage produces artifacts consumed by the next, with clear input/output contracts
**When to use:** When multiple transformations needed (DOCX → PDF → Package)
**Example:**
```typescript
// Source: Research synthesis from Next.js streaming + archiver patterns
interface PipelineStage<TInput, TOutput> {
  name: string;
  execute(input: TInput): Promise<TOutput>;
  cleanup?(): Promise<void>;
}

export class DocumentPipeline {
  private stages: PipelineStage<any, any>[] = [];

  async run(initialInput: any): Promise<any> {
    let currentOutput = initialInput;

    for (const stage of this.stages) {
      try {
        currentOutput = await stage.execute(currentOutput);
      } catch (error) {
        // Cleanup completed stages
        await this.cleanupStages();
        throw new Error(`Pipeline failed at stage ${stage.name}: ${error.message}`);
      }
    }

    return currentOutput;
  }

  private async cleanupStages() {
    for (const stage of this.stages) {
      if (stage.cleanup) await stage.cleanup();
    }
  }
}
```

### Pattern 2: Streaming ZIP with Error Boundaries
**What:** Stream files into ZIP archive with explicit error handling for each source
**When to use:** When creating ZIP downloads in API routes
**Example:**
```typescript
// Source: https://github.com/archiverjs/node-archiver + npm documentation
import archiver from 'archiver';
import { createWriteStream } from 'fs';

export async function createPackageZip(
  outputPath: string,
  files: { path: string; name: string }[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Critical: handle both warning and error events
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('File not found warning:', err);
      } else {
        reject(err);
      }
    });

    archive.on('error', (err) => {
      reject(err);
    });

    output.on('close', () => {
      console.log(`Archive created: ${archive.pointer()} bytes`);
      resolve();
    });

    archive.pipe(output);

    // Add files
    for (const file of files) {
      archive.file(file.path, { name: file.name });
    }

    archive.finalize();
  });
}
```

### Pattern 3: LibreOffice Conversion with Process Cleanup
**What:** Convert DOCX to PDF using LibreOffice CLI with proper temp file handling
**When to use:** Generating PDFs for final submission packages
**Example:**
```typescript
// Source: https://github.com/elwerene/libreoffice-convert + research synthesis
import libre from 'libreoffice-convert';
import { promisify } from 'util';
import tmp from 'tmp';

const libreConvert = promisify(libre.convert);

export async function convertToPdf(
  docxBuffer: Buffer
): Promise<Buffer> {
  try {
    // Convert with quality settings
    const pdfBuffer = await libreConvert(
      docxBuffer,
      '.pdf',
      undefined // Uses default settings
    );

    return pdfBuffer;
  } catch (error) {
    throw new Error(`PDF conversion failed: ${error.message}`);
  }
}

// Note: LibreOffice requires system installation
// Verify availability before using
export async function checkLibreOfficeAvailable(): Promise<boolean> {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync('soffice --version');
    return true;
  } catch {
    return false;
  }
}
```

### Pattern 4: ExcelJS Checklist with Formatting
**What:** Create formatted Excel checklist with categories, checkboxes, and styling
**When to use:** Generating submission checklist per Framework Part 10.1
**Example:**
```typescript
// Source: https://github.com/exceljs/exceljs documentation
import ExcelJS from 'exceljs';

export async function generateChecklist(
  outputPath: string,
  categories: ChecklistCategory[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Submission Checklist');

  // Set column widths
  sheet.columns = [
    { width: 30 }, // Category
    { width: 60 }, // Item
    { width: 15 }, // Status
    { width: 40 }  // Notes
  ];

  // Add headers with styling
  const headerRow = sheet.addRow(['Category', 'Item', 'Status', 'Notes']);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9EAD3' }
  };

  // Add data with borders
  for (const category of categories) {
    for (const item of category.items) {
      const row = sheet.addRow([
        category.name,
        item.description,
        '', // Empty for manual checkbox
        ''
      ]);

      // Add data validation for Status column (dropdown)
      const statusCell = row.getCell(3);
      statusCell.dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"Pass,Fail,N/A"']
      };
    }
  }

  // Add borders to all cells
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  await workbook.xlsx.writeFile(outputPath);
}
```

### Pattern 5: Page Tracking with Content Condensing
**What:** Track cumulative page count during generation and flag/condense when approaching limits
**When to use:** Implementing Framework Part 8.2 page allocation
**Example:**
```typescript
// Source: Research synthesis from Framework GAP 8 + page estimation formulas
interface PageAllocation {
  sectionId: string;
  allocatedPages: number;
  estimatedPages: number;
  actualContent: string;
}

export class PageTracker {
  private readonly CHARS_PER_PAGE = 3500; // Including spaces
  private readonly WORDS_PER_PAGE = 600;   // Alternative metric

  estimatePages(content: string): number {
    const charCount = content.length;
    return Math.ceil(charCount / this.CHARS_PER_PAGE);
  }

  checkAllocation(
    allocation: PageAllocation
  ): { status: 'ok' | 'warning' | 'over'; message: string } {
    const estimated = this.estimatePages(allocation.actualContent);
    const percentUsed = (estimated / allocation.allocatedPages) * 100;

    if (estimated > allocation.allocatedPages) {
      return {
        status: 'over',
        message: `Section ${allocation.sectionId} is ${estimated - allocation.allocatedPages} pages over limit. Condensing required.`
      };
    } else if (percentUsed > 90) {
      return {
        status: 'warning',
        message: `Section ${allocation.sectionId} is at ${percentUsed.toFixed(0)}% of page limit.`
      };
    } else {
      return {
        status: 'ok',
        message: `Section ${allocation.sectionId} is within page limit (${estimated}/${allocation.allocatedPages} pages).`
      };
    }
  }

  async condenseContent(
    content: string,
    targetPages: number
  ): Promise<string> {
    const currentPages = this.estimatePages(content);
    if (currentPages <= targetPages) return content;

    const reductionFactor = targetPages / currentPages;
    const targetChars = Math.floor(content.length * reductionFactor * 0.95); // 5% buffer

    // Call AI to condense (simplified example)
    const prompt = `Condense the following content from ${currentPages} pages to ${targetPages} pages (approximately ${targetChars} characters). Preserve all key points and compliance language:\n\n${content}`;

    // Return condensed content from AI
    return content; // Placeholder - actual implementation uses Claude API
  }
}
```

### Anti-Patterns to Avoid
- **Synchronous ZIP creation:** Don't load entire ZIP into memory. Use streaming with archiver.pipe()
- **Ignoring LibreOffice zombie processes:** Must cleanup processes in serverless/container environments
- **No error boundaries in pipeline:** Each stage must catch and cleanup on failure
- **Hardcoded page limits:** Page limits must come from RFP metadata, not constants
- **No temp file cleanup:** Always use tmp library with cleanup handlers

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOCX to PDF conversion | Custom renderer with docx + pdf-lib | LibreOffice headless CLI | Handles complex formatting (headers, footers, tables, images), cross-references, fields that custom solutions miss |
| Excel file generation | Manual XML construction | ExcelJS | Excel XML spec is massive (5000+ pages), easy to create corrupted files, formulas require precise syntax |
| ZIP file creation | Manual ZIP format writing | Archiver | ZIP format has many variants (ZIP64, compression levels, directory structures), streaming is complex |
| Temp file management | fs.mkdtemp + manual cleanup | tmp library | Race conditions, cleanup on crash, platform-specific temp directories, file descriptor leaks |
| Page count estimation | Render and count | Character/word heuristics | Rendering is slow (100-1000x slower), requires full LibreOffice instance, not suitable for progress indicators |

**Key insight:** Document format complexity is deceptive. DOCX is a ZIP containing XML with hundreds of possible elements. PDF rendering requires understanding font metrics, line breaking, kerning, and style inheritance. Excel formulas have locale-specific syntax. Use battle-tested libraries.

## Common Pitfalls

### Pitfall 1: LibreOffice Zombie Processes
**What goes wrong:** Running LibreOffice in headless mode leaves zombie `soffice.bin` and `gpg2` processes that accumulate until process limits are hit. Memory leaks can occur with repeated conversions.
**Why it happens:** LibreOffice spawns child processes that aren't properly reaped in environments without an init process (Node.js as PID 1 in containers, AWS Lambda). Process doesn't always exit cleanly on error.
**How to avoid:**
- Use libreoffice-convert wrapper which handles process lifecycle
- Implement timeout for conversions (kill after 30 seconds)
- Monitor process count and restart if zombies accumulate
- Consider one-conversion-per-container in serverless
**Warning signs:** Increasing process count over time, "too many open files" errors, memory usage growing with each conversion

### Pitfall 2: Archiver Stream Errors Not Caught
**What goes wrong:** Archive creation silently fails or produces corrupt ZIP when source files are missing or streams error. The 'close' event fires even on error, making you think it succeeded.
**Why it happens:** Archiver has separate 'warning' and 'error' events. The 'end' event doesn't occur on error. Missing files trigger 'warning' not 'error'. Developers only listen to 'close'.
**How to avoid:**
- Listen to both 'warning' and 'error' events explicitly
- Reject promise on non-ENOENT warnings
- Verify archive.pointer() > 0 before considering success
- Test with missing source files
**Warning signs:** ZIP files with 0 bytes or corrupt structure, "unexpected end of archive" on extraction

### Pitfall 3: ExcelJS Data Validation Loss
**What goes wrong:** Creating an Excel file with data validation (dropdown lists, checkboxes) works initially, but opening in Excel shows no validation. Or validation is lost when reading and writing existing templates.
**Why it happens:** ExcelJS has known bugs with data validation persistence. Combining data validation with conditional formatting can corrupt workbooks. Dynamic list formulas have limited support.
**How to avoid:**
- Use simple list validation with hardcoded options `formulae: ['"Pass,Fail,N/A"']`
- Don't combine data validation + conditional formatting on same cells
- Test generated files in Excel immediately after generation
- Add validation to cells after all other formatting is complete
**Warning signs:** Excel shows "Excel found unreadable content" message, validation dropdowns missing, template validations disappear

### Pitfall 4: Page Estimation Drift
**What goes wrong:** Page count estimates are accurate for simple text but way off (20-50% error) for documents with tables, images, headings, and complex formatting. Content fits in development but violates page limits in production.
**Why it happens:** Character-based formulas (3500 chars/page) assume uniform text. Tables use more space. Headings create whitespace. Images consume full lines. Different fonts have different densities.
**How to avoid:**
- Use conservative estimates (3000 chars/page not 3500)
- Add 10% buffer for formatted content
- Weight different content types (table cells = 1.3x, headings = 1.5x)
- Validate with page-count library on sample documents
- Test with actual RFP-style documents, not Lorem ipsum
**Warning signs:** Estimates consistently under by 15%+, table-heavy sections exceed limits, client reports page limit violations

### Pitfall 5: Next.js Route Handler Streaming Timeouts
**What goes wrong:** Large ZIP file downloads (50MB+) timeout or truncate after 30-60 seconds. Client receives incomplete file. No error shown in logs.
**Why it happens:** Default timeout for Next.js API routes is 60 seconds on Vercel, shorter on some platforms. Streaming doesn't reset the timeout. Slow client connections run out of time.
**How to avoid:**
- Stream response incrementally with ReadableStream
- Configure longer timeout in vercel.json: `"maxDuration": 300`
- Show progress indicator to client
- Generate and cache package files async, then serve from storage
- For very large files (100MB+), use signed S3 URLs not direct streaming
**Warning signs:** Downloads fail at ~1 minute mark, file size on client smaller than expected, no error in server logs

### Pitfall 6: Temp Directory Exhaustion
**What goes wrong:** System runs out of disk space or inodes. Generation fails with "ENOSPC: no space left on device". Temp directory has thousands of abandoned folders.
**Why it happens:** Temp files created for each generation aren't cleaned up on error. Long-running processes accumulate temp files. Default tmp cleanup only runs on graceful exit, not on crash or kill -9.
**How to avoid:**
- Use tmp library with `unsafeCleanup: true` for automatic removal
- Wrap all operations in try/finally to ensure cleanup
- Set `gracefulCleanup: true` to cleanup on process exit
- Monitor temp directory size and alert if growing
- Run periodic cleanup job to remove old temp directories
**Warning signs:** `/tmp` size growing unbounded, ENOSPC errors, generation works then suddenly fails, df shows 100% usage

## Code Examples

Verified patterns from official sources:

### Next.js App Router ZIP Download Endpoint
```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/route
// Source: https://www.codeconcisely.com/posts/nextjs-download-zip-file/
import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';

export async function GET(request: NextRequest) {
  const packagePath = '/tmp/proposal-package.zip';

  try {
    // Get file stats for Content-Length header
    const stats = await stat(packagePath);

    // Create ReadableStream from file
    const stream = createReadStream(packagePath);

    // Convert Node stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      }
    });

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="Proposal_Package.zip"',
        'Content-Length': stats.size.toString()
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate package' },
      { status: 500 }
    );
  }
}
```

### Temporary Directory Management
```typescript
// Source: https://github.com/raszi/node-tmp
import tmp from 'tmp';
import { promisify } from 'util';

const tmpDir = promisify(tmp.dir);
const tmpFile = promisify(tmp.file);

// Enable automatic cleanup on process exit
tmp.setGracefulCleanup();

export async function withTempDirectory<T>(
  fn: (dirPath: string) => Promise<T>
): Promise<T> {
  const { path: dirPath, cleanup } = await tmpDir({
    unsafeCleanup: true // Remove directory even if not empty
  });

  try {
    return await fn(dirPath);
  } finally {
    // Explicit cleanup (automatic also happens on exit)
    cleanup();
  }
}

// Usage example
await withTempDirectory(async (tempDir) => {
  // Generate documents in tempDir
  // Create ZIP package
  // Return result
  // Cleanup happens automatically
});
```

### Framework Part 10.1 Checklist Categories
```typescript
// Source: C:\Users\eharr\Dev_2026\rfp_app_v2\FRAMEWORK_GAP_ANALYSIS.md GAP 22
interface ChecklistItem {
  description: string;
  automatable: boolean;
  checkMethod?: string;
}

interface ChecklistCategory {
  name: string;
  items: ChecklistItem[];
}

export const FRAMEWORK_CHECKLIST: ChecklistCategory[] = [
  {
    name: 'COMPLIANCE',
    items: [
      { description: 'All Section L requirements addressed', automatable: true, checkMethod: 'Compare section headings to RFQ Section L outline' },
      { description: 'Page limits respected per volume', automatable: true, checkMethod: 'Count pages, compare to RFQ limits' },
      { description: 'Required formats followed (font, margins, spacing)', automatable: true, checkMethod: 'Check paragraph styles match specs' },
      { description: 'Cover letter includes all required elements', automatable: true, checkMethod: 'Verify cover letter sections present' },
      { description: 'Compliance matrix matches all requirements', automatable: true, checkMethod: 'Cross-reference matrix to requirement IDs' }
    ]
  },
  {
    name: 'CONTENT',
    items: [
      { description: 'Every requirement explicitly addressed', automatable: true, checkMethod: 'Check for requirement boxes/cross-refs' },
      { description: 'Win themes present in executive summary and key sections', automatable: true, checkMethod: 'Search for win theme callout boxes' },
      { description: 'Past performance examples relevant to proposed approach', automatable: false, checkMethod: 'Manual review by SME' },
      { description: 'Staffing plan matches labor categories in RFQ', automatable: true, checkMethod: 'Compare labor cats to RFQ Section B' },
      { description: 'No unsubstantiated claims or vague language', automatable: false, checkMethod: 'Manual review by proposal manager' }
    ]
  },
  {
    name: 'FORMATTING',
    items: [
      { description: 'Table of contents matches document sections', automatable: true, checkMethod: 'Update TOC, verify no differences' },
      { description: 'All exhibits numbered sequentially and referenced', automatable: true, checkMethod: 'Run exhibit validation function' },
      { description: 'Headers and footers on all pages', automatable: true, checkMethod: 'Check header/footer properties on all sections' },
      { description: 'No orphan headings (heading at bottom of page)', automatable: false, checkMethod: 'Visual review of page breaks' },
      { description: 'All tables and figures have captions', automatable: true, checkMethod: 'Search for Table/Figure patterns' }
    ]
  },
  {
    name: 'FINAL_CHECKS',
    items: [
      { description: 'No spelling or grammar errors', automatable: false, checkMethod: 'Run spell check, manual review' },
      { description: 'Acronyms defined on first use', automatable: true, checkMethod: 'Run acronym checker' },
      { description: 'No track changes or comments visible', automatable: true, checkMethod: 'Check document properties' },
      { description: 'PDF versions match DOCX versions exactly', automatable: true, checkMethod: 'Visual comparison or hash check' },
      { description: 'File names follow submission instructions', automatable: true, checkMethod: 'Compare filenames to RFQ requirements' }
    ]
  }
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Puppeteer HTML-to-PDF | LibreOffice headless | ~2020 | Better DOCX fidelity, native format support, faster for Office files |
| Manual page counting | Character-based estimation | Ongoing | Real-time progress indicators, no rendering overhead |
| Synchronous zip creation (adm-zip) | Streaming archives (archiver) | 2018-2020 | Memory efficient for large packages, non-blocking |
| Inline file downloads | API route streaming | Next.js 13+ (2023) | Server-side generation, better error handling, progress support |

**Deprecated/outdated:**
- **pdf-lib for DOCX conversion:** Doesn't handle DOCX natively, requires manual layout. Use LibreOffice.
- **exceljs templates with validation:** Known bugs with validation persistence. Define validation in code, not templates.
- **node-unoconv:** Wrapper around unoconv (Python tool). Extra dependency. Use libreoffice-convert directly.

## Open Questions

Things that couldn't be fully resolved:

1. **LibreOffice Quality Settings for PDF Export**
   - What we know: LibreOffice supports JSON filter parameters via CLI (`--convert-to 'pdf:writer_pdf_Export:{"Quality":{"type":"long","value":"90"}}'`)
   - What's unclear: Exact parameter names for image compression, PDF/A compliance, embedding fonts. Official docs exist but specific parameter mappings not fully documented.
   - Recommendation: Start with default quality settings. Add advanced PDF options as Phase 4.5 if needed. Test PDF output with sample RFPs for acceptability.

2. **Page Count Verification After Generation**
   - What we know: page-count library exists but last published 2 years ago. Can verify actual page counts by reading rendered PDF.
   - What's unclear: Reliability of page-count library with modern DOCX features. Performance impact of verifying every generation.
   - Recommendation: Implement character-based estimation first (HIGH confidence). Add page-count verification as optional quality check (LOW confidence). Validate heuristics against sample documents.

3. **Handling Manual-Review Checklist Items**
   - What we know: Framework Part 10.1 has items that can't be fully automated (e.g., "No unsubstantiated claims", "Orphan headings")
   - What's unclear: How much AI can assist vs. requiring true human review. Confidence thresholds for AI checks.
   - Recommendation: Mark automatable=false items as "Needs Manual Review" in checklist. In future phases, experiment with AI-assisted checks (e.g., Claude reading document and flagging potential issues) but always require human confirmation.

4. **ZIP File Streaming in Serverless Environments**
   - What we know: Archiver can stream to response. Vercel has 60s default timeout, 300s max with config.
   - What's unclear: Whether streaming resets timeout (response time) or total execution time applies. Large file behavior.
   - Recommendation: For Phase 4, generate ZIP to temp file then stream (simpler). If timeout issues occur, implement Inngest background job + S3 storage pattern (already using Inngest in project).

5. **Condensing Strategy Specifics**
   - What we know: Need to reduce content when over page limits. AI can condense prose while preserving key points.
   - What's unclear: Best prompting strategy for condensing. How to preserve compliance language exactly while reducing surrounding prose. Multi-pass vs single-pass condensing.
   - Recommendation: Start with single-pass condense prompt: "Reduce this to X pages while preserving all compliance statements starting with '[Company] will' verbatim." Iterate based on results. May need multi-pass: first remove examples, then condense descriptions, finally tighten language.

## Sources

### Primary (HIGH confidence)
- [ExcelJS GitHub Repository](https://github.com/exceljs/exceljs) - Features, version 15.1k stars, active development
- [Archiver GitHub Repository](https://github.com/archiverjs/node-archiver) - Version 7.0.1, API patterns, error handling
- [libreoffice-convert GitHub](https://github.com/elwerene/libreoffice-convert) - Version 0.0.4, installation requirements, API usage
- [Next.js Route Handlers Documentation](https://nextjs.org/docs/app/api-reference/file-conventions/route) - Streaming response patterns
- Project package.json - Confirmed archiver 7.0.1 and exceljs 4.4.0 already installed
- FRAMEWORK_GAP_ANALYSIS.md - GAP 8 (page allocation), GAP 22 (checklist), GAP 23 (package), GAP 24 (PDF)

### Secondary (MEDIUM confidence)
- [LibreOffice PDF Export Command Line Parameters](https://help.libreoffice.org/latest/en-US/text/shared/guide/pdf_params.html) - Quality settings via JSON
- [Ask LibreOffice: Zombie Processes](https://ask.libreoffice.org/t/headless-mode-creates-zombie/15839) - Known issue with headless mode
- [Ask LibreOffice: Memory Leaks](https://ask.libreoffice.org/t/investigating-memory-leak-in-libreoffice-headless-conversion/111359) - Conversion memory issues
- [Archiver NPM Page](https://www.npmjs.com/package/archiver) - Warning/error event handling example (blocked by 403 but confirmed via GitHub)
- [tmp GitHub](https://github.com/raszi/node-tmp) - Temporary file management patterns
- [Code Concisely: Next.js ZIP Download](https://www.codeconcisely.com/posts/nextjs-download-zip-file/) - Streaming implementation example
- [Character Count to Page Estimation](https://support.foundant.com/hc/en-us/articles/4404567706775-Character-Limits-into-Estimated-Word-and-Page-Counts) - 3500 chars/page single-spaced

### Tertiary (LOW confidence)
- [DEV.to: Error Handling in Node.js Streams](https://dev.to/ruben_alapont/error-handling-in-nodejs-streams-best-practices-dhb) - General stream error patterns
- [Medium: ExcelJS Operations](https://habtesoft.medium.com/mastering-exceljs-advanced-excel-operations-in-node-js-0ff859384257) - Formatting examples
- [GitHub Issues: ExcelJS Data Validation Bugs](https://github.com/exceljs/exceljs/issues/1207) - Known limitations with validation persistence

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All three core libraries verified via official repos, version numbers confirmed, already in use in Node.js ecosystem
- Architecture: HIGH - Patterns synthesized from official documentation and verified examples, tested by community
- Pitfalls: MEDIUM-HIGH - Zombie processes and stream errors confirmed via official bug reports and issues. ExcelJS validation issues documented. Page estimation and temp file issues based on research synthesis.

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days - stable technologies, minimal API churn expected)
