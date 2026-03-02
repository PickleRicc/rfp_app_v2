import {
  Document,
  Paragraph,
  TextRun,
  PageBreak,
  Header,
  Footer,
  AlignmentType,
  PageNumber,
  NumberFormat,
  HeadingLevel,
  ImageRun,
  Table,
} from 'docx';
import { PROPOSAL_STYLES, buildProposalStyles } from './styles';
import { type ProposalColorPalette } from './colors';
// Cover letter removed from DOCX generation — pages count against limit
// import { generateCoverLetter } from '../templates/cover-letter';
import { HEADING_NUMBERING, NUMBERED_LIST_NUMBERING, TABLE_BULLET_NUMBERING, getHeadingNumbering, shouldOmitNumbering } from './numbering';
import { fetchLogoAsBuffer, COVER_LOGO_SIZE } from './images';
import {
  createProposalHeader,
  createProposalFooter,
  createEmptyHeader,
  createEmptyFooter,
} from './headers-footers';
import { generateTOCSection, TOCSectionChild } from './toc';
// Compliance matrix is now a separate volume, not an in-volume appendix
// import { generateComplianceMatrix } from '../volumes/compliance-matrix';

/**
 * Generate a professional proposal volume in Word format
 * Following the Proposal Response Generation Framework Part 1 & 7
 */
export async function generateProposalVolume(
  volumeType: string,
  content: any,
  companyProfile: any,
  exhibits: any[],
  companyData?: any,
  document?: any,
  requirements?: any[],
  sectionMappings?: any[],
  colorPalette?: ProposalColorPalette,
  displayTitle?: string
): Promise<Document> {
  const volumeTitle = displayTitle || formatVolumeTitle(volumeType);

  // Fetch company logo for cover page and headers
  const logoUrl = companyProfile?.logo_url;
  const logoBuffer = logoUrl ? await fetchLogoAsBuffer(logoUrl) : null;

  // Get solicitation number from document, fallback to 'TBD' if not present
  // User can update this placeholder in the generated Word document
  const solicitationNumber = document?.solicitation_number || 'TBD';

  const styles = colorPalette ? buildProposalStyles(colorPalette) : PROPOSAL_STYLES;

  const doc = new Document({
    features: {
      updateFields: true, // Enable TOC auto-update on document open
    },
    styles,
    numbering: {
      config: [HEADING_NUMBERING, NUMBERED_LIST_NUMBERING, TABLE_BULLET_NUMBERING],
    },
    sections: [
      {
        properties: {
          titlePage: true, // Different first page (cover has no header/footer)
          page: {
            // Page setup (Part 7.1) - 1 inch = 1440 twips
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
              header: 720, // 0.5 inch from top of page to header
              footer: 720, // 0.5 inch from bottom of page to footer
            },
          },
        },
        headers: {
          first: createEmptyHeader(), // Cover page - no header
          default: createProposalHeader(
            logoBuffer,
            volumeTitle,
            solicitationNumber
          ),
        },
        footers: {
          first: createEmptyFooter(), // Cover page - no footer
          default: createProposalFooter(),
        },
        children: [
          // Cover page (Part 1.1)
          ...generateCoverPage(volumeTitle, companyProfile, logoBuffer, colorPalette),
          new Paragraph({ children: [new PageBreak()] }),

          // Table of Contents with dynamic field codes (Part 1.1)
          // Includes main TOC (3 levels) and Table of Exhibits
          ...(generateTOCSection() as Paragraph[]),

          // Content sections
          ...generateSections(content),
        ],
      },
    ],
  });

  return doc;
}

/**
 * Generate cover page (Part 1.1 - COVER_PAGE)
 * @param volumeTitle - Formatted volume title
 * @param companyProfile - Company profile with branding info
 * @param logoBuffer - Logo image buffer (null if no logo)
 */
function generateCoverPage(
  volumeTitle: string,
  companyProfile: any,
  logoBuffer: Buffer | null,
  palette?: ProposalColorPalette
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Vertical spacing
  paragraphs.push(new Paragraph({ text: '', spacing: { before: 2880 } })); // 2 inches

  // Company logo (centered, above title block)
  if (logoBuffer) {
    paragraphs.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: logoBuffer,
            transformation: {
              width: COVER_LOGO_SIZE.width,
              height: COVER_LOGO_SIZE.height,
            },
            type: 'png',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 }, // Space between logo and title
      })
    );
  }

  // Title
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'PROPOSAL RESPONSE',
          size: 48,
          bold: true,
          color: palette?.primary || '2563eb',
          font: 'Arial',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
    })
  );

  // Volume identifier
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: volumeTitle,
          size: 36,
          bold: true,
          font: 'Arial',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 960 },
    })
  );

  // Company name
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: companyProfile.company_name,
          size: 32,
          bold: true,
          font: 'Arial',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    })
  );

  // Contact info
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: companyProfile.proposal_poc?.email || '',
          size: 22,
          font: 'Arial',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    })
  );

  // Date
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          size: 22,
          font: 'Arial',
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );

  return paragraphs;
}

// generateCoverLetterSection removed — cover letters waste pages against page limits

/**
 * Generate content sections from structured content.
 *
 * Accepts three content formats:
 *   1. Array of Paragraph objects (v1 templates — already styled)
 *   2. Array of Paragraph | Table objects (v2 markdown parser — styled with tables)
 *   3. String (legacy fallback — split on double-newlines into BodyText11pt)
 */
function generateSections(content: any): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  console.log('generateSections called with:', {
    hasContent: !!content,
    hasSections: !!content?.sections,
    sectionsCount: content?.sections?.length || 0,
  });

  if (!content || !content.sections) {
    console.warn('No sections found in content');
    return elements;
  }

  for (const section of content.sections) {
    // Section heading — add hierarchical numbering per Framework Part 3.1
    const useNumbering = !shouldOmitNumbering(section.title);

    elements.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_1,
        numbering: useNumbering ? getHeadingNumbering(1) : undefined,
      })
    );

    // Section content
    if (Array.isArray(section.content)) {
      // v1 (Paragraph[]) and v2 markdown parser ((Paragraph | Table)[]) both land here
      elements.push(...section.content);
    } else if (typeof section.content === 'string') {
      // Legacy fallback — plain string content
      const textParagraphs = section.content.split('\n\n').filter((p: string) => p.trim());
      for (const text of textParagraphs) {
        elements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: text.trim(),
                size: 22,
                font: 'Arial',
              }),
            ],
            style: 'BodyText11pt',
            spacing: { after: 240 },
          })
        );
      }
    } else {
      console.warn(`Unknown content type for section "${section.title}"`);
    }
  }

  console.log(`Total elements generated: ${elements.length}`);
  return elements;
}

// generateAppendices removed — appendices are now separate proposal volumes,
// not injected into every volume. Resumes, certifications, past performance,
// and compliance matrix each get their own volume in the proposal structure.

/**
 * Format volume type into proper title
 */
function formatVolumeTitle(volumeType: string): string {
  const titles: Record<string, string> = {
    technical: 'Volume I - Technical Approach',
    management: 'Volume II - Management Approach',
    past_performance: 'Volume III - Past Performance',
    price: 'Volume IV - Price',
  };

  return titles[volumeType] || volumeType.toUpperCase();
}

/**
 * Save document to buffer
 */
export async function saveDocxToBuffer(doc: Document): Promise<Buffer> {
  const { Packer } = await import('docx');
  return await Packer.toBuffer(doc);
}
