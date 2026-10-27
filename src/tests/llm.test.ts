import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config before importing llm.ts so it never needs real env vars
vi.mock('../config.js', () => ({
  config: {
    GROQ_API_KEY: 'gsk_test_key',
    GROQ_MODEL: 'llama-3.3-70b-versatile',
  },
}));

import { generateJson } from '../services/llm.js';

// ─── Groq adapter tests (fetch mocked) ────────────────────────────────────────
describe('generateJson', () => {
  const controller = new AbortController();

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetch(status: number, body: unknown) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: vi.fn().mockResolvedValue(body),
        text: vi.fn().mockResolvedValue(JSON.stringify(body)),
      })
    );
  }

  const successResponse = {
    choices: [{ message: { content: '{"key":"value"}' }, finish_reason: 'stop' }],
  };

  it('returns message content string on success', async () => {
    mockFetch(200, successResponse);
    const result = await generateJson('System', 'User', controller.signal);
    expect(result).toBe('{"key":"value"}');
  });

  it('throws on 401 without leaking the API key', async () => {
    mockFetch(401, { error: { message: 'Invalid API key' } });
    await expect(generateJson('System', 'User', controller.signal)).rejects.toThrow('401');
    // Verify the key is NOT in the thrown message
    try {
      await generateJson('System', 'User', controller.signal);
    } catch (e) {
      expect(String(e)).not.toContain('gsk_test_key');
    }
  });

  it('throws on 429 rate limit', async () => {
    mockFetch(429, { error: { message: 'Rate limited' } });
    await expect(generateJson('System', 'User', controller.signal)).rejects.toThrow('429');
  });

  it('throws on 500 server error', async () => {
    mockFetch(500, { error: { message: 'Server error' } });
    await expect(generateJson('System', 'User', controller.signal)).rejects.toThrow('500');
  });

  it('throws when content is empty', async () => {
    mockFetch(200, { choices: [{ message: { content: '' }, finish_reason: 'stop' }] });
    await expect(generateJson('System', 'User', controller.signal)).rejects.toThrow();
  });

  it('throws when choices is missing', async () => {
    mockFetch(200, { id: 'abc', model: 'llama-3.3-70b-versatile' });
    await expect(generateJson('System', 'User', controller.signal)).rejects.toThrow();
  });

  it('throws when message.content is missing', async () => {
    mockFetch(200, { choices: [{ message: {}, finish_reason: 'stop' }] });
    await expect(generateJson('System', 'User', controller.signal)).rejects.toThrow();
  });

  it('passes the abort signal to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(successResponse),
    });
    vi.stubGlobal('fetch', fetchMock);

    await generateJson('System', 'User', controller.signal);

    const callArgs = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(callArgs[1].signal).toBe(controller.signal);
  });

  it('throws on network error with a safe message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Network connection failed'))
    );
    await expect(generateJson('System', 'User', controller.signal)).rejects.toThrow('network error');
  });
});
