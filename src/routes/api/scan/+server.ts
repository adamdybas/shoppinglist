import { error, json, isHttpError } from '@sveltejs/kit';
import { scanImage } from '$lib/server/vision';
import type { RequestHandler } from './$types';

export const prerender = false;

export const config = { maxDuration: 30 };

// Stay under Vercel's ~4.5 MB body limit so our 413 fires, not the platform's.
const MAX_BASE64_BYTES = 4 * 1024 * 1024;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// Best-effort per-IP cap — soft on multi-instance serverless; origin + size are
// the real guards.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const hits = new Map<string, number[]>();

// Read the body as text but abort past maxBytes, so a client omitting
// Content-Length can't stream an unbounded payload into memory.
async function readBodyCapped(request: Request, maxBytes: number): Promise<string> {
	const reader = request.body?.getReader();
	if (!reader) return '';

	const chunks: Uint8Array[] = [];
	let received = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		received += value.length;
		if (received > maxBytes) {
			await reader.cancel();
			throw error(413, 'Image too large');
		}
		chunks.push(value);
	}

	const merged = new Uint8Array(received);
	let offset = 0;
	for (const chunk of chunks) {
		merged.set(chunk, offset);
		offset += chunk.length;
	}
	return new TextDecoder().decode(merged);
}

function rateLimited(ip: string): boolean {
	const now = Date.now();
	const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
	recent.push(now);
	hits.set(ip, recent);

	// Drop aged-out IPs so the map can't grow unbounded on a warm instance.
	for (const [key, times] of hits) {
		if (key !== ip && times.every((t) => now - t >= RATE_WINDOW_MS)) {
			hits.delete(key);
		}
	}

	return recent.length > RATE_MAX;
}

export const POST: RequestHandler = async ({ request, url, getClientAddress }) => {
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) {
		throw error(403, 'Forbidden');
	}

	if (rateLimited(getClientAddress())) {
		throw error(429, 'Too many requests, slow down a moment.');
	}

	// Pre-check the declared size; readBodyCapped enforces a hard cap while
	// streaming (covers clients that omit Content-Length).
	const bodyCap = MAX_BASE64_BYTES + 1024;
	const contentLength = Number(request.headers.get('content-length'));
	if (contentLength && contentLength > bodyCap) {
		throw error(413, 'Image too large');
	}

	let body: { image?: unknown; mimeType?: unknown };
	try {
		body = JSON.parse(await readBodyCapped(request, bodyCap));
	} catch (e) {
		if (isHttpError(e)) throw e; // re-throw the 413 from readBodyCapped
		throw error(400, 'Invalid request body');
	}

	const { image, mimeType } = body;
	if (typeof image !== 'string' || typeof mimeType !== 'string') {
		throw error(400, 'Expected { image, mimeType }');
	}
	if (!ALLOWED_MIME.has(mimeType)) {
		throw error(400, 'Unsupported image type');
	}
	if (image.length > MAX_BASE64_BYTES) {
		throw error(413, 'Image too large');
	}

	try {
		const items = await scanImage(image, mimeType);
		return json({ items });
	} catch (e) {
		console.error('scan failed:', e);
		throw error(502, 'Could not read the photo. Try again.');
	}
};
