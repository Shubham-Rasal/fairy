export interface GeminiConfig {
	apiKey: string;
	model: string;
	temperature: number;
	maxOutputTokens: number;
}

export interface WebSource {
	title: string;
	uri: string;
}

export interface GenerateResult {
	content: string;
	webSources: WebSource[];
}

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export async function generate(
	config: GeminiConfig,
	query: string,
	context: string,
	signal?: AbortSignal,
	vaultContext?: string,
): Promise<GenerateResult> {
	let prompt = `You are a writing assistant. Respond with ONLY the content that should replace the placeholder — no preamble, no explanation, just the content itself. Be concise and accurate.`;

	if (context) {
		prompt += `\n\nSurrounding context: "${context}"`;
	}
	if (vaultContext) {
		prompt += `\n\nVault context (from the user's personal notes — use if relevant):\n${vaultContext}`;
	}
	prompt += `\n\nPlaceholder to fill: "${query}"`;

	const body = {
		contents: [{
			parts: [{ text: prompt }]
		}],
		tools: [{ google_search: {} }],
		generationConfig: {
			temperature: config.temperature,
			maxOutputTokens: config.maxOutputTokens,
		}
	};

	const url = `${BASE_URL}/models/${config.model}:generateContent?key=${config.apiKey}`;

	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal,
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
		throw new Error(err?.error?.message ?? `Gemini API error ${res.status}`);
	}

	const data = await res.json() as {
		candidates?: Array<{
			content?: { parts?: Array<{ text?: string }> };
			groundingMetadata?: {
				groundingChunks?: Array<{
					web?: { uri?: string; title?: string };
				}>;
			};
		}>;
	};

	const candidate = data?.candidates?.[0];
	const text = candidate?.content?.parts?.[0]?.text ?? '';

	const webSources: WebSource[] = (candidate?.groundingMetadata?.groundingChunks ?? [])
		.filter(c => c.web?.uri)
		.map(c => ({ uri: c.web!.uri!, title: c.web!.title ?? c.web!.uri! }));

	return { content: text.trim(), webSources };
}

export async function testConnection(apiKey: string, model: string): Promise<boolean> {
	const url = `${BASE_URL}/models/${model}:generateContent?key=${apiKey}`;
	const body = {
		contents: [{ parts: [{ text: 'hi' }] }],
		generationConfig: { maxOutputTokens: 1 }
	};
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	return res.ok;
}
