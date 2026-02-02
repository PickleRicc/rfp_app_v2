import { Paragraph, HeadingLevel } from 'docx';
import { generateResumes } from './resume';

/**
 * Generate Appendix A: Key Personnel Resumes
 * Provides detailed resumes for all proposed key personnel
 */
export function generateResumesAppendix(personnel: any[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      text: 'Appendix A: Key Personnel Resumes',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 480 },
    })
  );

  // Generate all resumes using existing template
  const resumeParagraphs = generateResumes(personnel);
  paragraphs.push(...resumeParagraphs);

  return paragraphs;
}
