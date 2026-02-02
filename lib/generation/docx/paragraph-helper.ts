import { Paragraph, TextRun, IParagraphOptions } from 'docx';

/**
 * Helper to create a paragraph with text that will actually render in Word.
 * 
 * CRITICAL: The `text` property on Paragraph doesn't work consistently in docx v9.
 * ALL text must be wrapped in TextRun with explicit size and font.
 */
export function createTextParagraph(
  text: string,
  options: Omit<IParagraphOptions, 'text' | 'children'> = {}
): Paragraph {
  return new Paragraph({
    ...options,
    children: [
      new TextRun({
        text,
        size: 22, // 11pt = 22 half-points
        font: 'Arial',
      }),
    ],
  });
}

/**
 * Create a bullet point paragraph
 */
export function createBulletParagraph(
  text: string,
  level: number = 0,
  options: Omit<IParagraphOptions, 'text' | 'children' | 'bullet'> = {}
): Paragraph {
  return new Paragraph({
    ...options,
    bullet: { level },
    children: [
      new TextRun({
        text,
        size: 22,
        font: 'Arial',
      }),
    ],
  });
}
