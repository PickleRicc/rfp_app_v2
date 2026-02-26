import { renderMermaidToPng } from './render';
import { getDiagramTheme } from './branding';

export interface TimelinePhase {
  name: string;
  duration: number; // days
  activities?: string[];
  milestone?: string; // Optional milestone at end of phase
}

/**
 * Generate Gantt chart timeline (Framework Part 4.1)
 * Used for transition plans, project schedules, etc.
 */
export async function generateGanttChart(
  phases: TimelinePhase[],
  title: string = 'Transition Timeline'
): Promise<string> {
  if (!phases || phases.length === 0) {
    return generateDefaultTimeline();
  }

  // Generate Mermaid Gantt chart
  const mermaid = generateMermaidGantt(phases, title);

  // Render to image using shared renderer with wider width for Gantt readability
  try {
    const imagePath = await renderMermaidToPng(mermaid, 'timeline', { width: 1200 });
    return imagePath;
  } catch (error) {
    console.error('Error generating timeline:', error);
    return '';
  }
}

/**
 * Generate Mermaid Gantt chart syntax
 */
function generateMermaidGantt(phases: TimelinePhase[], title: string): string {
  const lines: string[] = [];

  // Prepend theme directive
  const theme = getDiagramTheme();
  lines.push(theme);
  lines.push('gantt');
  lines.push(`    title ${title}`);
  lines.push('    dateFormat YYYY-MM-DD');
  lines.push('    axisFormat %b %d'); // Format: Jan 15
  lines.push('');

  // Calculate start date (today or specified)
  const startDate = new Date();
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  let currentDate = new Date(startDate);

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const phaseName = phase.name || `Phase ${i + 1}`;
    const duration = phase.duration || 30; // days

    const phaseStart = new Date(currentDate);
    const phaseEnd = new Date(currentDate);
    phaseEnd.setDate(phaseEnd.getDate() + duration);

    lines.push(`    section ${phaseName}`);

    // Add activities for this phase
    if (phase.activities && Array.isArray(phase.activities)) {
      phase.activities.forEach((activity: string, idx: number) => {
        const activityDuration = Math.floor(duration / (phase.activities?.length || 1));
        const actStart = new Date(phaseStart);
        actStart.setDate(actStart.getDate() + (idx * activityDuration));

        const cleanActivity = activity.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 30);
        lines.push(`    ${cleanActivity}: ${formatDate(actStart)}, ${activityDuration}d`);
      });
    } else {
      // Single activity for the phase
      lines.push(`    ${phaseName}: ${formatDate(phaseStart)}, ${duration}d`);
    }

    // Add milestone at end of phase if specified
    if (phase.milestone) {
      const cleanMilestone = phase.milestone.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 30);
      lines.push(`    ${cleanMilestone}: milestone, ${formatDate(phaseEnd)}, 0d`);
    }

    lines.push('');

    // Move to next phase
    currentDate = new Date(phaseEnd);
  }

  return lines.join('\n');
}

/**
 * Generate default timeline (4-phase transition)
 */
async function generateDefaultTimeline(): Promise<string> {
  const defaultPhases: TimelinePhase[] = [
    { name: 'Planning & Preparation', duration: 30 },
    { name: 'Knowledge Transfer', duration: 45 },
    { name: 'Parallel Operations', duration: 30 },
    { name: 'Full Assumption', duration: 15 },
  ];

  const mermaid = generateMermaidGantt(defaultPhases, 'Transition Timeline');

  // Render using shared renderer
  try {
    const imagePath = await renderMermaidToPng(mermaid, 'default-timeline', { width: 1200 });
    return imagePath;
  } catch (error) {
    console.error('Error generating default timeline:', error);
    return '';
  }
}

/**
 * Generate milestone-based timeline (simpler format)
 */
export async function generateMilestoneTimeline(milestones: any[]): Promise<string> {
  const theme = getDiagramTheme();
  const lines: string[] = [];

  lines.push(theme);
  lines.push('timeline');
  lines.push('    title Project Milestones');

  for (const milestone of milestones) {
    lines.push(`    ${milestone.date || 'TBD'} : ${milestone.name}`);
  }

  const mermaid = lines.join('\n');

  // Render using shared renderer
  try {
    const imagePath = await renderMermaidToPng(mermaid, 'milestones', { width: 1200 });
    return imagePath;
  } catch (error) {
    console.error('Error generating milestone timeline:', error);
    return '';
  }
}
