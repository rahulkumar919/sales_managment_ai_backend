/**
 * Stage metadata — authoritative source for option key validation and Groq input labels.
 * Keys MUST match frontend/src/content/stages.ts exactly (enforced by parity test).
 * Source: PRD v2.0 Section 7.2.
 */

export interface StageOptionMap {
  [key: string]: string;
}

export interface StageMeta {
  name: string;
  options: StageOptionMap;
}

export const STAGES: Record<number, StageMeta> = {
  1: {
    name: 'Opening',
    options: {
      s1_reached_person: 'Reached the person',
      s1_via_reception: 'Went through reception',
      s1_wrong_person: 'Wrong person or number',
      s1_left_company: 'Person has left the company',
      s1_asked_call_later: 'Asked me to call later',
      s1_bad_line: 'Bad line or language trouble',
    },
  },
  2: {
    name: 'Introduce',
    options: {
      s2_listened: 'Listened to the intro',
      s2_asked_who_we_are: 'Asked who we are again',
      s2_asked_purpose: 'Asked what it is about',
      s2_not_my_area: 'Said it is not their area',
      s2_pointed_elsewhere: 'Pointed me to someone else',
      s2_cut_short: 'Cut the call short',
    },
  },
  3: {
    name: 'Offer',
    options: {
      s3_agreed_to_receive: 'Agreed to receive it',
      s3_asked_whats_in_it: 'Asked what is in it',
      s3_asked_cost: 'Asked about cost or why we do it',
      s3_send_first: 'Said send it first, talk later',
      s3_declined: 'Declined the offer',
    },
  },
  4: {
    name: 'Qualify',
    options: {
      s4_answered_openly: 'Answered openly',
      s4_short_answers: 'Gave only short yes or no answers',
      s4_declined_to_share: 'Said it is confidential',
      s4_has_plan: 'Has a goal or plan',
      s4_no_set_goal: 'No set goal or plan',
    },
  },
  5: {
    name: 'Need',
    options: {
      s5_named_need: 'Named a need or goal',
      s5_unsure: 'Unsure, could not say',
      s5_no_need: 'Said no need right now',
      s5_wants_report_first: 'Wants to see the report first',
    },
  },
  6: {
    name: 'Objection',
    options: {
      s6_not_right_person: 'Not the right person',
      s6_internal_team: 'Does it in-house or has a partner',
      s6_too_early: 'Too early or too small',
      s6_not_interested: 'Just not interested',
      s6_cost_or_trust: 'Asked about cost, source or trust',
      s6_no_time: 'No time right now',
    },
  },
  7: {
    name: 'Ask',
    options: {
      s7_report_agreed: 'Agreed to receive the report',
      s7_time_fixed: 'Fixed a date and time',
      s7_callback_later: 'Asked for a callback',
      s7_will_review: 'Will review and revert',
      s7_gave_contact: 'Gave another contact',
      s7_refused: 'Declined any next step',
    },
  },
  8: {
    name: 'Close',
    options: {
      s8_read_back_confirmed: 'Read back, they confirmed',
      s8_channel_confirmed: 'Channel or number confirmed',
      s8_left_open: 'Left it open, no confirmation',
      s8_ended_abruptly: 'Call ended before the close',
    },
  },
} as const;

export const STAGE_COUNT = Object.keys(STAGES).length; // 8

/** Returns the stage name for a given number (1-8), or null. */
export function getStageName(n: number): string | null {
  return STAGES[n]?.name ?? null;
}

/**
 * Returns the human-readable label for an option key,
 * searching all stages (key prefix encodes stage number but we search all).
 */
export function getOptionLabel(key: string): string | null {
  for (const stage of Object.values(STAGES)) {
    if (key in stage.options) {
      return stage.options[key] ?? null;
    }
  }
  return null;
}

/**
 * Validates that an option key belongs to the given stage number.
 * Returns true when key is null (clearing the selection is always allowed).
 */
export function isValidOptionKey(stageNum: number, key: string | null | undefined): boolean {
  if (key === null || key === undefined) return true;
  const stage = STAGES[stageNum];
  if (!stage) return false;
  return Object.prototype.hasOwnProperty.call(stage.options, key);
}

/** All valid option keys across every stage (used by the parity test). */
export function allOptionKeys(): string[] {
  return Object.values(STAGES).flatMap((s) => Object.keys(s.options));
}
