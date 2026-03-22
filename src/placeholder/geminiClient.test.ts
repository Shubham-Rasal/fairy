import {describe, it, expect, vi, beforeEach} from 'vitest';
import {generate, testConnection} from './geminiClient';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const config = {
	apiKey: 'test-key',
	model: 'gemini-2.0-flash',
	temperature: 0.3,
	maxOutputTokens: 300,
};

beforeEach(() => {
	mockFetch.mockReset();
});

describe('generate', () => {
	it('returns the generated text from a successful response', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				candidates: [{
					content: { parts: [{ text: 'Dream Outcome × Perceived Likelihood / Time Delay × Effort' }] }
				}]
			})
		});

		const result = await generate(config, 'alex hormozi value equation', '');
		expect(result.content).toBe('Dream Outcome × Perceived Likelihood / Time Delay × Effort');
		expect(result.webSources).toEqual([]);
	});

	it('sends google_search tool in the request body', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] })
		});

		await generate(config, 'some query', '');

		const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string) as {
			tools: Array<{ google_search?: unknown }>
		};
		expect(body.tools).toEqual(expect.arrayContaining([{ google_search: {} }]));
	});

	it('includes context in the prompt when provided', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ candidates: [{ content: { parts: [{ text: 'result' }] } }] })
		});

		await generate(config, 'some query', 'surrounding context text');

		const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string) as {
			contents: Array<{ parts: Array<{ text: string }> }>
		};
		const prompt = body.contents[0]!.parts[0]!.text;
		expect(prompt).toContain('surrounding context text');
	});

	it('throws with the API error message on non-ok response', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 400,
			json: async () => ({ error: { message: 'API key invalid' } })
		});

		await expect(generate(config, 'query', '')).rejects.toThrow('API key invalid');
	});

	it('throws a generic error when error response has no message', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: async () => ({})
		});

		await expect(generate(config, 'query', '')).rejects.toThrow('Gemini API error 500');
	});

	it('returns empty string when response has no candidates', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ candidates: [] })
		});

		const result = await generate(config, 'query', '');
		expect(result.content).toBe('');
		expect(result.webSources).toEqual([]);
	});

	it('respects the abort signal', async () => {
		const controller = new AbortController();
		mockFetch.mockImplementationOnce((_url: string, opts: { signal: AbortSignal }) => {
			return new Promise((_resolve, reject) => {
				opts.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
			});
		});

		const promise = generate(config, 'query', '', controller.signal);
		controller.abort();
		await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
	});

	it('extracts web sources from groundingMetadata', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				candidates: [{
					content: { parts: [{ text: 'result' }] },
					groundingMetadata: {
						groundingChunks: [
							{ web: { uri: 'https://example.com', title: 'Example Page' } },
							{ web: { uri: 'https://other.com', title: 'Other Page' } },
						]
					}
				}]
			})
		});

		const result = await generate(config, 'query', '');
		expect(result.webSources).toHaveLength(2);
		expect(result.webSources[0]).toEqual({ uri: 'https://example.com', title: 'Example Page' });
	});

	it('calls the correct endpoint URL with the API key', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
		});

		await generate(config, 'q', '');
		const url = mockFetch.mock.calls[0]![0] as string;
		expect(url).toContain('gemini-2.0-flash');
		expect(url).toContain('test-key');
	});
});

describe('testConnection', () => {
	it('returns true when the API responds with ok', async () => {
		mockFetch.mockResolvedValueOnce({ ok: true });
		expect(await testConnection('key', 'gemini-2.0-flash')).toBe(true);
	});

	it('returns false when the API responds with an error', async () => {
		mockFetch.mockResolvedValueOnce({ ok: false });
		expect(await testConnection('badkey', 'gemini-2.0-flash')).toBe(false);
	});
});
