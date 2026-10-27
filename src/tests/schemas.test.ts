import { describe, it, expect } from 'vitest';
import {
  startCallBody,
  saveStageBody,
  stageParams,
  closeBody,
  reachBody,
  OUTCOMES,
  summaryOutputSchema,
} from '../schemas.js';
import { isValidOptionKey, allOptionKeys } from '../lib/stages.js';

// ─── startCallBody ────────────────────────────────────────────────────────────
describe('startCallBody', () => {
  it('accepts valid required fields', () => {
    const r = startCallBody.parse({ prospect_name: 'Rohan Varma', company: 'Apex Ltd' });
    expect(r.prospect_name).toBe('Rohan Varma');
    expect(r.company).toBe('Apex Ltd');
    expect(r.role).toBeNull();
    expect(r.context).toBeNull();
  });

  it('trims leading and trailing whitespace', () => {
    const r = startCallBody.parse({ prospect_name: '  Alice  ', company: '  Corp  ' });
    expect(r.prospect_name).toBe('Alice');
    expect(r.company).toBe('Corp');
  });

  it('rejects empty prospect_name', () => {
    expect(() => startCallBody.parse({ prospect_name: '', company: 'Corp' })).toThrow();
  });

  it('rejects empty company', () => {
    expect(() => startCallBody.parse({ prospect_name: 'Bob', company: '' })).toThrow();
  });

  it('rejects prospect_name > 80 chars', () => {
    expect(() =>
      startCallBody.parse({ prospect_name: 'a'.repeat(81), company: 'Corp' })
    ).toThrow();
  });

  it('rejects company > 80 chars', () => {
    expect(() =>
      startCallBody.parse({ prospect_name: 'Bob', company: 'b'.repeat(81) })
    ).toThrow();
  });

  it('coerces empty role string to null', () => {
    const r = startCallBody.parse({ prospect_name: 'Bob', company: 'Corp', role: '' });
    expect(r.role).toBeNull();
  });

  it('coerces empty context string to null', () => {
    const r = startCallBody.parse({ prospect_name: 'Bob', company: 'Corp', context: '   ' });
    expect(r.context).toBeNull();
  });

  it('rejects context > 200 chars', () => {
    expect(() =>
      startCallBody.parse({ prospect_name: 'Bob', company: 'Corp', context: 'x'.repeat(201) })
    ).toThrow();
  });
});

