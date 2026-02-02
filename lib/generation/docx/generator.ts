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
} from 'docx';
import { PROPOSAL_STYLES } from './styles';
import { generateCoverLetter } from '../templates/cover-letter';
import { HEADING_NUMBERING, getHeadingNumbering, shouldOmitNumbering } from './numbering';

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

  const doc = new Document({
    styles: PROPOSAL_STYLES,
    numbering: {
      config: [HEADING_NUMBERING],
    },
    sections: [
      {
        properties: {
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
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${companyProfile.company_name} | ${volumeTitle}`,
                    size: 18,
                    font: 'Arial',
                  }),
                ],
                alignment: AlignmentType.LEFT,
                spacing: { after: 120 },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Page ',
                    size: 18,
                    font: 'Arial',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    font: 'Arial',
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 18,
                    font: 'Arial',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 18,
                    font: 'Arial',
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          // Cover page (Part 1.1)
          ...generateCoverPage(volumeTitle, companyProfile),
          new Paragraph({ children: [new PageBreak()] }),

          // Cover Letter (Part 1.1)
          ...(await generateCoverLetterSection(document, companyProfile, companyData)),
          new Paragraph({ children: [new PageBreak()] }),

          // Table of Contents (Part 1.1) - Static generation
          ...generateTOC(content),
          new Paragraph({ children: [new PageBreak()] }),

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
 */
function generateCoverPage(volumeTitle: string, companyProfile: any): Paragraph[] {
  return [
    // Vertical spacing
    new Paragraph({ text: '', spacing: { before: 2880 } }), // 2 inches
    
    // Title
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
    }),

    // Volume identifier
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
    }),

    // Company name
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
    }),

    // Contact info
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
    }),

    // Date
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
    }),
  ];
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
 * Generate Table of Contents (Part 1.1 - TABLE_OF_CONTENTS)
 * Static generation - professional appearance, no manual updates needed
 */
function generateTOC(content: any): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  
  paragraphs.push(
    new Paragraph({
      text: 'TABLE OF CONTENTS',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 360 },
    })
  );

  let currentPage = 3; // Start after cover + cover letter + TOC

  // Extract sections from content
  if (content && content.sections) {
    for (const section of content.sections) {
      // Main section (H1)
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.title,
              size: 22,
              bold: true,
            }),
            new TextRun({
              text: '\t',
            }),
            new TextRun({
              text: currentPage.toString(),
              size: 22,
            }),
          ],
          spacing: { after: 120 },
          tabStops: [
            {
              type: 'right',
              position: 9000,
            },
          ],
        })
      );

      currentPage += Math.max(1, Math.floor((section.content?.length || 10) / 15));

      // Subsections (H2) - if available
      if (section.subsections && section.subsections.length > 0) {
        for (const subsection of section.subsections) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `  ${subsection.title}`,
                  size: 20,
                }),
                new TextRun({
                  text: '\t',
                }),
                new TextRun({
                  text: currentPage.toString(),
                  size: 20,
                }),
              ],
              spacing: { after: 80 },
              tabStops: [
                {
                  type: 'right',
                  position: 9000,
                },
              ],
            })
          );
          currentPage += 1;
        }
      }
    }
  } else {
    // Fallback generic sections
    const genericSections = [
      'Executive Summary',
      'Technical Approach',
      'Management Approach',
      'Past Performance',
      'Appendices',
    ];

    for (let i = 0; i < genericSections.length; i++) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: genericSections[i],
              size: 22,
              bold: true,
            }),
            new TextRun({
              text: '\t',
            }),
            new TextRun({
              text: (currentPage + i * 3).toString(),
              size: 22,
            }),
          ],
          spacing: { after: 120 },
          tabStops: [
            {
              type: 'right',
              position: 9000,
            },
          ],
        })
      );
    }
  }

  return paragraphs;
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
