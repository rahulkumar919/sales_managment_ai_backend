import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config so env validation never runs during tests
vi.mock('../config.js', () => ({
  config: {
    SUPABASE_URL: 'https://mock.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key',
    GROQ_API_KEY: 'gsk_mock_test_key',
    GROQ_MODEL: 'llama-3.3-70b-versatile',
    FRONTEND_ORIGIN: 'http://localhost:5173',
    PORT: 3000,
    NODE_ENV: 'test',
  },
}));

// Mock Supabase client so no DB connection is attempted
vi.mock('../lib/supabase.js', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { verifyQuote } from '../services/summary.js';

// ─── verifyQuote ──────────────────────────────────────────────────────────────
describe('verifyQuote', () => {
  it('returns the quote when contained in stage5Words', () => {
    const words = 'We need better data on local companies to grow our pipeline.';
    const quote = 'better data on local companies';
    expect(verifyQuote(quote, words)).toBe(quote);
  });

  it('is case-insensitive', () => {
    const words = 'We Need Better Data On Local Companies';
    const quote = 'better data on local companies';
    expect(verifyQuote(quote, words)).toBe(quote);
  });

  it('normalises multiple spaces', () => {
    const words = 'We need   better  data.';
    const quote = 'better data';
    expect(verifyQuote(quote, words)).toBe(quote);
  });

  it('returns null when quote is not found in stage5Words', () => {
    expect(verifyQuote('invented quote', 'something completely different')).toBeNull();
  });

  it('returns null when quote is null', () => {
    expect(verifyQuote(null, 'some words')).toBeNull();
  });

  it('returns null when stage5Words is null', () => {
    expect(verifyQuote('some quote', null)).toBeNull();
  });

  it('returns null when both are null', () => {
    expect(verifyQuote(null, null)).toBeNull();
  });

  it('handles exact match', () => {
    const text = 'We need growth';
    expect(verifyQuote(text, text)).toBe(text);
  });
});

// ─── Guardrails (via generateSummary with mocked llm) ────────────────────────
// We test the guardrail logic directly since it is pure business logic.

import type { SummaryOutput } from '../schemas.js';
type Call = {
  id: string;
  prospect_name: string;
  company: string;
  role: string | null;
  context: string | null;
  started_at: string;
  ended_at: string | null;
  last_stage_reached: number;
  outcome: string | null;
  next_action: string | null;
  follow_up_at: string | null;
  follow_up_channel: string | null;
  closing_notes: string | null;
  ai_summary: object | null;
  ai_summary_status: string | null;
  ai_summary_at: string | null;
};

// Import the guardrail-applying inner function indirectly by running a summary
// with mocked dependencies — or test the exported verifyQuote + guardrail rules.

// We mock the modules so no real DB or Groq calls happen.
vi.mock('../services/calls.js', () => ({
  getCallById: vi.fn(),
  getStageResults: vi.fn(),
  buildGroqInput: vi.fn(() => ({})),
  updateSummaryFields: vi.fn(),
}));

vi.mock('../services/llm.js', () => ({
  generateJson: vi.fn(),
}));

import { getCallById, getStageResults, updateSummaryFields } from '../services/calls.js';
import { generateJson } from '../services/llm.js';
import { generateSummary } from '../services/summary.js';

const mockGetCallById = vi.mocked(getCallById);
const mockGetStageResults = vi.mocked(getStageResults);
const mockUpdateSummaryFields = vi.mocked(updateSummaryFields);
const mockGenerateJson = vi.mocked(generateJson);

function makeCall(overrides: Partial<Call> = {}): Call {
  return {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    prospect_name: 'Fictional Person',
    company: 'Demo Corp',
    role: 'Manager',
    context: null,
    started_at: new Date(Date.now() - 300_000).toISOString(),
    ended_at: new Date().toISOString(),
    last_stage_reached: 6,
    outcome: 'not_interested',
    next_action: null,
    follow_up_at: null,
    follow_up_channel: null,
    closing_notes: null,
    ai_summary: null,
    ai_summary_status: null,
    ai_summary_at: null,
    ...overrides,
  };
}

const validGroqOutput: SummaryOutput = {
  recorded_facts: ['Prospect listened to the intro'],
  need_in_their_words: 'better data on local companies',
  objection: 'Has an internal team',
  suggested_next_action: 'Send sample report',
  caveats: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateSummaryFields.mockResolvedValue(undefined);
  mockGetStageResults.mockResolvedValue([]);
});

