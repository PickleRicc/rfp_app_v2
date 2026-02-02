import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Generate process flow diagrams (Framework Part 4.1)
 * Used for technical approaches, methodologies, workflows
 */
export async function generateProcessDiagram(
  processName: string,
  steps: string[]
): Promise<string> {
  if (!steps || steps.length === 0) {
    return '';
  }

  // Generate Mermaid flowchart
  const mermaid = generateMermaidFlowchart(processName, steps);

  // Render to image
  try {
    const imagePath = await renderMermaidDiagram(mermaid, 'process');
    return imagePath;
  } catch (error) {
    console.error('Error generating process diagram:', error);
    return '';
  }
}

/**
 * Generate Mermaid flowchart syntax
 */
function generateMermaidFlowchart(processName: string, steps: string[]): string {
  const lines: string[] = [];
  
  lines.push('flowchart TD');
  lines.push(`    Start([${processName}])`);
  lines.push('');

  // Generate steps
  for (let i = 0; i < steps.length; i++) {
    const stepId = `Step${i + 1}`;
    const stepText = steps[i].replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50);
    
    lines.push(`    ${stepId}["${stepText}"]`);
  }

  lines.push('    End([Complete])');
  lines.push('');

  // Generate connections
  lines.push('    Start --> Step1');
  for (let i = 1; i < steps.length; i++) {
    lines.push(`    Step${i} --> Step${i + 1}`);
  }
  lines.push(`    Step${steps.length} --> End`);
  lines.push('');

  // Styling
  lines.push('    classDef default fill:#f0f9ff,stroke:#2563eb,stroke-width:2px,color:#000');
  lines.push('    classDef startEnd fill:#dbeafe,stroke:#1e40af,stroke-width:3px,color:#000');
  lines.push('    class Start,End startEnd');

  return lines.join('\n');
}

/**
 * Generate methodology diagram with phases
 */
export async function generateMethodologyDiagram(
  methodologyName: string,
  phases: any[]
): Promise<string> {
  const mermaid = `
graph LR
    Start([Start]) --> Phase1
    ${phases.map((p, i) => {
      const phaseId = `Phase${i + 1}`;
      const nextPhaseId = i < phases.length - 1 ? `Phase${i + 2}` : 'End';
      return `${phaseId}["${p.name || `Phase ${i + 1}`}"] --> ${nextPhaseId}`;
    }).join('\n    ')}
    Phase${phases.length} --> End([Complete])
    
    classDef default fill:#f0f9ff,stroke:#2563eb,stroke-width:2px
    classDef startEnd fill:#dbeafe,stroke:#1e40af,stroke-width:3px
    class Start,End startEnd
`;

  try {
    const imagePath = await renderMermaidDiagram(mermaid, 'methodology');
    return imagePath;
  } catch (error) {
    console.error('Error generating methodology diagram:', error);
    return '';
  }
}

/**
 * Render Mermaid diagram to PNG
 */
async function renderMermaidDiagram(mermaidCode: string, filename: string): Promise<string> {
  const tempMmdPath = path.join('/tmp', `${filename}-${Date.now()}.mmd`);
  const outputPath = path.join('/tmp', `${filename}-${Date.now()}.png`);

  try {
    await writeFile(tempMmdPath, mermaidCode, 'utf-8');
    await execAsync(`npx mmdc -i ${tempMmdPath} -o ${outputPath} -b transparent -w 1000`);
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
 * Generate standard process diagrams for common scenarios
 */
export const STANDARD_PROCESSES = {
  sdlc: {
    name: 'Software Development Lifecycle',
    steps: [
      'Requirements Analysis',
      'Design',
      'Development',
      'Testing',
      'Deployment',
      'Maintenance',
    ],
  },
  qualityControl: {
    name: 'Quality Control Process',
    steps: [
      'Plan Quality Standards',
      'Execute Quality Activities',
      'Monitor & Measure',
      'Identify Issues',
      'Implement Corrections',
      'Verify Resolution',
    ],
  },
  riskManagement: {
    name: 'Risk Management Process',
    steps: [
      'Identify Risks',
      'Analyze Impact',
      'Prioritize Risks',
      'Develop Mitigation Plans',
      'Implement Controls',
      'Monitor & Review',
    ],
  },
};
