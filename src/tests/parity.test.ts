/**
 * Parity test: option keys in backend/src/lib/stages.ts must exactly match
 * the keys used in frontend/src/content/stages.ts.
 *
 * If these diverge, validation will reject valid front-end submissions
 * and/or the Groq input will have wrong labels.
 */
import { describe, it, expect } from 'vitest';
import { STAGES as BACKEND_STAGES } from '../lib/stages.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function backendKeys(): Set<string> {
  const keys = new Set<string>();
  for (const stage of Object.values(BACKEND_STAGES)) {
    for (const key of Object.keys(stage.options)) {
      keys.add(key);
    }
  }
  return keys;
}

function frontendKeys(): Set<string> {
  // Parse the frontend stages.ts to extract option keys without importing it
  // (it's TypeScript and uses browser-specific imports)
  const frontendPath = path.resolve(
    __dirname,
    '../../../frontend/src/content/stages.ts'
  );

  if (!fs.existsSync(frontendPath)) {
    throw new Error(`Frontend stages file not found at ${frontendPath}`);
  }

  const source = fs.readFileSync(frontendPath, 'utf-8');

  // Extract all string literals that look like s{n}_{name} (our option key convention)
  const keyRe = /\b(s[1-8]_[a-z_]+)\b/g;
  const keys = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = keyRe.exec(source)) !== null) {
    keys.add(match[1]!);
  }
  return keys;
}

describe('stage key parity (frontend ↔ backend)', () => {
  const beKeys = backendKeys();
  const feKeys = frontendKeys();

  it('backend keys are all present in the frontend file', () => {
    const missing: string[] = [];
    for (const key of beKeys) {
      if (!feKeys.has(key)) missing.push(key);
    }
    if (missing.length) {
      throw new Error(
        `Keys in backend/stages.ts not found in frontend/stages.ts:\n  ${missing.join('\n  ')}`
      );
    }
    expect(missing).toHaveLength(0);
  });

  it('frontend keys are all present in the backend file', () => {
    const extras: string[] = [];
    for (const key of feKeys) {
      if (!beKeys.has(key)) extras.push(key);
    }
    if (extras.length) {
      throw new Error(
        `Keys in frontend/stages.ts not found in backend/stages.ts:\n  ${extras.join('\n  ')}`
      );
    }
    expect(extras).toHaveLength(0);
  });

  it('key count matches exactly', () => {
    // This catches the case where both sets miss the same key
    expect(beKeys.size).toBe(feKeys.size);
  });
});
