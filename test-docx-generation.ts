import 'dotenv/config'; // Load .env file FIRST
import { Document, Paragraph, TextRun, Packer } from 'docx';
import { anthropic, MODEL } from './lib/anthropic/client';
import { writeFile } from 'fs/promises';

async function testDocxGeneration() {
  console.log('\n🧪 TEST 1: Anthropic API Call');
  console.log('================================');
  
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: 'Write a 3-sentence paragraph about proposal writing best practices.'
      }]
    });
    
    const aiText = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log('✅ AI Response received');
    console.log('📝 Length:', aiText.length, 'characters');
    console.log('📝 Content:', aiText.substring(0, 100) + '...\n');

    console.log('\n🧪 TEST 2: DOCX Generation with TextRun');
    console.log('==========================================');
    
    const doc = new Document({
      sections: [{
        children: [
          // Test 1: Simple heading
          new Paragraph({
            text: 'Test Document - Heading Works',
            heading: 1,
          }),
          
          // Test 2: Paragraph with TextRun (OUR FIX)
          new Paragraph({
            children: [
              new TextRun({
                text: 'TEST PARAGRAPH WITH TEXTRUN: ' + aiText,
                size: 22,
                font: 'Arial',
              })
            ],
            spacing: { after: 240 },
          }),
          
          // Test 3: Old broken way (for comparison)
          new Paragraph({
            text: 'OLD WAY (should be invisible): ' + aiText,
            spacing: { after: 240 },
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    await writeFile('./test-output.docx', buffer);
    
    console.log('✅ DOCX file created: test-output.docx');
    console.log('📂 Location:', process.cwd() + '/test-output.docx');
    console.log('\n📋 Expected Results:');
    console.log('   - Heading should be visible');
    console.log('   - "TEST PARAGRAPH WITH TEXTRUN" should be visible with AI content');
    console.log('   - "OLD WAY" paragraph should be INVISIBLE (blank)');
    console.log('\n✅ Test complete! Open test-output.docx to verify.\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

testDocxGeneration();
