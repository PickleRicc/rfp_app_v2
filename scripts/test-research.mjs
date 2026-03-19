#!/usr/bin/env node
/**
 * Quick test of the research pipeline against a real company.
 * Usage: node scripts/test-research.mjs "TechSur Solutions"
 */

import { config } from 'dotenv';
config();

const companyName = process.argv[2] || 'TechSur Solutions';

console.log(`\n══════════════════════════════════════════════════`);
console.log(`  RESEARCH TEST: ${companyName}`);
console.log(`══════════════════════════════════════════════════\n`);

// ── 1. USASpending.gov ───────────────────────────────────

console.log('Step 1: USASpending.gov lookup...\n');

const USA_BASE = 'https://api.usaspending.gov/api/v2';

async function usaSpendingSearch() {
  try {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const res = await fetch(`${USA_BASE}/search/spending_by_award/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: {
          recipient_search_text: [companyName],
          award_type_codes: ['A', 'B', 'C', 'D'],
          time_period: [{ start_date: start, end_date: end }],
        },
        fields: [
          'Award ID', 'Recipient Name', 'Award Amount', 'Description',
          'Awarding Agency', 'Awarding Sub Agency', 'NAICS Code', 'NAICS Description',
          'Start Date', 'Period of Performance Current End Date',
        ],
        limit: 25,
        page: 1,
        sort: 'Award Amount',
        order: 'desc',
        subawards: false,
      }),
    });

    if (!res.ok) {
      console.log(`  ❌ USASpending returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const results = data.results || [];
    const total = data.page_metadata?.total || 0;

    console.log(`  Found ${total} total awards (showing top ${results.length}):\n`);

    let totalValue = 0;
    const agencies = new Map();
    const naicsCodes = new Map();

    for (const r of results) {
      const amount = Number(r['Award Amount']) || 0;
      totalValue += amount;
      const agency = r['Awarding Agency'] || 'Unknown';
      agencies.set(agency, (agencies.get(agency) || 0) + amount);
      const naics = r['NAICS Code'];
      if (naics) naicsCodes.set(naics, r['NAICS Description'] || naics);

      console.log(`  💰 $${(amount / 1_000_000).toFixed(2)}M — ${(r['Description'] || 'No description').slice(0, 80)}`);
      console.log(`     Agency: ${agency} | NAICS: ${naics || 'N/A'} | Date: ${r['Start Date'] || 'N/A'}`);
      console.log();
    }

    console.log(`  📊 Summary: ${total} awards, ~$${(totalValue / 1_000_000).toFixed(1)}M total (top ${results.length} shown)`);
    console.log(`  📊 Agencies: ${[...agencies.keys()].join(', ')}`);
    console.log(`  📊 NAICS codes: ${[...naicsCodes.entries()].map(([k, v]) => `${k} (${v})`).join(', ')}`);

    return { total, totalValue, agencies: [...agencies.keys()], naicsCodes: [...naicsCodes.keys()] };
  } catch (err) {
    console.error('  ❌ USASpending error:', err.message);
    return null;
  }
}

const spendingResult = await usaSpendingSearch();

// ── 2. Perplexity AI Research ────────────────────────────

console.log(`\n\nStep 2: Perplexity AI web research...\n`);

const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;

async function perplexityResearch() {
  if (!PERPLEXITY_KEY) {
    console.log('  ⚠️  PERPLEXITY_API_KEY not set — skipping');
    return null;
  }

  try {
    const context = spendingResult
      ? `USASpending shows ${spendingResult.total} federal awards. Top agencies: ${spendingResult.agencies.slice(0, 3).join(', ')}. NAICS: ${spendingResult.naicsCodes.join(', ')}.`
      : '';

    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a federal contracting business development researcher. Provide concise, specific intelligence on government contractors. Include names, dollar amounts, and dates where possible.',
          },
          {
            role: 'user',
            content: `Research this federal government contractor for a pre-sales call: ${companyName}

${context ? `Context we already have:\n${context}\n` : ''}
Cover: company overview, leadership, recent contracts, teaming partners, competitive landscape, and how we should approach them to sell AI-powered proposal writing services.

Be specific and concise.`,
          },
        ],
        temperature: 0.1,
        max_tokens: 3000,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.log(`  ❌ Perplexity returned ${res.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];

    console.log('  ✅ Perplexity research complete:\n');
    console.log(text.split('\n').map(l => `  ${l}`).join('\n'));

    if (citations.length) {
      console.log(`\n  📎 Sources (${citations.length}):`);
      citations.slice(0, 5).forEach(s => console.log(`     ${s}`));
    }

    return { text, citations };
  } catch (err) {
    console.error('  ❌ Perplexity error:', err.message);
    return null;
  }
}

const perplexityResult = await perplexityResearch();

// ── 3. Summary ───────────────────────────────────────────

console.log(`\n\n══════════════════════════════════════════════════`);
console.log(`  TEST RESULTS`);
console.log(`══════════════════════════════════════════════════\n`);

console.log(`  USASpending.gov: ${spendingResult ? `✅ ${spendingResult.total} awards found` : '❌ Failed or no data'}`);
console.log(`  Perplexity AI:   ${perplexityResult ? '✅ Research complete' : '❌ Failed or skipped'}`);
console.log(`  SAM.gov (Tango): ${process.env.TANGO_API_KEY ? '✅ Key configured' : '⚠️  TANGO_API_KEY not set — skipped'}`);
console.log();
