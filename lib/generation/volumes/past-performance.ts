import { generatePastPerformance } from '../templates/past-performance';

/**
 * Generate Past Performance Volume (Framework Part 1.2 - PAST_PERFORMANCE_VOLUME)
 * Typical sections:
 * - Past Performance Overview
 * - Contract Citation 1
 * - Contract Citation 2
 * - Contract Citation 3
 * - Relevance Matrix
 */
export async function generatePastPerformanceVolume(
  pastPerformance: any[]
): Promise<any> {
  const sections: any[] = [];

  // Generate past performance content
  const ppContent = await generatePastPerformance(pastPerformance);

  sections.push({
    title: 'Past Performance',
    content: ppContent,
  });

  return { sections };
}
