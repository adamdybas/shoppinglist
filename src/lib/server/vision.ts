// Server-only ($lib/server is never bundled to the client), so API keys stay put.
import { env } from '$env/dynamic/private';
import Anthropic from '@anthropic-ai/sdk';

const PROMPT = `You are reading a photo of a handwritten or printed shopping list.
Extract every shopping item you can see. Return ONLY a JSON array of short
strings, one per item — for example ["milk","2x eggs","bread"].
Rules:
- Preserve quantities written next to an item (e.g. "2x milk", "1kg flour").
- Keep each item terse: the product, not a sentence.
- Skip any item that is crossed out, struck through, or scribbled over, even if you
  can still read it — the writer deliberately removed it from the list.
- Ignore prices, dates, headings, page numbers, and illegible marks.
- If you cannot read any items, return [].
Return the JSON array and nothing else.`;

/** Pull the first JSON array of strings out of a model's text response. */
function parseItems(text: string): string[] {
	// First array only, so trailing prose can't break JSON.parse.
	const match = text.match(/\[[\s\S]*?\]/);
	if (!match) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(match[0]);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];
	return parsed
		.filter((item): item is string => typeof item === 'string')
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

// Rate limits / upstream hiccups — common on the free Gemini tier, worth retrying.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
// Total attempts per scan. Sized so 2 × REQUEST_TIMEOUT_MS plus backoff stays
// under the route's 30s maxDuration, so our own 502 fires before Vercel's 504.
const MAX_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 12_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function scanWithGemini(base64: string, mimeType: string): Promise<string[]> {
	const apiKey = env.GEMINI_API_KEY;
	if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

	const requestBody = JSON.stringify({
		contents: [
			{
				parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }]
			}
		]
	});

	let lastError: unknown;
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		if (attempt > 1) await sleep(500 * 2 ** (attempt - 2)); // backoff: 500ms

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		try {
			const res = await fetch(
				'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
				{
					method: 'POST',
					// Key in a header, not the URL query string — keeps it out of access logs.
					headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
					body: requestBody,
					signal: controller.signal
				}
			);

			if (res.ok) {
				const data = await res.json();
				const text: string =
					data?.candidates?.[0]?.content?.parts
						?.map((p: { text?: string }) => p.text ?? '')
						.join('') ?? '';
				return parseItems(text);
			}

			const detail = await res.text().catch(() => '');
			lastError = new Error(`Gemini request failed (${res.status}) ${detail}`.trim());
			if (!RETRYABLE_STATUS.has(res.status)) break; // non-retryable (e.g. 400/403)
		} catch (e) {
			lastError = e;
		} finally {
			clearTimeout(timeout);
		}
	}

	throw lastError;
}

async function scanWithAnthropic(base64: string, mimeType: string): Promise<string[]> {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

	// The SDK retries transient errors (429/5xx) with backoff on its own.
	// maxRetries counts retries *beyond* the first call, so -1 to match MAX_ATTEMPTS.
	const client = new Anthropic({
		apiKey,
		maxRetries: MAX_ATTEMPTS - 1,
		timeout: REQUEST_TIMEOUT_MS
	});
	const response = await client.messages.create({
		model: 'claude-haiku-4-5',
		max_tokens: 1024,
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'image',
						source: {
							type: 'base64',
							media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
							data: base64
						}
					},
					{ type: 'text', text: PROMPT }
				]
			}
		]
	});

	const text = response.content
		.filter((block): block is Anthropic.TextBlock => block.type === 'text')
		.map((block) => block.text)
		.join('');
	return parseItems(text);
}

/** Read a base64-encoded image and return detected shopping-list items. */
export async function scanImage(base64: string, mimeType: string): Promise<string[]> {
	const provider = (env.VISION_PROVIDER ?? 'gemini').toLowerCase();
	if (provider === 'anthropic') return scanWithAnthropic(base64, mimeType);
	return scanWithGemini(base64, mimeType);
}
