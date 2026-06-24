// Server-only: reads a photo of a shopping list with a vision LLM and returns
// the items as a list of short strings. Files under $lib/server are never
// bundled into the client, so API keys stay on the server.
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
	// Non-greedy: match the first complete array, so trailing prose with stray
	// brackets can't make JSON.parse fail.
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

async function scanWithGemini(base64: string, mimeType: string): Promise<string[]> {
	const apiKey = env.GEMINI_API_KEY;
	if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

	const res = await fetch(
		'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
		{
			method: 'POST',
			// Key in a header, not the URL query string — keeps it out of access logs.
			headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
			body: JSON.stringify({
				contents: [
					{
						parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }]
					}
				]
			})
		}
	);

	if (!res.ok) {
		throw new Error(`Gemini request failed (${res.status})`);
	}

	const data = await res.json();
	const text: string =
		data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ??
		'';
	return parseItems(text);
}

async function scanWithAnthropic(base64: string, mimeType: string): Promise<string[]> {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

	const client = new Anthropic({ apiKey });
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
