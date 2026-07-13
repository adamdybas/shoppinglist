import { describe, expect, it } from 'vitest';
import type { ShoppingItem } from './db';
import { parseItemsFromInput, resolveItemAction } from './list';

function item(text: string, done = false): ShoppingItem {
	return { id: `id-${text}`, text, done, createdAt: 0 };
}

describe('parseItemsFromInput', () => {
	it('splits on commas between items', () => {
		expect(parseItemsFromInput('milk, eggs, bread')).toEqual(['milk', 'eggs', 'bread']);
	});

	it('splits on sentence-style periods', () => {
		expect(parseItemsFromInput('milk. eggs. bread')).toEqual(['milk', 'eggs', 'bread']);
	});

	it('keeps quantities with decimal separators intact', () => {
		// "1.5kg" and "2,5l" have no whitespace after the separator — not item boundaries.
		expect(parseItemsFromInput('1.5kg flour, 2,5l water')).toEqual(['1.5kg flour', '2,5l water']);
	});

	it('trims whitespace and drops empty segments', () => {
		expect(parseItemsFromInput('  milk ,  , eggs, ')).toEqual(['milk', 'eggs']);
	});

	it('treats input without separators as a single item', () => {
		expect(parseItemsFromInput('dark chocolate 70%')).toEqual(['dark chocolate 70%']);
	});
});

describe('resolveItemAction', () => {
	const items = [item('Milk'), item('eggs', true)];

	it('adds a text not on the list', () => {
		expect(resolveItemAction(items, 'bread')).toEqual({ kind: 'add' });
	});

	it('unchecks a checked-off item instead of duplicating it', () => {
		expect(resolveItemAction(items, 'eggs')).toEqual({ kind: 'uncheck', id: 'id-eggs' });
	});

	it('skips an item that is already active', () => {
		expect(resolveItemAction(items, 'Milk')).toEqual({ kind: 'skip' });
	});

	it('matches case-insensitively', () => {
		expect(resolveItemAction(items, 'MILK')).toEqual({ kind: 'skip' });
		expect(resolveItemAction(items, 'Eggs')).toEqual({ kind: 'uncheck', id: 'id-eggs' });
	});

	it('adds anything when the list is empty', () => {
		expect(resolveItemAction([], 'milk')).toEqual({ kind: 'add' });
	});
});
