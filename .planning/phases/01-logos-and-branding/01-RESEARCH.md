# Phase 1: Logos & Branding - Research

**Researched:** 2026-02-02
**Domain:** Word document generation with docx npm library, image handling, headers/footers, TOC field codes
**Confidence:** MEDIUM-HIGH

## Summary

This phase implements professional branding across proposal documents using the `docx` npm library (v9.5.1). The core technical challenge is fetching logo images from Supabase URLs and embedding them in Word headers/footers, creating auto-updating Table of Contents with field codes, and implementing different header/footer configurations for cover pages vs interior pages.

The `docx` library provides robust support for headers, footers, and TOC field codes, but requires images to be converted from URLs to buffers before embedding. The library supports different header/footer types (first, default, even) through the `titlePage` property in section configuration. Table of Contents auto-updates via Word field codes when the `updateFields` feature is enabled.

Key architectural decisions already made by user: logo placement (cover center, header left), sizing (1-1.5" cover, small header), no header/footer on cover page, proprietary notice in left footer with page numbers, and TOC depth of 3 levels per framework specification.

**Primary recommendation:** Use native Node.js fetch API (Node 18+) to convert logo URLs to buffers, implement section-based header/footer configuration with `titlePage: true` for cover pages, and enable `updateFields: true` for auto-updating TOC. Add TableOfContents with `captionLabelIncludingNumbers` for Table of Exhibits.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| docx | 9.5.1 | Word document generation | Industry standard for programmatic DOCX creation in Node.js, declarative API, comprehensive feature support |
| Node.js fetch | Native (18+) | Fetch logo images from URLs | Modern standard for 2026, eliminates external dependencies like node-fetch or axios |
| Buffer | Native | Convert image data for docx | Required by ImageRun, standard Node.js binary data handling |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fs | Native | Read local images (if needed) | Development/testing with local image files |
| Supabase client | Existing | Access company profile data | Already integrated, provides logo URLs from document_assets table |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| docx | docxtemplater | Templates more complex for dynamic generation, requires pre-made DOCX templates |
| Native fetch | axios/node-fetch | Unnecessary dependencies in 2026, native fetch is standard |
| Buffer conversion | base64 strings | ImageRun requires Buffer objects, not base64 strings |

**Installation:**
No additional packages needed - docx@9.5.1 already installed, Node 18+ provides native fetch.

## Architecture Patterns

### Recommended Project Structure
```
lib/generation/docx/
├── generator.ts          # Main document generator (existing)
├── styles.ts            # Style definitions (existing)
├── numbering.ts         # Heading numbering (existing)
├── images.ts            # NEW: Image fetching and buffer conversion
├── headers-footers.ts   # NEW: Header/footer configuration
└── toc.ts              # NEW: Table of Contents field code generation
```

### Pattern 1: Fetch and Convert Logo Images
**What:** Fetch logo from Supabase URL and convert to Buffer for ImageRun
**When to use:** Every document generation that needs logos in headers/cover
**Example:**
```typescript
// Source: Modern Node.js best practices for 2026
async function fetchLogoAsBuffer(logoUrl: string): Promise<Buffer> {
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch logo: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error fetching logo:', error);
    // Return fallback or throw based on requirements
    throw error;
  }
}
```

### Pattern 2: Different Headers for Cover vs Interior Pages
**What:** Use section properties with `titlePage: true` to disable headers/footers on cover page
**When to use:** Documents with cover pages that should not have headers/footers
**Example:**
```typescript
// Source: https://docx.js.org/api/variables/HeaderFooterReferenceType.html
// User decision: Cover page has no header or footer
const doc = new Document({
  sections: [
    {
      properties: {
        titlePage: true, // Enables different first page
      },
      headers: {
        first: new Header({ children: [] }), // Empty header for cover
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  data: logoBuffer,
                  transformation: { width: 50, height: 50 }, // Small logo
                }),
                new TextRun({
                  text: ` | Volume Title | Solicitation #`,
                  size: 18,
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        first: new Footer({ children: [] }), // Empty footer for cover
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'PROPRIETARY - Use or disclosure subject to restrictions',
                  size: 16,
                  italics: true,
                }),
                // Page numbers in same paragraph, right-aligned via tab
              ],
              alignment: AlignmentType.LEFT,
            }),
          ],
        }),
      },
      children: [/* document content */],
    },
  ],
});
```

### Pattern 3: Auto-Updating Table of Contents
**What:** Use TableOfContents with updateFields enabled for auto-updating TOC and Table of Exhibits
**When to use:** All proposal documents requiring TOC
**Example:**
```typescript
// Source: https://github.com/dolanmiu/docx/blob/master/docs/usage/table-of-contents.md
const doc = new Document({
  features: {
    updateFields: true, // CRITICAL: Enables field auto-update in Word
  },
  sections: [{
    children: [
      // Main TOC
      new Paragraph({
        text: 'TABLE OF CONTENTS',
        heading: HeadingLevel.HEADING_1,
      }),
      new TableOfContents('Summary', {
        hyperlink: true,
        headingStyleRange: '1-3', // 3 levels per user decision
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // Table of Exhibits (Figures and Tables)
      new Paragraph({
        text: 'TABLE OF EXHIBITS',
        heading: HeadingLevel.HEADING_1,
      }),
      new TableOfContents('Exhibits', {
        hyperlink: true,
        captionLabelIncludingNumbers: 'Figure', // Includes numbered figures
      }),
      // Note: May need separate TOC for tables if both figures and tables exist
    ],
  }],
});
```

### Pattern 4: Logo Sizing and Positioning
**What:** Different logo sizes for cover page vs headers based on user decisions
**When to use:** All documents with branding requirements
**Example:**
```typescript
// User decisions:
// - Cover page logo: 1-1.5 inches, top center, above title
// - Header logo: Small, left side

// Cover page logo (in body, not header)
new Paragraph({
  children: [
    new ImageRun({
      data: logoBuffer,
      transformation: {
        width: 144, // 1.5 inches = 144 points
        height: 96, // Maintain aspect ratio
      },
    }),
  ],
  alignment: AlignmentType.CENTER,
  spacing: { before: 2880, after: 480 }, // Top spacing
})

// Header logo
new ImageRun({
  data: logoBuffer,
  transformation: {
    width: 50, // Small for header
    height: 33, // Maintain aspect ratio
  },
})
```

### Anti-Patterns to Avoid
- **Passing URLs directly to ImageRun:** ImageRun requires Buffer data, not URLs. Always fetch and convert first.
- **Static TOC generation:** Don't manually build TOC entries with page numbers - use field codes so Word auto-updates.
- **Single section for different header/footer needs:** Use separate sections or titlePage property for different first page behavior.
- **Hard-coding logo dimensions:** Calculate dimensions based on aspect ratio to avoid distortion.
- **Ignoring async/await for fetch:** Image fetching is async - must use await or Promise handling.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image fetching and conversion | Custom HTTP client and buffer conversion logic | Native fetch with arrayBuffer() | Standard API, handles all edge cases, no dependencies |
| Table of Contents generation | Manual page number tracking and TOC entries | TableOfContents with field codes | Word auto-updates, handles page shifts, includes hyperlinks |
| Different first page headers | Section breaks or conditional rendering | titlePage: true in section properties | Built-in Word feature, proper document structure |
| Logo aspect ratio calculation | Manual width/height math | Read image dimensions from buffer | Accurate, handles all image types |
| Page numbering | String concatenation with counters | PageNumber.CURRENT and PageNumber.TOTAL_PAGES | Word fields, auto-updates correctly |

**Key insight:** The docx library provides declarative APIs that map to native Word features. Attempting to implement these features manually (like tracking page numbers or building TOC entries) will create brittle code that breaks when content changes. Use field codes and let Word handle the dynamic aspects.

## Common Pitfalls

### Pitfall 1: Image URLs Not Converted to Buffers
**What goes wrong:** Passing logo URL string directly to ImageRun.data results in runtime error
**Why it happens:** ImageRun expects binary data (Buffer), not a URL or file path
**How to avoid:** Always fetch the image first and convert to Buffer
**Warning signs:** Error like "data must be Buffer" or empty image placeholders in generated document
**Code example:**
```typescript
// WRONG
new ImageRun({
  data: 'https://example.com/logo.png', // This will fail
})

// RIGHT
const logoBuffer = await fetchLogoAsBuffer('https://example.com/logo.png');
new ImageRun({
  data: logoBuffer,
})
```

### Pitfall 2: Forgetting updateFields for TOC
**What goes wrong:** Table of Contents appears empty or shows error "Error! No table of contents entries found"
**Why it happens:** Without updateFields: true, Word doesn't know to populate the TOC field
**How to avoid:** Always set features.updateFields to true in Document constructor
**Warning signs:** Empty TOC, Word prompt to update fields when opening document
**Code example:**
```typescript
// WRONG
const doc = new Document({
  sections: [/* ... */],
});

// RIGHT
const doc = new Document({
  features: {
    updateFields: true, // CRITICAL
  },
  sections: [/* ... */],
});
```

### Pitfall 3: Using Section Breaks Instead of titlePage
**What goes wrong:** Creating separate sections for cover page complicates document structure and page numbering
**Why it happens:** Developers unfamiliar with Word's titlePage feature try to achieve different first page with section breaks
**How to avoid:** Use titlePage: true with first/default header/footer definitions in a single section
**Warning signs:** Complex section logic, page numbering starting at wrong number, difficult to manage section breaks
**Code example:**
```typescript
// WRONG - Multiple sections for cover vs body
const doc = new Document({
  sections: [
    { children: [/* cover */] }, // Section 1
    { children: [/* body */] },  // Section 2 - breaks page numbering
  ],
});

// RIGHT - Single section with titlePage
const doc = new Document({
  sections: [{
    properties: { titlePage: true },
    headers: {
      first: new Header({ children: [] }), // No header on cover
      default: new Header({ children: [/* logo, etc */] }),
    },
    children: [/* all content including cover */],
  }],
});
```

### Pitfall 4: Image Fetch Errors Not Handled
**What goes wrong:** Document generation fails completely if logo URL is invalid or unreachable
**Why it happens:** No error handling around fetch operations, no fallback strategy
**How to avoid:** Wrap fetch in try-catch, provide fallback (default logo or text-only header)
**Warning signs:** Intermittent document generation failures, especially in production
**Code example:**
```typescript
async function fetchLogoAsBuffer(logoUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(logoUrl, { timeout: 15000 });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Failed to fetch logo:', error);
    return null; // Allow document generation to continue
  }
}

// In header generation
if (logoBuffer) {
  paragraph.addChildElement(new ImageRun({ data: logoBuffer }));
} else {
  // Fallback to text-only header
  paragraph.addChildElement(new TextRun({ text: companyName }));
}
```

### Pitfall 5: Logo Distortion from Incorrect Aspect Ratio
**What goes wrong:** Logo appears stretched or squished because width/height don't match original proportions
**Why it happens:** Setting arbitrary width and height without calculating aspect ratio
**How to avoid:** Read image dimensions and calculate proportional sizing
**Warning signs:** Distorted logos, complaints about unprofessional appearance
**Code example:**
```typescript
// Better approach: Calculate aspect ratio
import sizeOf from 'image-size';

async function getScaledDimensions(
  buffer: Buffer,
  targetWidth: number
): Promise<{ width: number; height: number }> {
  const dimensions = sizeOf(buffer);
  const aspectRatio = dimensions.height / dimensions.width;
  return {
    width: targetWidth,
    height: Math.round(targetWidth * aspectRatio),
  };
}

// Usage
const dims = await getScaledDimensions(logoBuffer, 144); // 1.5 inch width
new ImageRun({
  data: logoBuffer,
  transformation: dims,
});
```

### Pitfall 6: Page Numbering Format Doesn't Match Requirements
**What goes wrong:** Page numbers show as "1" instead of "Page 1 of 10" format
**Why it happens:** Not using TextRun composition with PageNumber fields
**How to avoid:** Compose TextRuns with static text and PageNumber fields
**Warning signs:** Simple "1, 2, 3" numbering instead of required format
**Code example:**
```typescript
// User decision: Page numbers in footer (cover unnumbered, first interior page = 1)
new Paragraph({
  children: [
    new TextRun({ text: 'Page ', size: 18 }),
    new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
    new TextRun({ text: ' of ', size: 18 }),
    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 }),
  ],
  alignment: AlignmentType.CENTER, // Or RIGHT per user decision
})
```

## Code Examples

Verified patterns from official sources:

### Adding Logo to Cover Page (Body Content)
```typescript
// Source: User decisions + docx library patterns
// Cover page logo: top center, 1-1.5 inches, above title block
function generateCoverPageWithLogo(logoBuffer: Buffer, companyProfile: any): Paragraph[] {
  return [
    // Vertical spacing
    new Paragraph({ text: '', spacing: { before: 2880 } }), // 2 inches

    // Logo
    new Paragraph({
      children: [
        new ImageRun({
          data: logoBuffer,
          transformation: {
            width: 144, // 1.5 inches = 144 points
            height: 96, // Maintain aspect ratio (example)
          },
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 }, // Space after logo
    }),

    // Title block continues below...
    new Paragraph({
      children: [
        new TextRun({
          text: 'PROPOSAL RESPONSE',
          size: 48,
          bold: true,
          color: '2563eb',
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
  ];
}
```

### Creating Header with Logo and Solicitation Info
```typescript
// Source: User decisions - small logo left, other elements per framework
// Framework specifies: Company logo (left), Volume title (center), Solicitation number (right)
function createHeader(logoBuffer: Buffer, volumeTitle: string, solicitationNumber: string): Header {
  return new Header({
    children: [
      new Paragraph({
        children: [
          new ImageRun({
            data: logoBuffer,
            transformation: {
              width: 50, // Small for header
              height: 33,
            },
          }),
          new TextRun({
            text: `    ${volumeTitle}    Solicitation: ${solicitationNumber}`,
            size: 18,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
      }),
    ],
  });
}
```

### Creating Footer with Proprietary Notice and Page Numbers
```typescript
// Source: User decisions - proprietary notice left, page numbers (cover unnumbered)
function createFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: 'PROPRIETARY - Use or disclosure subject to restrictions',
            size: 16,
            italics: true,
            color: '64748b', // Subtle gray
          }),
          new TextRun({
            text: '\t\t', // Tabs to push page number right
          }),
          new TextRun({
            text: 'Page ',
            size: 18,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 18,
          }),
        ],
        tabStops: [
          { type: 'right', position: 9000 }, // Right-align page numbers
        ],
      }),
    ],
  });
}
```

### Complete Document Structure with Branding
```typescript
// Source: Combining all patterns with user decisions
export async function generateProposalWithBranding(
  volumeType: string,
  content: any,
  companyProfile: any,
  solicitationNumber: string
): Promise<Document> {
  // Fetch logo once
  const logoUrl = companyProfile.logo_url; // From document_assets table
  const logoBuffer = await fetchLogoAsBuffer(logoUrl);

  const volumeTitle = formatVolumeTitle(volumeType);

  const doc = new Document({
    features: {
      updateFields: true, // Enable TOC auto-update
    },
    styles: PROPOSAL_STYLES,
    numbering: {
      config: [HEADING_NUMBERING],
    },
    sections: [
      {
        properties: {
          titlePage: true, // Different first page (cover has no header/footer)
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        headers: {
          first: new Header({ children: [] }), // Empty for cover
          default: createHeader(logoBuffer, volumeTitle, solicitationNumber),
        },
        footers: {
          first: new Footer({ children: [] }), // Empty for cover
          default: createFooter(),
        },
        children: [
          // Cover page with logo
          ...generateCoverPageWithLogo(logoBuffer, companyProfile),
          new Paragraph({ children: [new PageBreak()] }),

          // Table of Contents
          new Paragraph({
            text: 'TABLE OF CONTENTS',
            heading: HeadingLevel.HEADING_1,
          }),
          new TableOfContents('Contents', {
            hyperlink: true,
            headingStyleRange: '1-3', // 3 levels per user decision
          }),

          new Paragraph({ children: [new PageBreak()] }),

          // Table of Exhibits
          new Paragraph({
            text: 'TABLE OF EXHIBITS',
            heading: HeadingLevel.HEADING_2,
          }),
          new TableOfContents('Exhibits', {
            hyperlink: true,
            captionLabelIncludingNumbers: 'Figure',
          }),

          new Paragraph({ children: [new PageBreak()] }),

          // Content sections
          ...generateSections(content),
        ],
      },
    ],
  });

  return doc;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-fetch library | Native fetch API | Node 18 (2022) | Eliminates external dependency, standard API across platforms |
| Manual TOC generation | Field codes with updateFields | Always preferred | Word handles updates, no manual page tracking needed |
| base64 image encoding | Buffer objects | docx library standard | Required by ImageRun API, more efficient |
| Multiple sections for cover | titlePage property | docx v5+ | Simpler document structure, better page numbering |
| Callback-based fetch | async/await | ES2017+ | Cleaner code, better error handling |

**Deprecated/outdated:**
- **node-fetch package:** Use native fetch (Node 18+), no external package needed
- **Static TOC generation:** Current generator has static TOC (lines 230-346 in generator.ts) - replace with field codes
- **Manual page number tracking:** Current code estimates page numbers (line 241) - let Word handle with field codes

## Open Questions

Things that couldn't be fully resolved:

1. **Logo aspect ratio calculation**
   - What we know: docx ImageRun accepts width/height in transformation property
   - What's unclear: Should we read actual image dimensions from buffer or use fixed aspect ratios per logo variant?
   - Recommendation: Start with fixed dimensions (user can specify in UI), add auto-calculation later if needed. Use image-size package if auto-calculation required.

2. **Table of Exhibits - Figures vs Tables**
   - What we know: captionLabelIncludingNumbers can create table of figures/tables
   - What's unclear: User said "diagrams + tables" - need one TOC or two (one for figures, one for tables)?
   - Recommendation: Implement single Table of Exhibits with captionLabelIncludingNumbers: 'Figure' initially. Add separate table for tables if caption labeling distinguishes them.

3. **Logo fallback strategy**
   - What we know: Logo fetch can fail (network issues, invalid URL)
   - What's unclear: Should document generation fail or continue without logo?
   - Recommendation: Continue with text-only header as fallback, log warning. Allows document generation to succeed even if logo unavailable.

4. **Solicitation number source**
   - What we know: User wants solicitation number in header
   - What's unclear: Where is solicitation number stored? Document metadata? RFP extraction?
   - Recommendation: Check document table schema, likely in documents table. Pass as parameter to generator function.

5. **Header content layout specifics**
   - What we know: Framework says "Company logo (left), Volume title (center), Solicitation number (right)"
   - What's unclear: How to achieve three-position layout in single paragraph? Tabs? Table?
   - Recommendation: Start with left-aligned paragraph with logo + text + tabs for now. Can refine layout with table-based header if needed for precise center/right positioning.

## Sources

### Primary (HIGH confidence)
- [docx npm library documentation](https://www.npmjs.com/package/docx) - Version 9.5.1 features and API
- [docx GitHub - Images documentation](https://github.com/dolanmiu/docx/blob/master/docs/usage/images.md) - ImageRun API and image handling
- [docx GitHub - Table of Contents documentation](https://github.com/dolanmiu/docx/blob/master/docs/usage/table-of-contents.md) - TOC field codes and options
- [docx API - ImageRun](https://docx.js.org/api/classes/ImageRun.html) - Official ImageRun API reference
- [docx API - HeaderFooterReferenceType](https://docx.js.org/api/variables/HeaderFooterReferenceType.html) - Header/footer type documentation
- Codebase files: generator.ts, styles.ts, numbering.ts, company-types.ts - Current implementation

### Secondary (MEDIUM confidence)
- [Node.js Download Image from URL as Buffer: Complete Guide for 2026](https://copyprogramming.com/howto/node-js-download-image-from-url-as-buffer) - Verified Node 18+ fetch approach
- [Buffering Image Data Using node-fetch in Node.js](https://medium.com/@akhilanand.ak01/buffering-image-data-using-node-fetch-in-node-js-bbf929cdda31) - Buffer conversion patterns
- [Saving Images In Node.js: Using Fetch with arrayBuffer() and Buffer](https://chrisfrew.in/blog/saving-images-in-node-js-using-fetch-with-array-buffer-and-buffer/) - arrayBuffer() to Buffer conversion
- [docx GitHub Issues](https://github.com/dolanmiu/docx/issues) - Common problems and solutions
- [Microsoft Support - Configure headers and footers for different sections](https://support.microsoft.com/en-us/office/configure-headers-and-footers-for-different-sections-of-a-word-document-94332643-a6e9-46aa-ab29-064f1d356db6) - Word titlePage behavior

### Tertiary (LOW confidence)
- Various WebSearch results about docx library usage patterns - Useful for ecosystem understanding but not authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - docx library well-documented, native fetch is standard for Node 18+
- Architecture: HIGH - Patterns verified in official documentation and codebase analysis
- Pitfalls: MEDIUM-HIGH - Based on GitHub issues, community patterns, and common mistakes with similar libraries
- Image handling: HIGH - Verified in official docs and current 2026 best practices
- TOC field codes: HIGH - Official documentation clear on updateFields requirement
- Header/footer configuration: MEDIUM-HIGH - titlePage property documented, but exact layout patterns require implementation testing

**Research date:** 2026-02-02
**Valid until:** 30 days (stable library, framework unchanged)

**Key assumptions:**
1. Node.js 18+ is available (native fetch)
2. Company profile includes logo_url field (verified in company-types.ts)
3. Supabase storage URLs are accessible from backend
4. Document table includes solicitation_number field (to be verified)
5. Framework spec in Proposal_Response_Generation_Framework.md is authoritative

**Next steps for planner:**
1. Verify solicitation_number storage location
2. Determine if image-size package needed for aspect ratio calculation
3. Confirm single vs dual Table of Exhibits approach with user
4. Design logo fallback UI/behavior
5. Plan header layout implementation (tabs vs table)
