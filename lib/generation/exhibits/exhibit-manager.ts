import { getServerClient } from '@/lib/supabase/client';

/**
 * Exhibit Manager (Framework Part 4.1)
 * Manages unified exhibit numbering and cross-references
 */

export interface Exhibit {
  id?: string;
  response_id: string;
  exhibit_number: number;
  exhibit_type: 'org_chart' | 'timeline' | 'process_diagram' | 'table' | 'graphic';
  title: string;
  image_url?: string;
  referenced_in_sections: string[];
}

export interface ExhibitWithImage extends Exhibit {
  imageBuffer?: Buffer;
  imagePath?: string;
}

/**
 * Create and store exhibit
 */
export async function createExhibit(exhibit: Omit<Exhibit, 'id'>): Promise<Exhibit> {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('exhibits')
    .insert(exhibit)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create exhibit: ${error.message}`);
  }

  return data as Exhibit;
}

/**
 * Create exhibit with image data
 */
export async function createExhibitWithImage(
  exhibit: Omit<Exhibit, 'id'>,
  imagePath: string
): Promise<ExhibitWithImage> {
  const createdExhibit = await createExhibit(exhibit);

  // Read image if path provided
  let imageBuffer: Buffer | undefined;
  if (imagePath) {
    const { readFile } = await import('fs/promises');
    imageBuffer = await readFile(imagePath);
  }

  return {
    ...createdExhibit,
    imageBuffer,
    imagePath,
  };
}

/**
 * Get all exhibits for a response
 */
export async function getExhibitsForResponse(responseId: string): Promise<Exhibit[]> {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('exhibits')
    .select('*')
    .eq('response_id', responseId)
    .order('exhibit_number');

  if (error) {
    throw new Error(`Failed to fetch exhibits: ${error.message}`);
  }

  return (data as Exhibit[]) || [];
}

/**
 * Get next exhibit number for a response
 */
export async function getNextExhibitNumber(responseId: string): Promise<number> {
  const exhibits = await getExhibitsForResponse(responseId);
  
  if (exhibits.length === 0) {
    return 1;
  }

  const maxNumber = Math.max(...exhibits.map((e) => e.exhibit_number));
  return maxNumber + 1;
}

/**
 * Generate exhibit cross-reference text (Framework Part 4.1)
 * Format: "as shown in ***Exhibit X***"
 */
export function generateExhibitReference(
  exhibitNumber: number,
  contextText?: string
): string {
  if (contextText) {
    return `As shown in Exhibit ${exhibitNumber}, ${contextText}`;
  }
  return `See Exhibit ${exhibitNumber}`;
}

/**
 * Format exhibit caption (Framework Part 4.1)
 * Format: "Exhibit X. Description"
 */
export function formatExhibitCaption(exhibitNumber: number, title: string): string {
  return `Exhibit ${exhibitNumber}. ${title}`;
}

/**
 * Generate Table of Exhibits for document
 */
export async function generateTableOfExhibits(responseId: string): Promise<string[]> {
  const exhibits = await getExhibitsForResponse(responseId);

  const lines: string[] = [];
  lines.push('TABLE OF EXHIBITS');
  lines.push('');

  for (const exhibit of exhibits) {
    lines.push(`Exhibit ${exhibit.exhibit_number}. ${exhibit.title}`);
  }

  return lines;
}

/**
 * Generate Table of Exhibits as DOCX Paragraphs
 */
export function generateTableOfExhibitsParagraphs(
  exhibits: Exhibit[]
): any[] {
  const { Paragraph, TextRun, HeadingLevel } = require('docx');
  const paragraphs: any[] = [];

  paragraphs.push(
    new Paragraph({
      text: 'TABLE OF EXHIBITS',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 240 },
    })
  );

  for (const exhibit of exhibits) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Exhibit ${exhibit.exhibit_number}. ${exhibit.title}`,
            size: 22,
            font: 'Arial',
          }),
        ],
        spacing: { after: 120 },
      })
    );
  }

  return paragraphs;
}

/**
 * Update exhibit references in sections
 */
export async function updateExhibitReferences(
  exhibitId: string,
  sectionNames: string[]
): Promise<void> {
  const supabase = getServerClient();

  await supabase
    .from('exhibits')
    .update({
      referenced_in_sections: sectionNames,
    })
    .eq('id', exhibitId);
}

/**
 * Validate all exhibit cross-references
 * Ensures every exhibit is referenced and every reference has an exhibit
 */
export async function validateExhibitReferences(
  responseId: string,
  documentContent?: string
): Promise<{
  valid: boolean;
  unreferencedExhibits: number[];
  missingExhibits: number[];
  issues: string[];
}> {
  const exhibits = await getExhibitsForResponse(responseId);
  const issues: string[] = [];

  // Find all exhibit references in content if provided
  const referencedNumbers = new Set<number>();
  if (documentContent) {
    const referenceRegex = /Exhibit\s+(\d+)/gi;
    let match;

    while ((match = referenceRegex.exec(documentContent)) !== null) {
      referencedNumbers.add(parseInt(match[1]));
    }
  }

  // Check for unreferenced exhibits
  const unreferencedExhibits: number[] = [];
  for (const exhibit of exhibits) {
    const hasReference = documentContent
      ? referencedNumbers.has(exhibit.exhibit_number)
      : exhibit.referenced_in_sections && exhibit.referenced_in_sections.length > 0;

    if (!hasReference) {
      unreferencedExhibits.push(exhibit.exhibit_number);
      issues.push(
        `Exhibit ${exhibit.exhibit_number} (${exhibit.title}) is never referenced in the document`
      );
    }
  }

  // Check for missing exhibits (references without exhibits)
  const existingNumbers = new Set(exhibits.map((e) => e.exhibit_number));
  const missingExhibits: number[] = [];

  if (documentContent) {
    for (const refNum of referencedNumbers) {
      if (!existingNumbers.has(refNum)) {
        missingExhibits.push(refNum);
        issues.push(`Exhibit ${refNum} is referenced but doesn't exist`);
      }
    }
  }

  return {
    valid: unreferencedExhibits.length === 0 && missingExhibits.length === 0,
    unreferencedExhibits,
    missingExhibits,
    issues,
  };
}

/**
 * Renumber exhibits sequentially
 * Use when exhibits are added/removed and need to be sequential
 */
export async function renumberExhibits(responseId: string): Promise<void> {
  const exhibits = await getExhibitsForResponse(responseId);
  const supabase = getServerClient();

  for (let i = 0; i < exhibits.length; i++) {
    if (exhibits[i].exhibit_number !== i + 1) {
      await supabase
        .from('exhibits')
        .update({ exhibit_number: i + 1 })
        .eq('id', exhibits[i].id);
    }
  }
}
