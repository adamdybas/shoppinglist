/**
 * Pull the first JSON array of strings out of a model's text response.
 *
 * Vision models are asked for bare JSON but routinely wrap it in prose or
 * markdown fences, so this tolerates anything around the array. Anything that
 * still fails to parse yields [] — a scan can come back empty, never crash.
 */
export function parseItems(text: string): string[] {
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
