import { z } from 'zod';

// ─── Primitive helpers ────────────────────────────────────────────────────────

export const uuid = z.string().uuid({ message: 'Must be a valid UUID' });

/**
 * Optional text field: null, undefined, or empty string all become null.
 * Does NOT trim the stored value (raw-text rule applies INSIDE prospect_words separately).
 */
const optText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v == null || v.trim() === '' ? null : v));

// ─── Outcome enum ─────────────────────────────────────────────────────────────

export const OUTCOMES = [
  'meeting_booked',
  'next_step_agreed',
  'callback_requested',
  'information_requested',
  'not_interested',
  'not_the_right_person',
  'no_answer_or_unreachable',
  'disconnected',
  'other',
] as const;

export type Outcome = (typeof OUTCOMES)[number];

// ─── Request body schemas ──────────────────────────────────────────────────────

export const startCallBody = z.object({
  prospect_name: z.string().trim().min(1, 'Prospect name is required').max(80),
  company: z.string().trim().min(1, 'Company is required').max(80),
  role: optText(80),
  context: optText(200),
});

export const stageParams = z.object({
  id: uuid,
  n: z.coerce.number().int().min(1).max(8),
});

export const callIdParam = z.object({ id: uuid });

/**
 * Save-stage body. At least one of option_key or prospect_words is required.
 * prospect_words is stored exactly — do NOT trim (raw-text rule, TRD 5.4).
 */
export const saveStageBody = z
  .object({
    option_key: z.string().max(60).nullish(),
    // NOT trimmed — prospect_words stored verbatim
    prospect_words: z.string().max(2000).nullish(),
  })
  .refine((b) => b.option_key !== undefined || b.prospect_words !== undefined, {
    message: 'Provide option_key and/or prospect_words',
  });

export const reachBody = z.object({
  stage_number: z.number().int().min(1).max(8),
});

export const closeBody = z.object({
  outcome: z.enum(OUTCOMES),
  next_action: optText(200),
  // ISO 8601 with timezone offset required (e.g. 2026-10-26T14:30:00+05:30)
  follow_up_at: z.string().datetime({ offset: true }).nullish(),
  follow_up_channel: z.enum(['phone', 'whatsapp', 'email', 'meeting']).nullish(),
  closing_notes: optText(500),
});

// ─── AI summary output schema (TRD 8.3) ──────────────────────────────────────

export const summaryOutputSchema = z.object({
  recorded_facts: z.array(z.string().max(300)).max(10),
  need_in_their_words: z.string().max(2000).nullable(),
  objection: z.string().max(300).nullable(),
  suggested_next_action: z.string().max(300),
  caveats: z.array(z.string().max(200)).max(5).default([]),
});

export type SummaryOutput = z.infer<typeof summaryOutputSchema>;
