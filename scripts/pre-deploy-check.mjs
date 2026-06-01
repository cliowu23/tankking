#!/usr/bin/env node
/**
 * Pre-deploy check — runs before every `vercel --prod`.
 * Add new stale patterns here whenever a mechanic changes and UI copy
 * needs to be updated to match. Exit 1 blocks the deploy.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Each entry: { file, pattern (regex), reason }
const STALE_PATTERNS = [
  // Ballistic/arc system was replaced with flat trajectory — any remnants of the
  // old "aim at the ground to arc your shot" mechanic are stale.
  { file: 'index.html', pattern: /arc your shot/i,  reason: 'old ballistic hint text (flat trajectory replaced this)' },
  { file: 'index.html', pattern: /aim at ground/i,  reason: 'old ballistic hint text (flat trajectory replaced this)' },

  // Add new entries here as mechanics change. Format:
  // { file: 'index.html', pattern: /old text/i, reason: 'what changed' },
];

const issues = [];
for (const { file, pattern, reason } of STALE_PATTERNS) {
  try {
    const content = readFileSync(resolve(ROOT, file), 'utf8');
    if (pattern.test(content)) {
      issues.push(`  • ${file}: ${reason}`);
    }
  } catch {
    // file missing — skip silently
  }
}

if (issues.length > 0) {
  console.error('⚠️  Pre-deploy check FAILED — stale content found:');
  issues.forEach(line => console.error(line));
  console.error('\nFix the above before deploying.');
  process.exit(1);
}

console.log('✅ Pre-deploy checks passed — no stale content found.');
process.exit(0);
