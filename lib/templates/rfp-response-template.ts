import { ResponseContent, BrandingOptions, TemplateOptions } from '@/lib/supabase/types';

export interface TemplateData {
  content: ResponseContent;
  branding?: BrandingOptions;
  options?: TemplateOptions;
  metadata?: {
    documentName?: string;
    generatedDate?: string;
    version?: string;
  };
}

export function generateResponseHTML(data: TemplateData): string {
  const {
    content,
    branding = {},
    options = {},
    metadata = {},
  } = data;

  const {
    company_name = 'Your Company Name',
    primary_color = '#2563eb',
    secondary_color = '#1e40af',
    font_family = 'Arial, sans-serif',
  } = branding;

  const {
    include_cover_page = true,
    include_table_of_contents = true,
    page_size = 'Letter',
    margins = '1in',
  } = options;

  const generatedDate = metadata.generatedDate || new Date().toLocaleDateString();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RFP Response - ${company_name}</title>
  <style>
    /* Print-friendly styles */
    @page {
      size: ${page_size};
      margin: ${margins};
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: ${font_family};
      line-height: 1.6;
      color: #1a202c;
      background: white;
    }

    .container {
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.5in;
    }

    /* Cover Page */
    ${include_cover_page ? `
    .cover-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      page-break-after: always;
      background: linear-gradient(135deg, ${primary_color} 0%, ${secondary_color} 100%);
      color: white;
      padding: 2in;
    }

    .cover-page h1 {
      font-size: 3rem;
      font-weight: bold;
      margin-bottom: 1rem;
    }

    .cover-page h2 {
      font-size: 1.5rem;
      font-weight: 300;
      margin-bottom: 2rem;
    }

    .cover-page .company-name {
      font-size: 2rem;
      font-weight: 600;
      margin-top: 3rem;
    }

    .cover-page .date {
      font-size: 1rem;
      opacity: 0.9;
      margin-top: 1rem;
    }
    ` : ''}

    /* Table of Contents */
    ${include_table_of_contents ? `
    .toc {
      page-break-after: always;
      padding: 2rem 0;
    }

    .toc h2 {
      font-size: 2rem;
      color: ${primary_color};
      margin-bottom: 2rem;
      border-bottom: 3px solid ${primary_color};
      padding-bottom: 0.5rem;
    }

    .toc-list {
      list-style: none;
      padding-left: 0;
    }

    .toc-item {
      padding: 0.75rem 0;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
    }

    .toc-item a {
      text-decoration: none;
      color: #1a202c;
      font-weight: 500;
    }

    .toc-item a:hover {
      color: ${primary_color};
    }
    ` : ''}

    /* Section Styles */
    .section {
      page-break-inside: avoid;
      margin-bottom: 3rem;
    }

    .section-header {
      color: ${primary_color};
      font-size: 2rem;
      font-weight: bold;
      margin-bottom: 1.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 3px solid ${primary_color};
    }

    .section-content {
      font-size: 1rem;
      line-height: 1.8;
      color: #374151;
    }

    .section-content p {
      margin-bottom: 1rem;
      text-align: justify;
    }

    .section-content ul,
    .section-content ol {
      margin: 1rem 0 1rem 2rem;
    }

    .section-content li {
      margin-bottom: 0.5rem;
    }

    /* Header and Footer for pages */
    @media print {
      .page-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 0.5in;
        background: white;
        border-bottom: 1px solid #e5e7eb;
        padding: 0.25in 0.5in;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.8rem;
        color: #6b7280;
      }

      .page-footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 0.5in;
        background: white;
        border-top: 1px solid #e5e7eb;
        padding: 0.25in 0.5in;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.8rem;
        color: #6b7280;
      }
    }

    /* Highlight boxes */
    .highlight-box {
      background: #f0f9ff;
      border-left: 4px solid ${primary_color};
      padding: 1rem;
      margin: 1.5rem 0;
    }

    .highlight-box h3 {
      color: ${primary_color};
      margin-bottom: 0.5rem;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
    }

    th, td {
      border: 1px solid #e5e7eb;
      padding: 0.75rem;
      text-align: left;
    }

    th {
      background: ${primary_color};
      color: white;
      font-weight: 600;
    }

    tr:nth-child(even) {
      background: #f9fafb;
    }
  </style>
