import type { ShoppingItem } from './db';

export function parseItemsFromInput(inputText: string): string[] {
	return inputText
		.split(/[,.]\s+/)
		.map((itemText) => itemText.trim())
		.filter((itemText) => itemText.length > 0);
}

/**
 * Downscale + compress an image file to a JPEG and return its base64 data
 * (without the data-URL prefix). Keeps the upload small and cheap to scan.
 */
async function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		// Some browsers can't decode HEIC/HEIF photos from the library.
		throw new Error("Couldn't read that image. Try a JPEG or PNG photo.");
	}
	const maxEdge = 1280;
	const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
	const width = Math.round(bitmap.width * scale);
	const height = Math.round(bitmap.height * scale);

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Could not process image');
	ctx.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();

	const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
	const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
	return { base64, mimeType: 'image/jpeg' };
}

/**
 * Send a photo of a shopping list to the scan endpoint and return the detected
 * items. The API key lives server-side; the browser only talks to /api/scan.
 */
export async function scanPhoto(file: File): Promise<string[]> {
	const { base64, mimeType } = await compressImage(file);

	const res = await fetch('/api/scan', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ image: base64, mimeType })
	});

	if (!res.ok) {
		// SvelteKit error() bodies are JSON ({ message }); fall back to plain text.
		let message = '';
		try {
			const data = await res.json();
			if (data && typeof data.message === 'string') message = data.message;
		} catch {
			message = await res.text().catch(() => '');
		}
		throw new Error(message || 'Could not read the photo.');
	}

	const data = await res.json();
	return Array.isArray(data.items) ? data.items : [];
}

export async function shareList(items: ShoppingItem[], hideDone: boolean): Promise<void> {
	const visibleItems = hideDone ? items.filter((item) => !item.done) : items;
	const listText = visibleItems.map((item) => item.text).join(', ');

	try {
		if (navigator.share) {
			await navigator.share({ text: listText });
		} else {
			await navigator.clipboard.writeText(listText);
		}
	} catch (err) {
		console.error('Error sharing:', err);
	}
}
