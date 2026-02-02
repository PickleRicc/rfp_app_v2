import { Paragraph, TextRun, AlignmentType } from 'docx';

/**
 * Generate Cover Letter (Framework Part 1.1 - COVER_LETTER)
 * Required elements:
 * - Addressed to Contracting Officer
 * - Solicitation reference
 * - Brief capability statement
 * - Key discriminators (2-3 bullets)
 * - Compliance statement
 * - Single point of contact
 * - Authorized signature block
 */
export async function generateCoverLetter(
  document: any,
  companyProfile: any,
  discriminators: string[]
): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];
  
  // Current date
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: today,
          size: 24, // 12pt
          font: 'Arial',
        }),
      ],
      spacing: { after: 240 },
    })
  );

  // Addressee (Contracting Officer)
  const contractingOfficer = document.metadata?.contracting_officer || 'Contracting Officer';
  const agency = document.metadata?.agency || 'Agency';
  
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: contractingOfficer,
          size: 24,
          font: 'Arial',
        }),
      ],
      spacing: { after: 60 },
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: agency,
          size: 24,
          font: 'Arial',
        }),
      ],
      spacing: { after: 240 },
    })
  );

  // Subject line
  const solicitationRef = document.filename || document.metadata?.solicitation_number || 'RFP Response';
  
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Subject: ',
          bold: true,
          size: 24,
          font: 'Arial',
        }),
        new TextRun({
          text: `Proposal in Response to ${solicitationRef}`,
          size: 24,
          font: 'Arial',
        }),
      ],
      spacing: { after: 240 },
    })
  );

  // Salutation
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Dear ${contractingOfficer}:`,
          size: 24,
          font: 'Arial',
        }),
      ],
      spacing: { after: 240 },
    })
  );

  // Opening paragraph - capability statement
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${companyProfile.company_name} is pleased to submit this proposal in response to ${solicitationRef}. ${companyProfile.elevator_pitch}`,
          size: 24,
          font: 'Arial',
        }),
      ],
      spacing: { after: 240 },
      alignment: AlignmentType.JUSTIFIED,
    })
  );

  // Key discriminators section
  if (discriminators && discriminators.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Our proposal is built on the following key strengths:`,
            size: 24,
            font: 'Arial',
          }),
        ],
        spacing: { after: 120 },
      })
    );

    // Add discriminator bullets (max 3)
    for (const discriminator of discriminators.slice(0, 3)) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: discriminator,
              size: 24,
              font: 'Arial',
            }),
          ],
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
    }

    paragraphs.push(
      new Paragraph({
        text: '',
        spacing: { after: 180 },
      })
    );
  }

  // Compliance statement
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${companyProfile.company_name} certifies full compliance with all requirements specified in the solicitation. Our technical, management, and past performance approaches demonstrate our proven capability to successfully execute this effort.`,
          size: 24,
          font: 'Arial',
        }),
      ],
      spacing: { after: 240 },
      alignment: AlignmentType.JUSTIFIED,
    })
  );

  // Point of contact
  const poc = companyProfile.proposal_poc;
  if (poc) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `For any questions regarding this proposal, please contact ${poc.name}, ${poc.title}, at ${poc.email}${poc.phone ? ` or ${poc.phone}` : ''}.`,
            size: 24,
            font: 'Arial',
          }),
        ],
        spacing: { after: 240 },
        alignment: AlignmentType.JUSTIFIED,
      })
    );
  }

  // Closing
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `We look forward to the opportunity to support ${agency} and demonstrate our commitment to excellence.`,
          size: 24,
          font: 'Arial',
        }),
      ],
      spacing: { after: 240 },
      alignment: AlignmentType.JUSTIFIED,
    })
  );

  // Respectfully
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Respectfully submitted,',
          size: 24,
          font: 'Arial',
        }),
      ],
      spacing: { after: 480 }, // Extra space for signature
    })
  );

  // Signature block
  const signer = companyProfile.authorized_signer;
  if (signer) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: signer.name,
            size: 24,
            font: 'Arial',
            bold: true,
          }),
        ],
        spacing: { after: 60 },
      })
    );

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: signer.title,
            size: 24,
            font: 'Arial',
          }),
        ],
        spacing: { after: 60 },
      })
    );

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: companyProfile.company_name,
            size: 24,
            font: 'Arial',
          }),
        ],
        spacing: { after: 60 },
      })
    );

    if (signer.email) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: signer.email,
              size: 24,
              font: 'Arial',
            }),
          ],
        })
      );
    }
  }

  return paragraphs;
}
