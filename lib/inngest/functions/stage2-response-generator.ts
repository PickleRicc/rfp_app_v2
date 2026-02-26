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
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';
// Pipeline integration (Phase 4)
import {
  PageTracker,
  condenseContent,
  convertToPdf,
  generateOutline,
  countPagesFromDocx,
  type PageLimitStatus,
  type OutlineResult,
} from '@/lib/generation/pipeline';
import { PAGE_CONSTANTS } from '@/lib/generation/planning/page-estimator';

// Volume output with both DOCX and PDF (per CONTEXT.md: auto-generate PDF during generation)
interface VolumeOutput {
  docxBuffer: Buffer;
  pdfBuffer: Buffer | null;
  pdfError?: string;
}

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
      const { data, error } = await supabase
        .from('rfp_responses')
        .insert({
          document_id: documentId,
          status: 'generating',
          content: {},
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Failed to create response record:', error);
        throw new Error(`Failed to create response record: ${error.message}`);
      }

      console.log(`✅ Response record created: ${data?.id}`);
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
      // Normalize volume type names from AI extraction to canonical names
      const VOLUME_ALIASES: Record<string, string> = {
        'pricing': 'price',
        'cost': 'price',
        'price': 'price',
        'technical': 'technical',
        'tech': 'technical',
        'management': 'management',
        'mgmt': 'management',
        'past_performance': 'past_performance',
        'past performance': 'past_performance',
        'pastperformance': 'past_performance',
        'experience': 'past_performance',
      };

      const rawVolumes = (volumeStructure.volumes && Array.isArray(volumeStructure.volumes) && volumeStructure.volumes.length > 0)
        ? volumeStructure.volumes
        : ['technical', 'management', 'past_performance', 'price'];

      // Normalize and deduplicate
      const volumesToGenerate: string[] = [...new Set<string>(
        rawVolumes.map((v: string) => VOLUME_ALIASES[v.toLowerCase().trim()] || v.toLowerCase().trim())
      )];

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

      // Initialize page trackers for each volume (Pipeline Phase 4)
      const pageTrackers: Map<string, PageTracker> = new Map();
      const companyName = companyData.profile?.company_name || 'Our Company';

      for (const volType of volumesToGenerate) {
        const tracker = new PageTracker(volType, pageLimits[volType] || null);
        // Wire condense callback for auto-condensing when over limit
        tracker.setCondenseCallback(
          async (content, targetPages, company) => {
            const result = await condenseContent(content, targetPages, company);
            return {
              condensedContent: result.condensedContent,
              success: result.confidence !== 'low'
            };
          },
          companyName
        );
        pageTrackers.set(volType, tracker);
      }

      console.log('📏 Page trackers initialized for volumes:', Array.from(pageTrackers.keys()));

      // Store per-section page estimates for outline generation
      const volumePageEstimates: Map<string, Map<string, number>> = new Map();

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
          } else {
            console.warn(`⚠️  Unknown volume type "${volType}" - skipping. Known types: technical, management, past_performance, price`);
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

          // Track pages for this volume (Pipeline Phase 4)
          // Extract actual text from the DOCX buffer and count words for accurate page estimation
          const docxPageCount = await countPagesFromDocx(buffer);

          const totalVolumePages = docxPageCount.totalPages;

          // Store section estimates for outline generation later
          const sectionEstimates = new Map<string, number>();
          if (docxPageCount.sections.length > 0) {
            for (const section of docxPageCount.sections) {
              sectionEstimates.set(section.title, section.estimatedPages);
            }
          } else {
            // Fallback: distribute pages proportionally by paragraph count if DOCX section parsing didn't work
            const totalParagraphs = enhancedVolume.sections.reduce(
              (sum: number, s: any) => sum + (Array.isArray(s.content) ? s.content.length : 0), 0
            );
            for (const section of enhancedVolume.sections) {
              const paragraphCount = Array.isArray(section.content) ? section.content.length : 0;
              const proportion = totalParagraphs > 0 ? paragraphCount / totalParagraphs : 1 / enhancedVolume.sections.length;
              const sectionPages = Math.max(0.5, Math.round(docxPageCount.contentPages * proportion * 2) / 2);
              sectionEstimates.set(section.title, sectionPages);
            }
          }
          volumePageEstimates.set(volType, sectionEstimates);

          console.log(`   📏 DOCX page estimation for ${volType}:`);
          console.log(`      Words: ${docxPageCount.wordCount.toLocaleString()}`);
          console.log(`      Characters: ${docxPageCount.charCount.toLocaleString()}`);
          console.log(`      Content pages: ${docxPageCount.contentPages}`);
          console.log(`      Front matter pages: ${docxPageCount.frontMatterPages}`);
          if (docxPageCount.sections.length > 0) {
            for (const section of docxPageCount.sections) {
              console.log(`      ${section.title}: ${section.estimatedPages} pages (${section.wordCount} words)`);
            }
          }
          console.log(`      = Total: ${totalVolumePages} pages`);

          // Feed the calculated estimate to the tracker
          const tracker = pageTrackers.get(volType);
          if (tracker) {
            const estimatedChars = totalVolumePages * PAGE_CONSTANTS.CHARS_PER_PAGE;
            await tracker.addSection({
              sectionId: `${volType}-main`,
              volumeType: volType,
              content: 'x'.repeat(estimatedChars),
            });

            const pageStatus = tracker.getStatus();
            if (pageStatus.status === 'warning') {
              console.log(`   ⚠️  Page tracking warning for ${volType}: ${pageStatus.message}`);
            } else if (pageStatus.status === 'over') {
              console.log(`   🚨 Page limit exceeded for ${volType}: ${pageStatus.message}`);
            } else {
              console.log(`   📏 Page tracking OK for ${volType}: ${pageStatus.currentPages.toFixed(1)} pages`);
            }
          }

          // Save DOCX to file system
          const filename = `${volType}-volume-${responseId}.docx`;
          const filepath = path.join(os.tmpdir(), filename);
          await writeFile(filepath, buffer);

          console.log(`   ✅ DOCX saved to: ${filepath}`);

          // CRITICAL: Auto-generate PDF during generation (per CONTEXT.md locked decision)
          console.log(`   🔄 Converting ${volType} to PDF...`);
          const pdfResult = await convertToPdf(buffer);

          let pdfFilepath: string | null = null;
          let pdfError: string | null = null;

          if (pdfResult.success && pdfResult.pdfBuffer) {
            const pdfFilename = `${volType}-volume-${responseId}.pdf`;
            pdfFilepath = path.join(os.tmpdir(), pdfFilename);
            await writeFile(pdfFilepath, pdfResult.pdfBuffer);
            console.log(`   ✅ PDF saved to: ${pdfFilepath} (${pdfResult.conversionTimeMs}ms)`);
          } else {
            pdfError = pdfResult.error || 'Unknown PDF conversion error';
            console.warn(`   ⚠️  PDF conversion failed for ${volType}: ${pdfError}`);
          }

          // Store volume metadata in database with PDF info
          const pageStatus = tracker?.getStatus();
          const insertPayload = {
            response_id: responseId,
            volume_type: volType,
            volume_number: docs.length + 1,
            content: {
              sectionsCount: enhancedVolume.sections.length,
              pdfError: pdfError,
              pageAllocation: pageStatus ? {
                currentPages: pageStatus.currentPages,
                limitPages: pageStatus.limitPages,
                status: pageStatus.status,
                message: pageStatus.message,
              } : null,
            },
            docx_url: filepath,
            pdf_url: pdfFilepath || null,
            page_count: totalVolumePages,
          };

          console.log(`   📝 Inserting proposal_volumes record:`, {
            response_id: responseId,
            volume_type: volType,
            volume_number: insertPayload.volume_number,
            page_count: insertPayload.page_count,
            docx_url: filepath,
          });

          const { data: insertData, error: insertError } = await supabase
            .from('proposal_volumes')
            .insert(insertPayload)
            .select('id');

          if (insertError) {
            console.error(`   ❌ FAILED to insert proposal_volumes for ${volType}:`, insertError);
            console.error(`   ❌ Insert payload was:`, JSON.stringify(insertPayload, null, 2));
            // Throw to surface the error instead of silently continuing
            throw new Error(`Failed to insert proposal_volumes for ${volType}: ${insertError.message}`);
          } else {
            console.log(`   ✅ proposal_volumes record created:`, insertData);
          }

          docs.push({
            type: volType,
            url: filepath,
            pdfUrl: pdfFilepath,
            filename: filename,
            pdfError: pdfError,
          });

          console.log(`✅ ${volType} DOCX + PDF generated successfully`);
        } catch (error) {
          console.error(`❌ Error processing ${volType}:`, error);
          if (error instanceof Error) {
            console.error(`   Stack: ${error.stack}`);
          }
        }
      }

      console.log(`\n📦 Total documents generated: ${docs.length}`);

      // Aggregate page allocation status across all volumes
      const pageAllocation: Record<string, PageLimitStatus> = {};
      for (const [volType, tracker] of pageTrackers) {
        pageAllocation[volType] = tracker.getStatus();
      }

      // Log overall page tracking summary
      console.log('\n📏 PAGE TRACKING SUMMARY:');
      for (const [volType, status] of Object.entries(pageAllocation)) {
        const icon = status.status === 'ok' ? '✅' : status.status === 'warning' ? '⚠️' : '🚨';
        console.log(`   ${icon} ${volType}: ${status.currentPages.toFixed(1)}/${status.limitPages || '∞'} pages - ${status.message}`);
      }

      // Generate outline for structure review (OUTPUT-04 requirement)
      const outlines: Record<string, OutlineResult> = {};
      for (const [volType, volume] of Object.entries(volumes)) {
        if (volume && !volume.error && volume.sections) {
          const sections = volume.sections.map((s: any, idx: number) => ({
            title: s.title,
            level: s.level || (idx === 0 ? 1 : 2),
            hasExhibit: s.hasExhibit || false,
          }));

          // Pass section page estimates so outline shows real page counts
          const sectionEstimates = volumePageEstimates.get(volType);

          outlines[volType] = generateOutline(
            volType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
            sections,
            sectionEstimates  // Map<string, number> of section title → page estimate
          );
        }
      }

      return { docs, volumesMetadata, pageAllocation, outlines };
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
        const filepath = path.join(os.tmpdir(), filename);
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
            company_name: companyData?.profile?.company_name || 'Company',
          },
          metadata: {
            documentName: document?.filename || 'Document',
            generatedDate: new Date().toLocaleDateString(),
          },
        });

        const supabase = getServerClient();
        await supabase
          .from('rfp_responses')
          .update({ rendered_html: html })
          .eq('id', responseId);

        console.log('✅ HTML preview generated');
        return { success: true };
      } catch (error) {
        console.error('Error generating HTML:', error);
        return { success: false, error: String(error) };
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
        return { success: true, validation };
      } catch (error) {
        console.error('❌ Error validating exhibits:', error);
        return { success: false, error: String(error) };
      }
    });

    // STEP 8: Update final status with page allocation and outlines
    await step.run('update-final-status', async () => {
      console.log(`📝 Updating final status for document: ${documentId}, response: ${responseId}`);

      const supabase = getServerClient();

      // Calculate overall page allocation status (with null checks)
      let overallStatus = 'ok';
      let totalPages = 0;

      if (documents?.pageAllocation && typeof documents.pageAllocation === 'object') {
        const pageValues = Object.values(documents.pageAllocation) as PageLimitStatus[];
        overallStatus = pageValues.some((s) => s?.status === 'over')
          ? 'over'
          : pageValues.some((s) => s?.status === 'warning')
            ? 'warning'
            : 'ok';

        totalPages = pageValues.reduce(
          (sum, s) => sum + (s?.currentPages || 0),
          0
        );
      } else {
        console.warn('⚠️ No page allocation data available');
      }

      // Update response with page allocation and outline data
      // REQUIRES: supabase-phase4-pipeline-migration.sql to be run first
      const { error: responseUpdateError } = await supabase
        .from('rfp_responses')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          page_allocation: documents?.pageAllocation ? {
            volumes: documents.pageAllocation,
            overall: {
              status: overallStatus,
              totalPages: totalPages,
            },
          } : null,
          outline: documents?.outlines || null,
        })
        .eq('id', responseId);

      if (responseUpdateError) {
        console.error('❌ Failed to update rfp_responses:', responseUpdateError);
        throw new Error(`Failed to update response status: ${responseUpdateError.message}`);
      }

      console.log(`✅ Response status updated to completed`);
      console.log(`📊 Page allocation: ${totalPages.toFixed(1)} total pages, status: ${overallStatus}`);

      // Update document status to proposal_ready
      // REQUIRES: supabase-phase4-pipeline-migration.sql to be run first
      const { error: docUpdateError } = await supabase
        .from('documents')
        .update({
          status: 'proposal_ready',
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (docUpdateError) {
        console.error('❌ Failed to update document status:', docUpdateError);
        throw new Error(`Failed to update document status: ${docUpdateError.message}`);
      }

      console.log(`✅ Document status updated to proposal_ready`);
      return { success: true, totalPages, overallStatus };
    });

    // Log completion
    await step.run('log-completion', async () => {
      const supabase = getServerClient();
      const docs = documents?.docs || [];
      await supabase.from('processing_logs').insert({
        document_id: documentId,
        stage: 'stage-2-response-generator',
        status: 'completed',
        metadata: {
          response_id: responseId,
          volumes_generated: docs.length,
          requirements_coverage: coveragePercent,
          compliance_matrix: complianceMatrixUrl,
          page_allocation: documents?.pageAllocation || null,
          pdf_generation: {
            total: docs.length,
            successful: docs.filter((d: any) => d.pdfUrl && !d.pdfError).length,
            failed: docs.filter((d: any) => d.pdfError).length,
          },
        },
      });
    });

    return {
      success: true,
      response_id: responseId,
      volumes: documents?.docs || [],
      compliance_matrix: complianceMatrixUrl,
      requirements_coverage: coveragePercent,
      page_allocation: documents?.pageAllocation || null,
      outlines: documents?.outlines || null,
    };
  }
);