describe('generateSummary guardrails', () => {
  it('returns 409 error code for an open call', async () => {
    mockGetCallById.mockResolvedValue(makeCall({ ended_at: null }));
    await expect(generateSummary('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', false)).rejects.toMatchObject({
      status: 409,
      code: 'CALL_OPEN',
    });
  });

  it('returns stored summary when status is done and no force', async () => {
    const stored = { ...validGroqOutput };
    mockGetCallById.mockResolvedValue(
      makeCall({ ai_summary_status: 'done', ai_summary: stored as unknown as object })
    );
    const result = await generateSummary('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', false);
    expect(result.status).toBe('done');
    expect(mockGenerateJson).not.toHaveBeenCalled();
  });

  it('forces regeneration when force=true even if status is done', async () => {
    const stored = { ...validGroqOutput };
    mockGetCallById.mockResolvedValue(
      makeCall({ ai_summary_status: 'done', ai_summary: stored as unknown as object })
    );
    mockGetStageResults.mockResolvedValue([
      {
        id: 'r1',
        call_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        stage_number: 5,
        option_key: 's5_named_need',
        prospect_words: 'better data on local companies',
        saved_at: new Date().toISOString(),
      },
    ]);
    mockGenerateJson.mockResolvedValue(JSON.stringify(validGroqOutput));

    const result = await generateSummary('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', true);
    expect(result.status).toBe('done');
    expect(mockGenerateJson).toHaveBeenCalledOnce();
  });

  it('forces need_in_their_words to null when no stage 5 result', async () => {
    mockGetCallById.mockResolvedValue(makeCall({ outcome: 'callback_requested' }));
    // No stage 5 in results
    mockGetStageResults.mockResolvedValue([]);
    mockGenerateJson.mockResolvedValue(
      JSON.stringify({ ...validGroqOutput, need_in_their_words: 'invented need' })
    );

    const result = await generateSummary('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', false);
    expect(result.summary?.need_in_their_words).toBeNull();
  });

  it('forces objection to null when no stage 6 result', async () => {
    mockGetCallById.mockResolvedValue(makeCall({ outcome: 'callback_requested' }));
    // Only stage 5, no stage 6
    mockGetStageResults.mockResolvedValue([
      {
        id: 'r1',
        call_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        stage_number: 5,
        option_key: null,
        prospect_words: 'We need better leads',
        saved_at: new Date().toISOString(),
      },
    ]);
    mockGenerateJson.mockResolvedValue(
      JSON.stringify({ ...validGroqOutput, need_in_their_words: 'We need better leads', objection: 'Has internal team' })
    );

    const result = await generateSummary('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', false);
    expect(result.summary?.objection).toBeNull();
  });

  it('removes meeting claims from recorded_facts when outcome is not meeting_booked', async () => {
    mockGetCallById.mockResolvedValue(makeCall({ outcome: 'callback_requested' }));
    mockGetStageResults.mockResolvedValue([]);
    mockGenerateJson.mockResolvedValue(
      JSON.stringify({
        ...validGroqOutput,
        need_in_their_words: null,
        recorded_facts: ['Prospect answered', 'Meeting is booked for Tuesday', 'Call was short'],
      })
    );

    const result = await generateSummary('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', false);
    expect(result.summary?.recorded_facts).not.toContain('Meeting is booked for Tuesday');
    expect(result.summary?.recorded_facts).toContain('Prospect answered');
  });

  it('keeps meeting claims when outcome is meeting_booked', async () => {
    mockGetCallById.mockResolvedValue(makeCall({ outcome: 'meeting_booked' }));
    mockGetStageResults.mockResolvedValue([]);
    mockGenerateJson.mockResolvedValue(
      JSON.stringify({
        ...validGroqOutput,
        need_in_their_words: null,
        recorded_facts: ['Meeting booked confirmed for Friday'],
      })
    );

    const result = await generateSummary('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', false);
    expect(result.summary?.recorded_facts).toContain('Meeting booked confirmed for Friday');
  });

  it('returns failed status when Groq throws', async () => {
    mockGetCallById.mockResolvedValue(makeCall());
    mockGetStageResults.mockResolvedValue([]);
    mockGenerateJson.mockRejectedValue(new Error('Groq network error'));

    const result = await generateSummary('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', false);
    expect(result.status).toBe('failed');
    expect(result.summary).toBeNull();
    // Should not throw — failure is stored and returned gracefully
  });

  it('returns failed status when Groq returns invalid JSON shape', async () => {
    mockGetCallById.mockResolvedValue(makeCall());
    mockGetStageResults.mockResolvedValue([]);
    // Missing required field
    mockGenerateJson.mockResolvedValue(JSON.stringify({ recorded_facts: [] }));

    const result = await generateSummary('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', false);
    expect(result.status).toBe('failed');
  });

  it('adds a caveat when need quote fails verification', async () => {
    mockGetCallById.mockResolvedValue(makeCall({ outcome: 'next_step_agreed' }));
    mockGetStageResults.mockResolvedValue([
      {
        id: 'r1',
        call_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        stage_number: 5,
        option_key: null,
        prospect_words: 'We want growth in our pipeline',
        saved_at: new Date().toISOString(),
      },
    ]);
    mockGenerateJson.mockResolvedValue(
      JSON.stringify({
        ...validGroqOutput,
        // This quote is NOT in stage5Words above
        need_in_their_words: 'completely fabricated need statement',
      })
    );

    const result = await generateSummary('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', false);
    expect(result.summary?.need_in_their_words).toBeNull();
    expect(result.summary?.caveats.some((c) => c.includes('could not be verified'))).toBe(true);
  });
});