// ─── stageParams ──────────────────────────────────────────────────────────────
describe('stageParams', () => {
  it('accepts valid uuid and stage 1', () => {
    const r = stageParams.parse({ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', n: '1' });
    expect(r.n).toBe(1);
  });

  it('rejects stage 0', () => {
    expect(() =>
      stageParams.parse({ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', n: '0' })
    ).toThrow();
  });

  it('rejects stage 9', () => {
    expect(() =>
      stageParams.parse({ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', n: '9' })
    ).toThrow();
  });

  it('rejects invalid UUID', () => {
    expect(() => stageParams.parse({ id: 'not-a-uuid', n: '1' })).toThrow();
  });

  it('accepts all valid stages 1-8', () => {
    for (let i = 1; i <= 8; i++) {
      const r = stageParams.parse({ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', n: String(i) });
      expect(r.n).toBe(i);
    }
  });
});

// ─── saveStageBody ────────────────────────────────────────────────────────────
describe('saveStageBody', () => {
  it('accepts option_key only', () => {
    const r = saveStageBody.parse({ option_key: 's1_reached_person' });
    expect(r.option_key).toBe('s1_reached_person');
  });

  it('accepts prospect_words only', () => {
    const r = saveStageBody.parse({ prospect_words: 'We need better leads.' });
    expect(r.prospect_words).toBe('We need better leads.');
  });

  it('accepts both fields', () => {
    const r = saveStageBody.parse({
      option_key: 's1_reached_person',
      prospect_words: 'He answered',
    });
    expect(r.option_key).toBe('s1_reached_person');
    expect(r.prospect_words).toBe('He answered');
  });

  it('accepts null option_key (clearing)', () => {
    const r = saveStageBody.parse({ option_key: null, prospect_words: 'Something' });
    expect(r.option_key).toBeNull();
  });

  it('rejects body with neither field', () => {
    expect(() => saveStageBody.parse({})).toThrow();
  });

  it('preserves prospect_words exactly — no trimming', () => {
    const raw = '  exact  spacing   matters  \n';
    const r = saveStageBody.parse({ prospect_words: raw });
    expect(r.prospect_words).toBe(raw);
  });

  it('rejects prospect_words > 2000 chars', () => {
    expect(() => saveStageBody.parse({ prospect_words: 'x'.repeat(2001) })).toThrow();
  });
});

// ─── isValidOptionKey ─────────────────────────────────────────────────────────
describe('isValidOptionKey', () => {
  it('returns true for null (clearing)', () => {
    expect(isValidOptionKey(1, null)).toBe(true);
  });

  it('returns true for a correct stage 1 key', () => {
    expect(isValidOptionKey(1, 's1_reached_person')).toBe(true);
  });

  it('returns false for a key from a different stage', () => {
    // s2_listened belongs to stage 2, not stage 1
    expect(isValidOptionKey(1, 's2_listened')).toBe(false);
  });

  it('returns false for an unknown key', () => {
    expect(isValidOptionKey(1, 'made_up_key')).toBe(false);
  });

  it('all declared option keys are valid for their respective stage', () => {
    const keys = allOptionKeys();
    expect(keys.length).toBeGreaterThan(0);
    // Each key starts with s{n}_; validate it reports valid for the right stage
    keys.forEach((key) => {
      const match = key.match(/^s(\d)_/);
      if (match) {
        const stageNum = parseInt(match[1]!, 10);
        expect(isValidOptionKey(stageNum, key)).toBe(true);
      }
    });
  });
});

// ─── closeBody ────────────────────────────────────────────────────────────────
describe('closeBody', () => {
  it('accepts every documented outcome', () => {
    for (const outcome of OUTCOMES) {
      const r = closeBody.parse({ outcome });
      expect(r.outcome).toBe(outcome);
    }
  });

  it('rejects unknown outcome', () => {
    expect(() => closeBody.parse({ outcome: 'gave_up' })).toThrow();
  });

  it('requires outcome field', () => {
    expect(() => closeBody.parse({})).toThrow();
  });

  it('accepts valid datetime string for follow_up_at', () => {
    const r = closeBody.parse({ outcome: 'meeting_booked', follow_up_at: '2026-11-01T10:00:00+05:30' });
    expect(r.follow_up_at).toBe('2026-11-01T10:00:00+05:30');
  });

  it('rejects invalid follow_up_at format', () => {
    expect(() => closeBody.parse({ outcome: 'meeting_booked', follow_up_at: '2026-13-40' })).toThrow();
  });

  it('accepts all valid follow_up_channel values', () => {
    for (const channel of ['phone', 'whatsapp', 'email', 'meeting'] as const) {
      const r = closeBody.parse({ outcome: 'callback_requested', follow_up_channel: channel });
      expect(r.follow_up_channel).toBe(channel);
    }
  });
});

// ─── reachBody ────────────────────────────────────────────────────────────────
describe('reachBody', () => {
  it('accepts stages 1-8', () => {
    for (let i = 1; i <= 8; i++) {
      expect(reachBody.parse({ stage_number: i }).stage_number).toBe(i);
    }
  });

  it('rejects 0', () => {
    expect(() => reachBody.parse({ stage_number: 0 })).toThrow();
  });

  it('rejects 9', () => {
    expect(() => reachBody.parse({ stage_number: 9 })).toThrow();
  });
});

// ─── summaryOutputSchema ──────────────────────────────────────────────────────
describe('summaryOutputSchema', () => {
  const validSummary = {
    recorded_facts: ['Prospect answered', 'Expressed interest in reports'],
    need_in_their_words: 'We need better data on local companies.',
    objection: 'Has an internal team.',
    suggested_next_action: 'Send the sample report on WhatsApp today.',
    caveats: [],
  };

  it('accepts a valid summary object', () => {
    const r = summaryOutputSchema.parse(validSummary);
    expect(r.recorded_facts).toHaveLength(2);
  });

  it('accepts null for need_in_their_words', () => {
    const r = summaryOutputSchema.parse({ ...validSummary, need_in_their_words: null });
    expect(r.need_in_their_words).toBeNull();
  });

  it('accepts null for objection', () => {
    const r = summaryOutputSchema.parse({ ...validSummary, objection: null });
    expect(r.objection).toBeNull();
  });

  it('defaults caveats to []', () => {
    const { caveats: _c, ...rest } = validSummary;
    const r = summaryOutputSchema.parse(rest);
    expect(r.caveats).toEqual([]);
  });

  it('rejects recorded_facts > 10 items', () => {
    expect(() =>
      summaryOutputSchema.parse({ ...validSummary, recorded_facts: Array(11).fill('fact') })
    ).toThrow();
  });

  it('rejects a fact > 300 chars', () => {
    expect(() =>
      summaryOutputSchema.parse({ ...validSummary, recorded_facts: ['x'.repeat(301)] })
    ).toThrow();
  });

  it('rejects missing suggested_next_action', () => {
    const { suggested_next_action: _s, ...rest } = validSummary;
    expect(() => summaryOutputSchema.parse(rest)).toThrow();
  });
});
