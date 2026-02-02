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
} from 'docx';
import { PROPOSAL_STYLES } from './styles';
import { generateCoverLetter } from '../templates/cover-letter';
import { HEADING_NUMBERING, getHeadingNumbering, shouldOmitNumbering } from './numbering';
import { fetchLogoAsBuffer, COVER_LOGO_SIZE } from './images';
import {
  createProposalHeader,
  createProposalFooter,
  createEmptyHeader,
  createEmptyFooter,
} from './headers-footers';
import { generateTOCSection, TOCSectionChild } from './toc';

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
  document?: any
): Promise<Document> {
  const volumeTitle = formatVolumeTitle(volumeType);

  // Fetch company logo for cover page and headers
  const logoUrl = companyProfile?.logo_url;
  const logoBuffer = logoUrl ? await fetchLogoAsBuffer(logoUrl) : null;

  // Get solicitation number from document, fallback to 'TBD' if not present
  // User can update this placeholder in the generated Word document
  const solicitationNumber = document?.solicitation_number || 'TBD';

  const doc = new Document({
    features: {
      updateFields: true, // Enable TOC auto-update on document open
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
            // Page setup (Part 7.1) - 1 inch = 1440 twips
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
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
          ...generateCoverPage(volumeTitle, companyProfile, logoBuffer),
          new Paragraph({ children: [new PageBreak()] }),

          // Cover Letter (Part 1.1)
          ...(await generateCoverLetterSection(document, companyProfile, companyData)),
          new Paragraph({ children: [new PageBreak()] }),

          // Table of Contents with dynamic field codes (Part 1.1)
          // Includes main TOC (3 levels) and Table of Exhibits
          ...(generateTOCSection() as Paragraph[]),

          // Content sections
          ...generateSections(content),

          // Appendices (actual content)
          ...generateAppendices(companyData),
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
  logoBuffer: Buffer | null
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
          color: '2563eb',
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

/**
 * Generate Cover Letter Section
 * Extracts discriminators from company data and generates cover letter
 */
async function generateCoverLetterSection(
  document: any,
  companyProfile: any,
  companyData: any
): Promise<Paragraph[]> {
  if (!document || !companyProfile) {
    return [];
  }

  // Extract discriminators from value propositions
  const discriminators = companyData?.valuePropositions
    ?.slice(0, 3)
    .map((vp: any) => vp.statement) || [];

  return await generateCoverLetter(document, companyProfile, discriminators);
}

/**
 * Generate content sections from structured content
 */
function generateSections(content: any): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  console.log('📝 generateSections called with:', {
    hasContent: !!content,
    hasSections: !!content?.sections,
    sectionsCount: content?.sections?.length || 0,
  });

  if (!content || !content.sections) {
    console.warn('⚠️  No sections found in content');
    return paragraphs;
  }

  for (const section of content.sections) {
    console.log(`\n📄 Processing section: ${section.title}`);
    console.log(`   Content type: ${Array.isArray(section.content) ? 'Array' : typeof section.content}`);
    console.log(`   Content length: ${Array.isArray(section.content) ? section.content.length : 'N/A'}`);

    // Section heading (page break is manual before this)
    // Add hierarchical numbering per Framework Part 3.1
    const useNumbering = !shouldOmitNumbering(section.title);
    
    paragraphs.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_1,
        numbering: useNumbering ? getHeadingNumbering(1) : undefined,
      })
    );

    // Section content (will be paragraphs from templates)
    if (Array.isArray(section.content)) {
      console.log(`   ✅ Adding ${section.content.length} paragraph objects`);
      paragraphs.push(...section.content);
    } else if (typeof section.content === 'string') {
      console.log(`   ⚠️  Content is string, converting to paragraphs`);
      // Convert string content to paragraphs
      const textParagraphs = section.content.split('\n\n').filter((p: string) => p.trim());
      for (const text of textParagraphs) {
        paragraphs.push(
          new Paragraph({
            text: text.trim(),
            style: 'BodyText11pt',
            spacing: { after: 240 },
          })
        );
      }
    } else {
      console.warn(`   ❌ Unknown content type or empty content`);
    }
  }

  console.log(`\n📦 Total paragraphs generated: ${paragraphs.length}`);
  return paragraphs;
}

/**
 * Generate appendices with actual content
 */
function generateAppendices(companyData?: any): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Page break before appendices
  paragraphs.push(new Paragraph({ children: [new PageBreak()] }));

  // Main appendices heading
  paragraphs.push(
    new Paragraph({
      text: 'APPENDICES',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 480 },
    })
  );

  // Only generate appendices if company data is provided
  if (!companyData) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Appendices will be included when company data is available.',
            italics: true,
            size: 20,
          }),
        ],
        spacing: { before: 240 },
      })
    );
    return paragraphs;
  }

  try {
    // Import appendix generators dynamically to avoid circular dependencies
    const { generateResumesAppendix } = require('../templates/appendix-resumes');
    const { generateCertificationsAppendix } = require('../templates/appendix-certifications');
    const { generateDetailedPastPerformanceAppendix } = require('../templates/appendix-past-performance-detail');

    // Appendix A: Key Personnel Resumes
    if (companyData.personnel && companyData.personnel.length > 0) {
      const keyPersonnel = companyData.personnel.filter((p: any) =>
        p.proposed_roles?.some((r: any) => r.is_key_personnel)
      );
      
      if (keyPersonnel.length > 0) {
        paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
        const resumeAppendix = generateResumesAppendix(companyData.personnel);
        paragraphs.push(...resumeAppendix);
      }
    }

    // Appendix B: Company Certifications
    if (companyData.certifications && companyData.certifications.length > 0) {
      paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
      const certsAppendix = generateCertificationsAppendix(
        companyData.certifications,
        companyData.naicsCodes,
        companyData.contractVehicles
      );
      paragraphs.push(...certsAppendix);
    }

    // Appendix C: Detailed Past Performance
    if (companyData.pastPerformance && companyData.pastPerformance.length > 0) {
      paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
      const ppAppendix = generateDetailedPastPerformanceAppendix(companyData.pastPerformance);
      paragraphs.push(...ppAppendix);
    }
  } catch (error) {
    console.error('Error generating appendices:', error);
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Error generating appendices. Please contact support.',
            italics: true,
            size: 20,
            color: 'ef4444',
          }),
        ],
        spacing: { before: 240 },
      })
    );
  }

  return paragraphs;
}

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
