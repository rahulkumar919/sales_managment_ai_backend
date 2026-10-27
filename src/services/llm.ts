import { config } from '../config.js';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqRequest {
  model: string;
  messages: GroqMessage[];
  temperature: number;
  response_format: { type: 'json_object' };
  max_tokens?: number;
}

interface GroqResponse {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
}

/**
 * Call the Groq chat completions API with JSON mode.
 *
 * @returns The raw text of the first choice's message content (a JSON string).
 * @throws  An Error describing the failure. Authorization headers and keys are
 *          NEVER included in thrown error messages or logs.
 */
export async function generateJson(
  system: string,
  user: string,
  signal: AbortSignal
): Promise<string> {
  const body: GroqRequest = {
    model: config.GROQ_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
    max_tokens: 1024,
  };

  let response: Response;
  try {
    response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        // Key is NEVER logged — we pass it only in the header
        Authorization: `Bearer ${config.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    // Network error or abort
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Groq request timed out after 20 seconds.');
    }
    throw new Error(`Groq network error: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  // Non-2xx — map to helpful messages without leaking auth info
  if (!response.ok) {
    let errBody = '';
    try {
      errBody = await response.text();
    } catch {
      // ignore
    }

    if (response.status === 401) {
      throw new Error('Groq authentication failed (401). Check GROQ_API_KEY on Render.');
    }
    if (response.status === 429) {
      throw new Error('Groq rate limit reached (429). The summary will be retried later.');
    }
    if (response.status >= 500) {
      throw new Error(`Groq server error (${response.status}). It may be temporarily unavailable.`);
    }
    // Log only the status code for non-500 errors; body might contain prompt fragments
    console.error(`[llm] Groq returned HTTP ${response.status}`, errBody.slice(0, 200));
    throw new Error(`Groq request failed with HTTP ${response.status}.`);
  }

  let parsed: GroqResponse;
  try {
    parsed = (await response.json()) as GroqResponse;
  } catch {
    throw new Error('Groq response was not valid JSON.');
  }

  const content = parsed?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error('Groq returned an empty or missing message content.');
  }

  return content;
}
