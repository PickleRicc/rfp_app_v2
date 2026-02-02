import { inngest } from '../client';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import { getServerClient } from '@/lib/supabase/client';

// Helper function to extract JSON from markdown code blocks
function extractJSON(text: string): string {
  let cleaned = text.trim();
  
  // Remove opening code block markers
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7); // Remove '```json'
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3); // Remove '```'
  }
  
  // Remove closing code block markers
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3); // Remove trailing '```'
  }
  
  // Trim any remaining whitespace
  return cleaned.trim();
}

const SECTIONS = [
  { name: 'Executive Summary', number: 1 },
  { name: 'Project Scope', number: 2 },
  { name: 'Technical Requirements', number: 3 },
  { name: 'Timeline and Milestones', number: 4 },
  { name: 'Budget and Pricing', number: 5 },
  { name: 'Evaluation Criteria', number: 6 },
  { name: 'Submission Requirements', number: 7 },
  { name: 'Key Stakeholders', number: 8 },
];

export const rfpIntelligenceAnalyzer = inngest.createFunction(
  { id: 'stage-1-rfp-intelligence' },
  { event: 'document.classified' },
  async ({ event, step }) => {
    const { documentId, fileContent } = event.data;

    // Log start
    await step.run('log-start', async () => {
      const supabase = getServerClient();
      await supabase.from('processing_logs').insert({
        document_id: documentId,
        stage: 'stage-1-rfp-intelligence',
        status: 'started',
        metadata: {},
      });
    });

    // Update document status
    await step.run('update-status-processing', async () => {
      const supabase = getServerClient();
      await supabase
        .from('documents')
        .update({ status: 'processing' })
        .eq('id', documentId);
    });

    // Process each section
    for (const section of SECTIONS) {
      await step.run(`analyze-${section.name.toLowerCase().replace(/\s+/g, '-')}`, async () => {
        const response = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: `You are analyzing an RFP document. Extract and analyze the "${section.name}" section.

Document content:
${fileContent}

Instructions:
1. Find all information related to "${section.name}"
2. Provide a comprehensive summary
3. Extract key points, requirements, and important details
4. If this section is not found or not applicable, say so clearly

Respond in JSON format:
{
  "found": true|false,
  "summary": "detailed summary of the section",
  "key_points": ["point 1", "point 2", ...],
  "critical_info": ["critical item 1", ...],
  "notes": "any additional important notes"
}`,
            },
          ],
        });

        const content = response.content[0];
        if (content.type !== 'text') {
          throw new Error('Unexpected response type');
        }

        const jsonText = extractJSON(content.text);
        const result = JSON.parse(jsonText);

        // Save section result
        const supabase = getServerClient();
        await supabase.from('section_results').insert({
          document_id: documentId,
          section_name: section.name,
          section_number: section.number,
          content: JSON.stringify(result),
          metadata: {
            found: result.found,
            key_points_count: result.key_points?.length || 0,
          },
        });

        return result;
      });
    }

    // Extract individual requirements
    const requirements = await step.run('extract-requirements', async () => {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 16384,
        messages: [
          {
            role: 'user',
            content: `Extract ALL requirements, deliverables, and work products from this government contracting document.

IMPORTANT: This may be a Performance Work Statement (PWS), Statement of Work (SOW), or traditional RFP. Extract ALL of the following:

1. **Traditional Requirements**:
   - "Shall" statements (mandatory requirements)
   - "Should" or "will" statements (desired requirements)
   - "Must" statements (mandatory requirements)

2. **PWS/SOW Deliverables** (CRITICAL - often listed in tables):
   - Specific deliverables (reports, documents, software, services)
   - Work products (artifacts, outputs, results)
   - Performance objectives
   - Service level requirements
   - Any numbered deliverable items (e.g., "Deliverable 1.1", "Work Product A")

3. **Submission Requirements**:
   - Section L instructions
   - Proposal format requirements
   - Required volumes or sections

4. **Evaluation Criteria**:
   - Section M factors
   - Scoring criteria
   - Evaluation standards

For EACH requirement/deliverable, provide:
{
  "requirement_text": "concise description of the requirement (1-2 sentences max, extract the key requirement only)",
  "source_section": "section reference (e.g., 'PWS Section 3.1', 'Section L.4.2', 'Deliverable Table', 'Task Area 2')",
  "category": "technical|management|past_performance|price|submission",
  "priority": "mandatory|highly_desired|optional"
}

**IMPORTANT**: Keep requirement_text CONCISE (1-2 sentences). Focus on extracting the core requirement, not copying entire paragraphs.

**CRITICAL**: If you find tables listing deliverables or work products, extract EVERY row as a separate requirement.

**JSON FORMATTING RULES**:
- Properly escape all quotes in text (use \\" for quotes inside strings)
- Remove or escape any newlines within text fields
- Ensure all strings are properly terminated
- Each requirement must be a complete, valid JSON object
- Do NOT include any markdown formatting or code blocks

Return as a valid JSON array of requirements. Extract as many as possible - aim for 30+ requirements for a typical government contract.

Document content:
${fileContent}

Respond with ONLY a valid JSON array, no markdown code blocks, no other text.`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      let extracted: any[];
      try {
        const jsonText = extractJSON(content.text);
        extracted = JSON.parse(jsonText);
      } catch (e) {
        console.log('⚠️ Initial JSON parse failed, attempting repair...');
        
        // Auto-repair strategy: Fix common JSON issues
        const jsonText = extractJSON(content.text);
        
        try {
          // Strategy 1: Fix truncated JSON by adding closing brackets
          let repairedJson = jsonText.trim();
          
          // Count opening and closing brackets
          const openBrackets = (repairedJson.match(/\[/g) || []).length;
          const closeBrackets = (repairedJson.match(/\]/g) || []).length;
          const openBraces = (repairedJson.match(/\{/g) || []).length;
          const closeBraces = (repairedJson.match(/\}/g) || []).length;
          
          // If JSON is truncated or incomplete, try to close it
          if (openBraces > closeBraces) {
            // Add missing closing braces
            for (let i = 0; i < openBraces - closeBraces; i++) {
              repairedJson += '\n}';
            }
          }
          if (openBrackets > closeBrackets) {
            // Add missing closing brackets
            for (let i = 0; i < openBrackets - closeBrackets; i++) {
              repairedJson += '\n]';
            }
          }
          
          // Try to find the last complete object before the error
          // Find the last complete requirement object
          const lastCompleteMatch = repairedJson.match(/\{[^}]*\}(?=\s*(?:,\s*\{|\s*\]))/g);
          if (lastCompleteMatch && lastCompleteMatch.length > 0) {
            // Extract all complete objects
            const completeObjects = [];
            const objectMatches = repairedJson.matchAll(/\{\s*"requirement_text"[\s\S]*?\}(?=\s*[,\]])/g);
            
            for (const match of objectMatches) {
              try {
                const obj = JSON.parse(match[0]);
                completeObjects.push(obj);
              } catch (e) {
                // Skip malformed objects
                continue;
              }
            }
            
            if (completeObjects.length > 0) {
              extracted = completeObjects;
              console.log(`✅ Recovered ${completeObjects.length} requirements from partial JSON`);
            } else {
              // Last resort: try parsing the repaired JSON
              extracted = JSON.parse(repairedJson);
              console.log(`✅ Recovered using bracket repair`);
            }
          } else {
            extracted = JSON.parse(repairedJson);
            console.log(`✅ Recovered using bracket repair`);
          }
        } catch (e2) {
          console.error('❌ JSON repair failed:', e2);
          extracted = [];
        }
      }

      console.log(`📋 Extracted ${extracted.length} requirements from document`);

      // Store in rfp_requirements table
      const supabase = getServerClient();
      if (extracted.length === 0) {
        console.warn('⚠️ No requirements extracted - this might indicate Claude did not find clear requirements in the document');
        console.warn('Document may need manual review or is not a standard RFP format');
        // Don't throw error - some documents may not have extractable requirements
        // But Stage 2 will fail, which is expected
      } else {
        console.log(`💾 Saving ${extracted.length} requirements to database...`);
        
        const requirementsToInsert = extracted.map((req, idx) => ({
          document_id: documentId,
          requirement_number: `REQ ${(idx + 1).toString().padStart(3, '0')}`,
          requirement_text: req.requirement_text,
          source_section: req.source_section || 'Unknown',
          category: req.category || 'technical',
          priority: req.priority || 'mandatory',
        }));

        const { error: insertError } = await supabase.from('rfp_requirements').insert(requirementsToInsert);
        
        if (insertError) {
          console.error('❌ Failed to save requirements:', insertError);
          throw new Error(`Failed to save requirements to database. This likely means you need to run the framework enhancement migration. Error: ${insertError.message}`);
        }
        
        console.log('✅ Requirements saved successfully');
      }

      return extracted;
    });

    // Detect volume structure
    const volumeStructure = await step.run('detect-volume-structure', async () => {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `Analyze this RFP to determine the required proposal volume structure.

Document content:
${fileContent}

Answer these questions:
1. Does the RFP explicitly require separate volumes (Technical, Management, Past Performance, Price)?
2. Are there page limits specified for each volume?
3. What is the overall submission format required?

Respond in JSON format:
{
  "requires_separate_volumes": true|false,
  "volumes": ["technical", "management", "past_performance", "price"],
  "page_limits": {
    "technical": 50,
    "management": 30,
    "past_performance": 20,
    "price": 10
  },
  "submission_format": "description of format requirements",
  "notes": "any special instructions"
}

If no specific structure is mentioned, assume standard 4-volume structure.`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      let structure: any;
      try {
        const jsonText = extractJSON(content.text);
        structure = JSON.parse(jsonText);
      } catch (e) {
        // Default structure if parsing fails
        structure = {
          requires_separate_volumes: true,
          volumes: ['technical', 'management', 'past_performance', 'price'],
          page_limits: {},
          submission_format: 'Standard multi-volume proposal',
          notes: 'Using default structure',
        };
      }

      return structure;
    });

    // Extract solicitation number from document
    const solicitationNumber = await step.run('extract-solicitation-number', async () => {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: `Extract the solicitation/RFP number from this government contracting document.

Look for patterns like:
- Solicitation Number: XXXXX
- RFP Number: XXXXX
- RFQ Number: XXXXX
- Contract/Order Number: XXXXX
- FA####-##-X-####
- W####-##-X-####
- GS-##X-#####

Document content (first 5000 chars):
${fileContent.substring(0, 5000)}

Respond in JSON format:
{
  "solicitation_number": "the number you found or null if not found",
  "confidence": "high|medium|low|none"
}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return null;
      }

      try {
        const jsonText = extractJSON(content.text);
        const result = JSON.parse(jsonText);
        return result.solicitation_number || null;
      } catch (e) {
        return null;
      }
    });

    // Store metadata and solicitation number in document
    await step.run('save-document-metadata', async () => {
      const supabase = getServerClient();
      await supabase
        .from('documents')
        .update({
          metadata: volumeStructure,
          solicitation_number: solicitationNumber,
        })
        .eq('id', documentId);
    });

    // Update document status to completed
    await step.run('update-status-completed', async () => {
      const supabase = getServerClient();
      await supabase
        .from('documents')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', documentId);
    });

    // Log completion
    await step.run('log-completion', async () => {
      const supabase = getServerClient();
      await supabase.from('processing_logs').insert({
        document_id: documentId,
        stage: 'stage-1-rfp-intelligence',
        status: 'completed',
        metadata: {
          sections_processed: SECTIONS.length,
          requirements_extracted: requirements.length,
          volume_structure: volumeStructure,
        },
      });
    });

    return {
      success: true,
      sections_processed: SECTIONS.length,
      requirements_extracted: requirements.length,
      volume_structure: volumeStructure,
    };
  }
);