</head>
<body>
  ${include_cover_page ? `
  <div class="cover-page">
    <h1>Request for Proposal</h1>
    <h2>Response Document</h2>
    ${metadata.documentName ? `<p style="font-size: 1.2rem; margin-top: 1rem;">${metadata.documentName}</p>` : ''}
    <div class="company-name">${company_name}</div>
    <div class="date">${generatedDate}</div>
  </div>
  ` : ''}

  ${include_table_of_contents ? `
  <div class="toc">
    <h2>Table of Contents</h2>
    <ul class="toc-list">
      ${content.executive_summary ? '<li class="toc-item"><a href="#executive-summary">Executive Summary</a></li>' : ''}
      ${content.company_overview ? '<li class="toc-item"><a href="#company-overview">Company Overview</a></li>' : ''}
      ${content.technical_approach ? '<li class="toc-item"><a href="#technical-approach">Technical Approach</a></li>' : ''}
      ${content.project_scope_response ? '<li class="toc-item"><a href="#project-scope">Project Scope</a></li>' : ''}
      ${content.timeline_response ? '<li class="toc-item"><a href="#timeline">Timeline & Milestones</a></li>' : ''}
      ${content.budget_response ? '<li class="toc-item"><a href="#budget">Budget & Pricing</a></li>' : ''}
      ${content.team_qualifications ? '<li class="toc-item"><a href="#team">Team Qualifications</a></li>' : ''}
    </ul>
  </div>
  ` : ''}

  <div class="container">
    ${content.executive_summary ? `
    <div class="section" id="executive-summary">
      <h2 class="section-header">Executive Summary</h2>
      <div class="section-content">
        ${formatContent(content.executive_summary)}
      </div>
    </div>
    ` : ''}

    ${content.company_overview ? `
    <div class="section" id="company-overview">
      <h2 class="section-header">Company Overview</h2>
      <div class="section-content">
        ${formatContent(content.company_overview)}
      </div>
    </div>
    ` : ''}

    ${content.technical_approach ? `
    <div class="section" id="technical-approach">
      <h2 class="section-header">Technical Approach</h2>
      <div class="section-content">
        ${formatContent(content.technical_approach)}
      </div>
    </div>
    ` : ''}

    ${content.project_scope_response ? `
    <div class="section" id="project-scope">
      <h2 class="section-header">Project Scope</h2>
      <div class="section-content">
        ${formatContent(content.project_scope_response)}
      </div>
    </div>
    ` : ''}

    ${content.timeline_response ? `
    <div class="section" id="timeline">
      <h2 class="section-header">Timeline & Milestones</h2>
      <div class="section-content">
        ${formatContent(content.timeline_response)}
      </div>
    </div>
    ` : ''}

    ${content.budget_response ? `
    <div class="section" id="budget">
      <h2 class="section-header">Budget & Pricing</h2>
      <div class="section-content">
        ${formatContent(content.budget_response)}
      </div>
    </div>
    ` : ''}

    ${content.team_qualifications ? `
    <div class="section" id="team">
      <h2 class="section-header">Team Qualifications</h2>
      <div class="section-content">
        ${formatContent(content.team_qualifications)}
      </div>
    </div>
    ` : ''}
  </div>
</body>
</html>
`;
}

function formatContent(text: string): string {
  // Convert plain text to HTML paragraphs
  return text
    .split('\n\n')
    .filter(para => para.trim())
    .map(para => `<p>${para.trim()}</p>`)
    .join('\n');
}

export default generateResponseHTML;
