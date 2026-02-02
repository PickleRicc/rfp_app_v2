import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Generate Gantt chart timeline (Framework Part 4.1)
 * Used for transition plans, project schedules, etc.
 */
export async function generateGanttChart(
  phases: any[],
  title: string = 'Transition Timeline'
): Promise<string> {
  if (!phases || phases.length === 0) {
    return generateDefaultTimeline();
  }

  // Generate Mermaid Gantt chart
  const mermaid = generateMermaidGantt(phases, title);

  // Render to image
  try {
    const imagePath = await renderMermaidDiagram(mermaid, 'timeline');
    return imagePath;
  } catch (error) {
    console.error('Error generating timeline:', error);
    return '';
  }
}

/**
 * Generate Mermaid Gantt chart syntax
 */
function generateMermaidGantt(phases: any[], title: string): string {
  const lines: string[] = [];
  
  lines.push('gantt');
  lines.push(`    title ${title}`);
  lines.push('    dateFormat YYYY-MM-DD');
  lines.push('    axisFormat %m/%d');
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
        const activityDuration = Math.floor(duration / phase.activities.length);
        const actStart = new Date(phaseStart);
        actStart.setDate(actStart.getDate() + (idx * activityDuration));
        
        const cleanActivity = activity.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 30);
        lines.push(`    ${cleanActivity}: ${formatDate(actStart)}, ${activityDuration}d`);
      });
    } else {
      // Single activity for the phase
      lines.push(`    ${phaseName}: ${formatDate(phaseStart)}, ${duration}d`);
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
function generateDefaultTimeline(): string {
  const defaultPhases = [
    { name: 'Planning & Preparation', duration: 30 },
    { name: 'Knowledge Transfer', duration: 45 },
    { name: 'Parallel Operations', duration: 30 },
    { name: 'Full Assumption', duration: 15 },
  ];

  const mermaid = generateMermaidGantt(defaultPhases, 'Transition Timeline');
  
  // Return empty string if can't generate (will be handled by caller)
  return '';
}

/**
 * Render Mermaid diagram to PNG
 */
async function renderMermaidDiagram(mermaidCode: string, filename: string): Promise<string> {
  const tempMmdPath = path.join('/tmp', `${filename}-${Date.now()}.mmd`);
  const outputPath = path.join('/tmp', `${filename}-${Date.now()}.png`);

  try {
    await writeFile(tempMmdPath, mermaidCode, 'utf-8');
    await execAsync(`npx mmdc -i ${tempMmdPath} -o ${outputPath} -b transparent -w 1200`);
    await unlink(tempMmdPath);
    return outputPath;
  } catch (error) {
    try {
      await unlink(tempMmdPath);
    } catch (e) {
      // Ignore
    }
    throw error;
  }
}

/**
 * Generate milestone-based timeline (simpler format)
 */
export function generateMilestoneTimeline(milestones: any[]): string {
  const lines: string[] = [];
  
  lines.push('timeline');
  lines.push('    title Project Milestones');

  for (const milestone of milestones) {
    lines.push(`    ${milestone.date || 'TBD'} : ${milestone.name}`);
  }

  return lines.join('\n');
}
