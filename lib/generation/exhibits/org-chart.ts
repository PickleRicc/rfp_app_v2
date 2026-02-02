import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Generate organizational chart from personnel data (Framework Part 4.1)
 */
export async function generateOrgChart(
  personnel: any[],
  companyName: string
): Promise<string> {
  // Filter to key personnel with defined roles
  const keyPersonnel = personnel.filter((p) =>
    p.proposed_roles?.some((r: any) => r.is_key_personnel)
  );

  if (keyPersonnel.length === 0) {
    return generateDefaultOrgChart(companyName);
  }

  // Build organizational hierarchy
  const hierarchy = buildOrgHierarchy(keyPersonnel);

  // Generate Mermaid diagram
  const mermaid = generateMermaidOrgChart(hierarchy, companyName);

  // Render to image
  try {
    const imagePath = await renderMermaidDiagram(mermaid, 'org-chart');
    return imagePath;
  } catch (error) {
    console.error('Error generating org chart:', error);
    return ''; // Return empty if generation fails
  }
}

/**
 * Build organizational hierarchy from personnel
 */
function buildOrgHierarchy(personnel: any[]): any {
  const hierarchy: any = {
    programManager: null,
    technicalLead: null,
    qualityManager: null,
    otherRoles: [],
  };

  for (const person of personnel) {
    const keyRole = person.proposed_roles?.find((r: any) => r.is_key_personnel);
    if (!keyRole) continue;

    const roleTitle = keyRole.role_title.toLowerCase();

    if (roleTitle.includes('program manager') || roleTitle.includes('project manager')) {
      hierarchy.programManager = { name: person.full_name, title: keyRole.role_title };
    } else if (roleTitle.includes('technical lead') || roleTitle.includes('tech lead')) {
      hierarchy.technicalLead = { name: person.full_name, title: keyRole.role_title };
    } else if (roleTitle.includes('quality') || roleTitle.includes('qa')) {
      hierarchy.qualityManager = { name: person.full_name, title: keyRole.role_title };
    } else {
      hierarchy.otherRoles.push({ name: person.full_name, title: keyRole.role_title });
    }
  }

  return hierarchy;
}

/**
 * Generate Mermaid diagram syntax for org chart
 */
function generateMermaidOrgChart(hierarchy: any, companyName: string): string {
  const nodes: string[] = [];
  const edges: string[] = [];

  // Create node IDs (no spaces allowed in Mermaid)
  const pmId = 'PM';
  const tlId = 'TL';
  const qmId = 'QM';

  // Program Manager (top level)
  if (hierarchy.programManager) {
    nodes.push(`${pmId}["${hierarchy.programManager.title}<br/>${hierarchy.programManager.name}"]`);
  } else {
    nodes.push(`${pmId}["Program Manager<br/>TBD"]`);
  }

  // Technical Lead
  if (hierarchy.technicalLead) {
    nodes.push(`${tlId}["${hierarchy.technicalLead.title}<br/>${hierarchy.technicalLead.name}"]`);
    edges.push(`${pmId} --> ${tlId}`);
  }

  // Quality Manager
  if (hierarchy.qualityManager) {
    nodes.push(`${qmId}["${hierarchy.qualityManager.title}<br/>${hierarchy.qualityManager.name}"]`);
    edges.push(`${pmId} --> ${qmId}`);
  }

  // Other roles report to Technical Lead
  hierarchy.otherRoles.forEach((role: any, idx: number) => {
    const roleId = `R${idx + 1}`;
    nodes.push(`${roleId}["${role.title}<br/>${role.name}"]`);
    if (hierarchy.technicalLead) {
      edges.push(`${tlId} --> ${roleId}`);
    } else {
      edges.push(`${pmId} --> ${roleId}`);
    }
  });

  return `
graph TD
    ${nodes.join('\n    ')}
    ${edges.join('\n    ')}
    
    classDef default fill:#f0f9ff,stroke:#2563eb,stroke-width:2px,color:#000
`;
}

/**
 * Generate default org chart when no personnel data
 */
function generateDefaultOrgChart(companyName: string): string {
  return ''; // Return empty for now, can implement placeholder later
}

/**
 * Render Mermaid diagram to PNG image
 */
async function renderMermaidDiagram(mermaidCode: string, filename: string): Promise<string> {
  const tempMmdPath = path.join('/tmp', `${filename}-${Date.now()}.mmd`);
  const outputPath = path.join('/tmp', `${filename}-${Date.now()}.png`);

  try {
    // Write Mermaid code to temp file
    await writeFile(tempMmdPath, mermaidCode, 'utf-8');

    // Render using mmdc (Mermaid CLI)
    await execAsync(`npx mmdc -i ${tempMmdPath} -o ${outputPath} -b transparent`);

    // Clean up temp file
    await unlink(tempMmdPath);

    return outputPath;
  } catch (error) {
    console.error('Error rendering Mermaid diagram:', error);
    // Clean up on error
    try {
      await unlink(tempMmdPath);
    } catch (e) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Generate simple box-style org chart (fallback)
 */
export function generateSimpleOrgChart(personnel: any[]): string {
  const lines: string[] = [];
  
  lines.push('PROPOSED ORGANIZATIONAL STRUCTURE');
  lines.push('='.repeat(50));
  lines.push('');

  const keyPersonnel = personnel.filter((p) =>
    p.proposed_roles?.some((r: any) => r.is_key_personnel)
  );

  for (const person of keyPersonnel) {
    const role = person.proposed_roles?.find((r: any) => r.is_key_personnel);
    if (role) {
      lines.push(`${role.role_title}: ${person.full_name}`);
    }
  }

  return lines.join('\n');
}
