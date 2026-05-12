import type { ShoppingItem } from './db';

export function parseItemsFromInput(inputText: string): string[] {
	return inputText
		.split(/[,.]\s+/)
		.map((itemText) => itemText.trim())
		.filter((itemText) => itemText.length > 0);
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
