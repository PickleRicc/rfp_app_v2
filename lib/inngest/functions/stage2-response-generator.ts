import { inngest } from '../client';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import { getServerClient } from '@/lib/supabase/client';
import { generateProposalVolume, saveDocxToBuffer } from '@/lib/generation/docx/generator';
import { generateTechnicalVolume } from '@/lib/generation/volumes/technical';
import { generateManagementVolume } from '@/lib/generation/volumes/management';
import { generatePastPerformanceVolume } from '@/lib/generation/volumes/past-performance';
import { generatePriceVolume } from '@/lib/generation/volumes/price';
import { generateComplianceMatrix, calculateComplianceCoverage } from '@/lib/generation/compliance/matrix-generator';
import { mapRequirementsToSections } from '@/lib/generation/planning/section-mapper';
import { generateOrgChart } from '@/lib/generation/exhibits/org-chart';
import { generateGanttChart } from '@/lib/generation/exhibits/timeline';
import { integrateWinThemes } from '@/lib/generation/content/win-themes';
import { createExhibit, getNextExhibitNumber } from '@/lib/generation/exhibits/exhibit-manager';
import { writeFile } from 'fs/promises';
import path from 'path';

export const rfpResponseGenerator = inngest.createFunction(
  { id: 'stage-2-response-generator' },
  { event: 'response.generate' },
  async ({ event, step }) => {
    const { documentId } = event.data;

    // Log start
    await step.run('log-start', async () => {
      const supabase = getServerClient();
      await supabase.from('processing_logs').insert({
        document_id: documentId,
        stage: 'stage-2-response-generator',
        status: 'started',
        metadata: {},
      });
    });

    // STEP 1: Fetch all data (requirements, company data, volume structure)
    const { document, requirements, companyData, volumeStructure } = await step.run('fetch-data', async () => {
      const supabase = getServerClient();

      const { data: doc } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (!doc || !doc.company_id) {
        throw new Error('Document not found or has no company association');
      }

      // Fetch requirements extracted in Stage 1
      const { data: reqs } = await supabase
        .from('rfp_requirements')
        .select('*')
        .eq('document_id', documentId)
        .order('requirement_number');

      // Fetch company profile and related data
      const [
        { data: profile },
        { data: pastPerformance },
        { data: personnel },
        { data: valuePropositions },
        { data: serviceAreas },
        { data: toolsTechnologies },
        { data: innovations },
        { data: certifications },
        { data: naicsCodes },
        { data: contractVehicles },
        { data: competitiveAdvantages },
      ] = await Promise.all([
        supabase.from('company_profiles').select('*').eq('id', doc.company_id).single(),
        supabase.from('past_performance').select('*').eq('company_id', doc.company_id).order('start_date', { ascending: false }),
        supabase.from('personnel').select('*').eq('company_id', doc.company_id).eq('status', 'Available'),
        supabase.from('value_propositions').select('*').eq('company_id', doc.company_id),
        supabase.from('service_areas').select('*').eq('company_id', doc.company_id),
        supabase.from('tools_technologies').select('*').eq('company_id', doc.company_id),
        supabase.from('innovations').select('*').eq('company_id', doc.company_id),
        supabase.from('certifications').select('*').eq('company_id', doc.company_id),
        supabase.from('naics_codes').select('*').eq('company_id', doc.company_id),
        supabase.from('contract_vehicles').select('*').eq('company_id', doc.company_id),
        supabase.from('competitive_advantages').select('*').eq('company_id', doc.company_id),
      ]);

      // DEBUG: Log past performance data structure
      console.log('🔍 DEBUG: Past Performance Data Check');
      console.log(`   Total records: ${pastPerformance?.length || 0}`);
      if (pastPerformance && pastPerformance.length > 0) {
        console.log(`   First record contract: ${pastPerformance[0].contract_nickname}`);
        console.log(`   Achievements exist: ${!!pastPerformance[0].achievements}`);
        console.log(`   Achievements type: ${typeof pastPerformance[0].achievements}`);
        console.log(`   Achievements length: ${Array.isArray(pastPerformance[0].achievements) ? pastPerformance[0].achievements.length : 'N/A'}`);
        if (pastPerformance[0].achievements && Array.isArray(pastPerformance[0].achievements) && pastPerformance[0].achievements.length > 0) {
          console.log(`   First achievement:`, JSON.stringify(pastPerformance[0].achievements[0], null, 2));
        }
      }

      return {
        document: doc,
        requirements: reqs || [],
        companyData: {
          profile: profile || null,
          pastPerformance: pastPerformance || [],
          personnel: personnel || [],
          valuePropositions: valuePropositions || [],
          serviceAreas: serviceAreas || [],
          toolsTechnologies: toolsTechnologies || [],
          innovations: innovations || [],
          certifications: certifications || [],
          naicsCodes: naicsCodes || [],
          contractVehicles: contractVehicles || [],
          competitiveAdvantages: competitiveAdvantages || [],
        },
        volumeStructure: doc.metadata || { volumes: ['technical', 'management', 'past_performance', 'price'] },
      };
    });

    console.log('📄 Document metadata:', JSON.stringify(document?.metadata, null, 2));
    console.log('📦 Volume structure:', JSON.stringify(volumeStructure, null, 2));

    if (!document) {
      throw new Error('No document found');
    }

    if (requirements.length === 0) {
      throw new Error(
        'No requirements found for this document. This could mean:\n' +
        '1. Stage 1 analysis did not complete successfully\n' +
        '2. The rfp_requirements table does not exist (run supabase-framework-enhancement-migration.sql)\n' +
        '3. The document needs to be re-analyzed after running the migration\n\n' +
        'Please check the logs and ensure the database migration has been applied.'
      );
    }

    if (!companyData.profile) {
      throw new Error('No company profile found for this document');
    }

    // Create initial response record
    const responseId = await step.run('create-response-record', async () => {
      const supabase = getServerClient();
      const { data } = await supabase
        .from('rfp_responses')
        .insert({
          document_id: documentId,
          status: 'generating',
          content: {},
        })
        .select('id')
        .single();

      return data?.id;
    });

    // STEP 2: Generate section mappings (used by both in-document and Excel matrices)
    const allSectionMappings = await step.run('generate-section-mappings', async () => {
      console.log('🗺️  Generating section-to-requirement mappings...');
      const mappings = mapRequirementsToSections(requirements);
      console.log(`   ✅ Generated ${mappings.length} section mappings`);
      
      // Log mapping summary
      const byType = mappings.reduce((acc, m) => {
        acc[m.sectionType] = (acc[m.sectionType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('   📊 Mappings by type:', byType);
      return mappings;
    });

    // STEP 3: Generate volumes AND create DOCX files (in ONE step to preserve Paragraph objects)
    const documents = await step.run('generate-volumes-and-documents', async () => {
      const volumes: Record<string, any> = {};
      // Check if volumes array exists and has items, otherwise use default
      const volumesToGenerate = (volumeStructure.volumes && Array.isArray(volumeStructure.volumes) && volumeStructure.volumes.length > 0)
        ? volumeStructure.volumes
        : ['technical', 'management', 'past_performance', 'price'];

      // Extract page limits from metadata
      const pageLimits = volumeStructure.page_limits || {};

      console.log('📚 Volumes to generate:', volumesToGenerate);
      console.log('📄 Page limits:', pageLimits);
      console.log('📊 Requirements count:', requirements.length);
      console.log('🏢 Company data:', {
        hasProfile: !!companyData.profile,
        pastPerformanceCount: companyData.pastPerformance?.length || 0,
        personnelCount: companyData.personnel?.length || 0,
        valuePropositionsCount: companyData.valuePropositions?.length || 0,
      });

      for (const volType of volumesToGenerate) {
        try {
          console.log(`\n🔄 Generating ${volType} volume...`);
          
          if (volType === 'technical') {
            volumes.technical = await generateTechnicalVolume(requirements, companyData, pageLimits[volType]);
            console.log(`✅ Technical volume generated:`, {
              sectionsCount: volumes.technical?.sections?.length || 0,
            });
          } else if (volType === 'management') {
            volumes.management = await generateManagementVolume(requirements, companyData, pageLimits[volType]);
            console.log(`✅ Management volume generated:`, {
              sectionsCount: volumes.management?.sections?.length || 0,
            });
          } else if (volType === 'past_performance') {
            volumes.past_performance = await generatePastPerformanceVolume(companyData.pastPerformance);
            console.log(`✅ Past performance volume generated:`, {
              sectionsCount: volumes.past_performance?.sections?.length || 0,
            });
          } else if (volType === 'price') {
            volumes.price = await generatePriceVolume(requirements, companyData);
            console.log(`✅ Price volume generated:`, {
              sectionsCount: volumes.price?.sections?.length || 0,
            });
          }
        } catch (error) {
          console.error(`❌ Error generating ${volType} volume:`, error);
          // Store error but continue with other volumes
          volumes[volType] = {
            error: true,
            message: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }

      console.log('\n📋 Final volumes summary:', {
        technical: volumes.technical ? 'generated' : 'missing',
        management: volumes.management ? 'generated' : 'missing',
        past_performance: volumes.past_performance ? 'generated' : 'missing',
        price: volumes.price ? 'generated' : 'missing',
      });

      // Store serializable metadata for compliance checking (without Paragraph objects)
      const volumesMetadata: Record<string, any> = {};
      for (const [volType, volume] of Object.entries(volumes)) {
        if (volume && !volume.error) {
          volumesMetadata[volType] = {
            sections: volume.sections?.map((s: any) => ({
              title: s.title,
              contentLength: Array.isArray(s.content) ? s.content.length : 0
            })) || []
          };
        }
      }
      
      // Now integrate win themes and generate Word documents IN THE SAME STEP
      // (Paragraph objects stay alive throughout this entire operation)
      const supabase = getServerClient();
      const docs: any[] = [];

      console.log('\n🎨 Integrating win themes and generating documents...');
      console.log('💡 Value propositions count:', companyData.valuePropositions?.length || 0);
      console.log('📚 Volumes to process:', Object.keys(volumes));

      for (const [volType, volume] of Object.entries(volumes)) {
        try {
          // Skip if volume has an error
          if (volume.error) {
            console.log(`⚠️  Skipping ${volType} (error during generation)`);
            continue;
          }

          // Check if volume has sections
          if (!volume.sections || !Array.isArray(volume.sections)) {
            console.log(`⚠️  ${volType} volume has no sections array`);
            continue;
          }

          // Integrate win themes INLINE (no serialization)
          const enhancedVolume = {
            ...volume,
            sections: volume.sections.map((section: any) => ({
              ...section,
              content: Array.isArray(section.content)
                ? integrateWinThemes(section.title, section.content, companyData.valuePropositions)
                : section.content,
            })),
          };

          console.log(`✅ Enhanced ${volType} volume with win themes`);

          console.log(`\n🔄 Generating ${volType} DOCX...`);
          console.log(`   Sections: ${enhancedVolume.sections?.length || 0}`);
          
          // DEBUG: Check what we're passing to generateProposalVolume
          if (enhancedVolume.sections && enhancedVolume.sections.length > 0) {
            const firstSection = enhancedVolume.sections[0];
            console.log(`   🔍 First section title: ${firstSection.title}`);
            console.log(`   🔍 First section has content: ${!!firstSection.content}`);
            console.log(`   🔍 First section content is Array: ${Array.isArray(firstSection.content)}`);
            console.log(`   🔍 First section content length: ${Array.isArray(firstSection.content) ? firstSection.content.length : 'N/A'}`);
            if (Array.isArray(firstSection.content) && firstSection.content.length > 0) {
              console.log(`   🔍 First paragraph constructor: ${firstSection.content[0].constructor.name}`);
            }
          }

          // Generate .docx immediately (while Paragraph objects are still valid)
          const wordDoc = await generateProposalVolume(
            volType,
            enhancedVolume,
            companyData.profile!,
            [],  // Exhibits will be added in next version
            companyData,  // Pass full company data for appendices
            document,  // Pass document for cover letter
            requirements,  // Pass requirements for compliance matrix
            allSectionMappings  // Pass section mappings for compliance matrix
          );

          // Convert to buffer
          const buffer = await saveDocxToBuffer(wordDoc);

          // Save to file system
          const filename = `${volType}-volume-${responseId}.docx`;
          const filepath = path.join('/tmp', filename);
          await writeFile(filepath, buffer);

          console.log(`   ✅ Saved to: ${filepath}`);

          // Store volume metadata in database (NOT the Paragraph objects!)
          await supabase.from('proposal_volumes').insert({
            response_id: responseId,
            volume_type: volType,
            volume_number: docs.length + 1,
            content: { sectionsCount: enhancedVolume.sections.length }, // Just metadata
            docx_url: filepath,
            page_count: 0,
          });

          docs.push({
            type: volType,
            url: filepath,
            filename: filename,
          });

          console.log(`✅ ${volType} DOCX generated successfully`);
        } catch (error) {
          console.error(`❌ Error processing ${volType}:`, error);
          if (error instanceof Error) {
            console.error(`   Stack: ${error.stack}`);
          }
        }
      }

      console.log(`\n📦 Total documents generated: ${docs.length}`);
      return { docs, volumesMetadata };
    });

    // STEP 4: Verify compliance coverage
    const coveragePercent = await step.run('verify-compliance', async () => {
      const coverage = calculateComplianceCoverage(requirements, allSectionMappings);
      
      const supabase = getServerClient();
      await supabase
        .from('rfp_responses')
        .update({ requirements_coverage_percent: coverage })
        .eq('id', responseId);

      return coverage;
    });

    // STEP 5: Generate compliance matrix (Excel)
    const complianceMatrixUrl = await step.run('generate-compliance-matrix', async () => {
      try {
        console.log('📊 Generating Excel compliance matrix...');
        const matrixBuffer = await generateComplianceMatrix(requirements, allSectionMappings);
        
        // Save to file
        const filename = `compliance-matrix-${responseId}.xlsx`;
        const filepath = path.join('/tmp', filename);
        await writeFile(filepath, matrixBuffer);

        const supabase = getServerClient();
        await supabase
          .from('rfp_responses')
          .update({ compliance_matrix_url: filepath })
          .eq('id', responseId);

        console.log(`   ✅ Excel compliance matrix saved: ${filepath}`);
        return filepath;
      } catch (error) {
        console.error('Error generating compliance matrix:', error);
        return null;
      }
    });

    // STEP 6: Generate HTML for quick preview (skip - volumes don't have text content anymore)
    await step.run('generate-html-preview', async () => {
      try {
        const { generateResponseHTML } = await import('@/lib/templates/rfp-response-template');
        
        // Skip HTML generation - volumes only have metadata now, actual content is in DOCX files
        const flatContent: any = {};
        // Leave empty for now - HTML preview is deprecated

        const html = generateResponseHTML({
          content: flatContent,
          branding: {
            company_name: companyData.profile!.company_name,
          },
          metadata: {
            documentName: document.filename,
            generatedDate: new Date().toLocaleDateString(),
          },
        });

        const supabase = getServerClient();
        await supabase
          .from('rfp_responses')
          .update({ rendered_html: html })
          .eq('id', responseId);
      } catch (error) {
        console.error('Error generating HTML:', error);
      }
    });

    // STEP 7: Validate exhibits
    await step.run('validate-exhibits', async () => {
      try {
        const { validateExhibitReferences } = await import('@/lib/generation/exhibits/exhibit-manager');
        
        // Validate exhibit references
        // Note: Full content parsing would require reading the generated DOCX
        // For now, validate based on tracked references
        const validation = await validateExhibitReferences(responseId);
        
        if (!validation.valid) {
          console.warn('⚠️  Exhibit validation issues:', validation.issues);
          
          // Log validation issues
          const supabase = getServerClient();
          await supabase.from('processing_logs').insert({
            document_id: documentId,
            stage: 'exhibit-validation',
            status: 'warning',
            metadata: { 
              validation,
              message: 'Exhibit reference validation found issues'
            },
          });
        } else {
          console.log('✅ All exhibits validated successfully');
        }
      } catch (error) {
        console.error('❌ Error validating exhibits:', error);
      }
    });

    // STEP 8: Update final status
    await step.run('update-final-status', async () => {
      const supabase = getServerClient();
      
      // Update response status
      await supabase
        .from('rfp_responses')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', responseId);
      
      // Update document status to proposal_ready
      await supabase
        .from('documents')
        .update({
          status: 'proposal_ready',
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);
    });

    // Log completion
    await step.run('log-completion', async () => {
      const supabase = getServerClient();
      await supabase.from('processing_logs').insert({
        document_id: documentId,
        stage: 'stage-2-response-generator',
        status: 'completed',
        metadata: {
          response_id: responseId,
          volumes_generated: documents.docs.length,
          requirements_coverage: coveragePercent,
          compliance_matrix: complianceMatrixUrl,
        },
      });
    });

    return {
      success: true,
      response_id: responseId,
      volumes: documents.docs,
      compliance_matrix: complianceMatrixUrl,
      requirements_coverage: coveragePercent,
    };
  }
);
