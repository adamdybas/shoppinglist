import { describe, expect, it } from 'vitest';
import type { ShoppingItem } from './db';
import { checkAllDone, transition, type AppState } from './stateMachine';

function item(text: string, done = false): ShoppingItem {
	return { id: `id-${text}`, text, done, createdAt: 0 };
}

describe('transition from LOADING', () => {
	const loading: AppState = { type: 'LOADING' };

	it('goes to EMPTY when nothing is stored', () => {
		expect(transition(loading, { type: 'LOADED', items: [], hasArchive: false })).toEqual({
			type: 'EMPTY'
		});
	});

	it('goes to ARCHIVED_AVAILABLE when only an archive exists', () => {
		expect(transition(loading, { type: 'LOADED', items: [], hasArchive: true })).toEqual({
			type: 'ARCHIVED_AVAILABLE'
		});
	});

	it('goes to ACTIVE when open items exist', () => {
		const items = [item('milk'), item('eggs', true)];
		expect(transition(loading, { type: 'LOADED', items, hasArchive: false })).toEqual({
			type: 'ACTIVE',
			items
		});
	});

	it('goes straight to ALL_DONE when every stored item is checked', () => {
		const items = [item('milk', true), item('eggs', true)];
		expect(transition(loading, { type: 'LOADED', items, hasArchive: false })).toEqual({
			type: 'ALL_DONE',
			items
		});
	});
});

describe('transition in ACTIVE', () => {
	it('prepends newly added items', () => {
		const state: AppState = { type: 'ACTIVE', items: [item('milk')] };
		const next = transition(state, { type: 'ITEM_ADDED', item: item('eggs') });
		expect(next.type).toBe('ACTIVE');
		if (next.type === 'ACTIVE') {
			expect(next.items.map((i) => i.text)).toEqual(['eggs', 'milk']);
		}
	});

	it('toggles only the targeted item', () => {
		const state: AppState = { type: 'ACTIVE', items: [item('milk'), item('eggs')] };
		const next = transition(state, { type: 'ITEM_TOGGLED', id: 'id-milk' });
		if (next.type === 'ACTIVE') {
			expect(next.items.find((i) => i.id === 'id-milk')?.done).toBe(true);
			expect(next.items.find((i) => i.id === 'id-eggs')?.done).toBe(false);
		} else {
			expect.unreachable('expected ACTIVE');
		}
	});

	it('moves to ALL_DONE on ALL_CHECKED', () => {
		const items = [item('milk', true)];
		expect(transition({ type: 'ACTIVE', items }, { type: 'ALL_CHECKED' })).toEqual({
			type: 'ALL_DONE',
			items
		});
	});
});

describe('transition in ALL_DONE', () => {
	const allDone: AppState = { type: 'ALL_DONE', items: [item('milk', true), item('eggs', true)] };

	it('returns to ACTIVE when an item is unchecked', () => {
		const next = transition(allDone, { type: 'ITEM_TOGGLED', id: 'id-milk' });
		expect(next.type).toBe('ACTIVE');
	});

	it('archives (ARCHIVED_AVAILABLE) when the user starts typing a new list', () => {
		expect(transition(allDone, { type: 'START_TYPING' })).toEqual({ type: 'ARCHIVED_AVAILABLE' });
	});
});

describe('transition in ARCHIVED_AVAILABLE', () => {
	const archived: AppState = { type: 'ARCHIVED_AVAILABLE' };

	it('starts a fresh ACTIVE list on ITEM_ADDED', () => {
		const milk = item('milk');
		expect(transition(archived, { type: 'ITEM_ADDED', item: milk })).toEqual({
			type: 'ACTIVE',
			items: [milk]
		});
	});

	it('restores the archived items on RESTORE_ARCHIVE', () => {
		const items = [item('milk'), item('eggs', true)];
		expect(transition(archived, { type: 'RESTORE_ARCHIVE', items })).toEqual({
			type: 'ACTIVE',
			items
		});
	});
});

describe('invalid events', () => {
	it('are ignored and return the same state', () => {
		const empty: AppState = { type: 'EMPTY' };
		expect(transition(empty, { type: 'ITEM_TOGGLED', id: 'id-milk' })).toBe(empty);
	});
});

describe('checkAllDone', () => {
	it('is false for an empty list — nothing to celebrate', () => {
		expect(checkAllDone([])).toBe(false);
	});

	it('is true only when every item is done', () => {
		expect(checkAllDone([item('milk', true), item('eggs', true)])).toBe(true);
		expect(checkAllDone([item('milk', true), item('eggs')])).toBe(false);
	});
});
