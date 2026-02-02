import { Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';

/**
 * Generate Appendix B: Company Certifications
 * Lists all company certifications, registrations, and qualifications
 */
export function generateCertificationsAppendix(
  certifications: any[],
  naicsCodes?: any[],
  contractVehicles?: any[]
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      text: 'Appendix B: Company Certifications and Registrations',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 360 },
    })
  );

  // Certifications section
  if (certifications && certifications.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Corporate Certifications',
            bold: true,
            size: 24,
          }),
        ],
        spacing: { before: 240, after: 180 },
      })
    );

    for (const cert of certifications) {
      // Certification name
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: cert.certification_type,
              bold: true,
              size: 22,
            }),
          ],
          spacing: { before: 180, after: 60 },
        })
      );

      // Certification details
      const details: { label: string; value: string }[] = [];
      if (cert.certifying_agency) {
        details.push({ label: 'Certifying Agency', value: cert.certifying_agency });
      }
      if (cert.certification_number) {
        details.push({ label: 'Certification Number', value: cert.certification_number });
      }
      if (cert.effective_date) {
        details.push({ label: 'Effective Date', value: cert.effective_date });
      }
      if (cert.expiration_date) {
        details.push({ label: 'Expiration Date', value: cert.expiration_date });
      }

      for (const detail of details) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${detail.label}: `,
                bold: true,
                size: 20,
              }),
              new TextRun({
                text: detail.value,
                size: 20,
              }),
            ],
            spacing: { after: 60 },
          })
        );
      }

      paragraphs.push(
        new Paragraph({
          text: '',
          spacing: { after: 120 },
        })
      );
    }
  }

  // NAICS Codes section
  if (naicsCodes && naicsCodes.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'NAICS Codes',
            bold: true,
            size: 24,
          }),
        ],
        spacing: { before: 480, after: 180 },
      })
    );

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'The company is registered under the following NAICS codes:',
            size: 22,
          }),
        ],
        spacing: { after: 180 },
      })
    );

    for (const naics of naicsCodes) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${naics.code}${naics.is_primary ? ' (Primary)' : ''}: `,
              bold: true,
              size: 22,
            }),
            new TextRun({
              text: naics.title,
              size: 22,
            }),
            naics.size_standard
              ? new TextRun({
                  text: ` | Size Standard: ${naics.size_standard}`,
                  size: 20,
                  italics: true,
                })
              : new TextRun({ text: '' }),
          ],
          bullet: { level: 0 },
          spacing: { after: 120 },
        })
      );
    }
  }

  // Contract Vehicles section
  if (contractVehicles && contractVehicles.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Contract Vehicles',
            bold: true,
            size: 24,
          }),
        ],
        spacing: { before: 480, after: 180 },
      })
    );

    for (const vehicle of contractVehicles) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: vehicle.vehicle_name,
              bold: true,
              size: 22,
            }),
          ],
          spacing: { before: 180, after: 60 },
        })
      );

      const vehicleDetails: { label: string; value: string }[] = [];
      if (vehicle.contract_number) {
        vehicleDetails.push({ label: 'Contract Number', value: vehicle.contract_number });
      }
      if (vehicle.vehicle_type) {
        vehicleDetails.push({ label: 'Type', value: vehicle.vehicle_type });
      }
      if (vehicle.ordering_period_end) {
        vehicleDetails.push({ label: 'Ordering Period Ends', value: vehicle.ordering_period_end });
      }
      if (vehicle.ceiling_value) {
        vehicleDetails.push({ label: 'Ceiling Value', value: `$${vehicle.ceiling_value.toLocaleString()}` });
      }

      for (const detail of vehicleDetails) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${detail.label}: `,
                bold: true,
                size: 20,
              }),
              new TextRun({
                text: detail.value,
                size: 20,
              }),
            ],
            spacing: { after: 60 },
          })
        );
      }

      if (vehicle.labor_categories && vehicle.labor_categories.length > 0) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Available Labor Categories: ',
                bold: true,
                size: 20,
              }),
              new TextRun({
                text: vehicle.labor_categories.join(', '),
                size: 20,
              }),
            ],
            spacing: { after: 120 },
          })
        );
      }
    }
  }

  return paragraphs;
}
