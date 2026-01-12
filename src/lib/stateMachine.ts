import type { ShoppingItem } from './db';

// State definitions
export type AppState =
	| { type: 'LOADING' }
	| { type: 'EMPTY' }
	| { type: 'ACTIVE'; items: ShoppingItem[] }
	| { type: 'ALL_DONE'; items: ShoppingItem[] }
	| { type: 'ARCHIVED_AVAILABLE' };

// Event definitions
export type AppEvent =
	| { type: 'LOADED'; items: ShoppingItem[]; hasArchive: boolean }
	| { type: 'ITEM_ADDED'; item: ShoppingItem }
	| { type: 'ITEM_TOGGLED'; id: string }
	| { type: 'ALL_CHECKED' }
	| { type: 'START_TYPING' }
	| { type: 'RESTORE_ARCHIVE'; items: ShoppingItem[] };

// State machine transition function
export function transition(state: AppState, event: AppEvent): AppState {
	console.log('🔄 State transition:', state.type, '+', event.type);

	switch (state.type) {
		case 'LOADING':
			if (event.type === 'LOADED') {
				if (event.items.length === 0 && event.hasArchive) {
					return { type: 'ARCHIVED_AVAILABLE' };
				} else if (event.items.length === 0) {
					return { type: 'EMPTY' };
				} else {
					const allDone = event.items.every((item) => item.done);
					if (allDone) {
						return { type: 'ALL_DONE', items: event.items };
					}
					return { type: 'ACTIVE', items: event.items };
				}
			}
			break;

		case 'EMPTY':
			if (event.type === 'ITEM_ADDED') {
				return { type: 'ACTIVE', items: [event.item] };
			}
			break;

		case 'ACTIVE':
			if (event.type === 'ITEM_ADDED') {
				return { type: 'ACTIVE', items: [event.item, ...state.items] };
			}
			if (event.type === 'ITEM_TOGGLED') {
				const updatedItems = state.items.map((item) =>
					item.id === event.id ? { ...item, done: !item.done } : item
				);
				return { type: 'ACTIVE', items: updatedItems };
			}
			if (event.type === 'ALL_CHECKED') {
				return { type: 'ALL_DONE', items: state.items };
			}
			break;

		case 'ALL_DONE':
			if (event.type === 'ITEM_TOGGLED') {
				const updatedItems = state.items.map((item) =>
					item.id === event.id ? { ...item, done: !item.done } : item
				);
				const allDone = updatedItems.every((item) => item.done);
				if (allDone) {
					return { type: 'ALL_DONE', items: updatedItems };
				} else {
					return { type: 'ACTIVE', items: updatedItems };
				}
			}
			if (event.type === 'START_TYPING') {
				return { type: 'ARCHIVED_AVAILABLE' };
			}
			break;

		case 'ARCHIVED_AVAILABLE':
			if (event.type === 'ITEM_ADDED') {
				return { type: 'ACTIVE', items: [event.item] };
			}
			if (event.type === 'RESTORE_ARCHIVE') {
				const allDone = event.items.every((item) => item.done);
				if (allDone) {
					return { type: 'ALL_DONE', items: event.items };
				}
				return { type: 'ACTIVE', items: event.items };
			}
			break;
	}

	console.warn('⚠️ Unhandled transition:', state.type, '+', event.type);
	return state;
}

// Helper to check if all items are done
export function checkAllDone(items: ShoppingItem[]): boolean {
	return items.length > 0 && items.every((item) => item.done);
}
