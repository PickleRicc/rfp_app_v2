import { renderMermaidToPng } from './render';
import { getDiagramTheme } from './branding';

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
    return ''; // Return empty for no personnel
  }

  // Build organizational hierarchy
  const hierarchy = buildOrgHierarchy(keyPersonnel);

  // Generate Mermaid diagram
  const mermaid = generateMermaidOrgChart(hierarchy, companyName);

  // Render to image using shared renderer
  try {
    const imagePath = await renderMermaidToPng(mermaid, 'org-chart');
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

    const personData = {
      name: person.full_name,
      title: keyRole.role_title,
      clearance: person.clearance_level || null
    };

    if (roleTitle.includes('program manager') || roleTitle.includes('project manager')) {
      hierarchy.programManager = personData;
    } else if (roleTitle.includes('technical lead') || roleTitle.includes('tech lead')) {
      hierarchy.technicalLead = personData;
    } else if (roleTitle.includes('quality') || roleTitle.includes('qa')) {
      hierarchy.qualityManager = personData;
    } else {
      hierarchy.otherRoles.push(personData);
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

  // Helper to format node label with clearance
  const formatNodeLabel = (person: any) => {
    let label = `${person.title}<br/>${person.name}`;
    if (person.clearance) {
      label += `<br/>${person.clearance}`;
    }
    return label;
  };

  // Program Manager (top level)
  if (hierarchy.programManager) {
    nodes.push(`${pmId}["${formatNodeLabel(hierarchy.programManager)}"]`);
  } else {
    nodes.push(`${pmId}["Program Manager<br/>TBD"]`);
  }

  // Technical Lead
  if (hierarchy.technicalLead) {
    nodes.push(`${tlId}["${formatNodeLabel(hierarchy.technicalLead)}"]`);
    edges.push(`${pmId} --> ${tlId}`);
  }

  // Quality Manager
  if (hierarchy.qualityManager) {
    nodes.push(`${qmId}["${formatNodeLabel(hierarchy.qualityManager)}"]`);
    edges.push(`${pmId} --> ${qmId}`);
  }

  // Other roles report to Technical Lead
  hierarchy.otherRoles.forEach((role: any, idx: number) => {
    const roleId = `R${idx + 1}`;
    nodes.push(`${roleId}["${formatNodeLabel(role)}"]`);
    if (hierarchy.technicalLead) {
      edges.push(`${tlId} --> ${roleId}`);
    } else {
      edges.push(`${pmId} --> ${roleId}`);
    }
  });

  // Prepend theme directive
  const theme = getDiagramTheme();
  return `${theme}
graph TD
    ${nodes.join('\n    ')}
    ${edges.join('\n    ')}
`;
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
