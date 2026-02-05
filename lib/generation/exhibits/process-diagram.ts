import { renderMermaidToPng } from './render';
import { getDiagramTheme } from './branding';

export interface DecisionPoint {
  afterStep: number;
  yesLabel?: string;
  noLabel?: string;
}

/**
 * Generate process flow diagrams (Framework Part 4.1)
 * Used for technical approaches, methodologies, workflows
 */
export async function generateProcessDiagram(
  processName: string,
  steps: string[],
  decisionPoints?: DecisionPoint[]
): Promise<string> {
  if (!steps || steps.length === 0) {
    return '';
  }

  // Generate Mermaid flowchart
  const mermaid = generateMermaidFlowchart(processName, steps, decisionPoints);

  // Render to image using shared renderer
  try {
    const imagePath = await renderMermaidToPng(mermaid, 'process');
    return imagePath;
  } catch (error) {
    console.error('Error generating process diagram:', error);
    return '';
  }
}

/**
 * Generate Mermaid flowchart syntax
 */
function generateMermaidFlowchart(
  processName: string,
  steps: string[],
  decisionPoints?: DecisionPoint[]
): string {
  const lines: string[] = [];

  // Prepend theme directive
  const theme = getDiagramTheme();
  lines.push(theme);
  lines.push('flowchart TD');
  lines.push(`    Start([${processName}])`);
  lines.push('');

  // Generate steps with appropriate shapes
  for (let i = 0; i < steps.length; i++) {
    const stepId = `Step${i + 1}`;
    const stepText = steps[i].substring(0, 40); // Truncate to 40 chars for readability

    // Check if this step is a decision point
    const lowerStep = steps[i].toLowerCase();
    const isDecision = lowerStep.includes('decide') || lowerStep.includes('if');

    if (isDecision) {
      // Diamond shape for decisions
      lines.push(`    ${stepId}{${stepText}}`);
    } else {
      // Rectangle for regular steps
      lines.push(`    ${stepId}["${stepText}"]`);
    }
  }

  lines.push('    End([Complete])');
  lines.push('');

  // Generate connections
  lines.push('    Start --> Step1');
  for (let i = 1; i < steps.length; i++) {
    lines.push(`    Step${i} --> Step${i + 1}`);
  }
  lines.push(`    Step${steps.length} --> End`);

  return lines.join('\n');
}

/**
 * Generate methodology diagram with phases
 */
export async function generateMethodologyDiagram(
  methodologyName: string,
  phases: any[]
): Promise<string> {
  const theme = getDiagramTheme();
  const mermaid = `${theme}
graph LR
    Start([Start]) --> Phase1
    ${phases.map((p, i) => {
      const phaseId = `Phase${i + 1}`;
      const nextPhaseId = i < phases.length - 1 ? `Phase${i + 2}` : 'End';
      return `${phaseId}["${p.name || `Phase ${i + 1}`}"] --> ${nextPhaseId}`;
    }).join('\n    ')}
    Phase${phases.length} --> End([Complete])
`;

  try {
    const imagePath = await renderMermaidToPng(mermaid, 'methodology');
    return imagePath;
  } catch (error) {
    console.error('Error generating methodology diagram:', error);
    return '';
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
