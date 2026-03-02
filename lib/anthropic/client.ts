import Anthropic from '@anthropic-ai/sdk';

console.log('🔑 Initializing Anthropic client...');
console.log('🔑 API Key exists:', !!process.env.ANTHROPIC_API_KEY);
console.log('🔑 API Key starts with:', process.env.ANTHROPIC_API_KEY?.substring(0, 20));

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Using Claude Sonnet 4.6
export const MODEL = 'claude-sonnet-4-6';

console.log('✅ Anthropic client initialized with model:', MODEL);
