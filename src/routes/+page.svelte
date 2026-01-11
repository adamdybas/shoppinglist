<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getAllItems,
		addItem,
		toggleItemDone,
		archiveCurrentList,
		getArchivedList,
		clearAllItems,
		type ShoppingItem
	} from '$lib/db';

	let inputText = $state('');
	let items = $state<ShoppingItem[]>([]);
	let textareaElement: HTMLTextAreaElement;
	let touchStartX = 0;
	let touchStartY = 0;
	let currentSwipeId: string | null = null;
	let addedItemsSet = $state(new Set<string>()); // Track which items have been added
	let previousParsedItems: string[] = []; // Track what was previously in the input
	let showArchiveHint = $state(false);
	let hasArchivedList = $state(false);

	onMount(async () => {
		// Load items from IndexedDB
		items = await getAllItems();
		// Populate the set with existing items
		items.forEach((item) => addedItemsSet.add(item.text.toLowerCase()));
		
		// Check if there's an archived list
		const archived = await getArchivedList();
		hasArchivedList = archived !== null;
		
		// Show hint if list is empty and there's an archived list
		showArchiveHint = items.length === 0 && hasArchivedList;
	});

	function checkIfAllDone() {
		console.log('🔍 checkIfAllDone called, items:', items.length);
		// Only check if there are items
		if (items.length === 0) return;
		
		const allDone = items.every((item) => item.done);
		console.log('✅ All done?', allDone);
		if (allDone) {
			console.log('🗂️ Archiving...');
			archiveAndClear();
		}
	}

	async function archiveAndClear() {
		console.log('📦 archiveAndClear START');
		console.log('Before clear - inputText:', inputText);
		
		// Create plain object copy (remove Svelte proxy)
		const plainItems = JSON.parse(JSON.stringify(items));
		
		// Archive current list
		await archiveCurrentList(plainItems);
		
		// Clear ALL items from IndexedDB immediately
		await clearAllItems();
		
		// Clear the input (fresh start)
		inputText = '';
		
		console.log('After clear - inputText:', inputText);
		console.log('hasArchivedList:', true);
		
		// Mark that we have archived list
		hasArchivedList = true;
		
		// Keep items in UI state to show what was bought
		// They will disappear when user starts typing
		console.log('📦 archiveAndClear DONE - items still visible:', items.length);
	}

	async function restoreArchivedList() {
		console.log('🔄 Restoring archived list...');
		const archived = await getArchivedList();
		if (!archived) return;
		
		// Restore items EXACTLY as they were (with done status!)
		// User will decide what to uncheck
		for (const item of archived.items) {
			const restoredItem = await addItem(item.text);
			
			// If item was done in archive, mark it as done again
			if (item.done) {
				await toggleItemDone(restoredItem.id);
			}
			
			items = [{ ...restoredItem, done: item.done }, ...items];
			addedItemsSet.add(item.text.toLowerCase());
		}
		
		console.log('✅ Restored', items.length, 'items with their done status');
		showArchiveHint = false;
		hasArchivedList = false; // Back to normal state
	}

	function autoGrow() {
		if (!textareaElement) return;
		textareaElement.style.height = 'auto';
		const newHeight = Math.min(textareaElement.scrollHeight, window.innerHeight * 0.5);
		textareaElement.style.height = newHeight + 'px';
	}

	function parseInputItems(text: string): string[] {
		// Only parse COMPLETE items - those followed by comma or newline
		// Don't parse the last line if user is still typing on it
		const items: string[] = [];
		
		// Split by comma or newline, but keep track of what separator was used
		const parts = text.split(/([,\n])/); // This keeps the separators
		
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i].trim();
			
			// Skip empty parts and separators
			if (!part || part === ',' || part === '\n') continue;
			
			// Only add if followed by a separator (comma or newline)
			// Check if next item is a separator
			if (i + 1 < parts.length && (parts[i + 1] === ',' || parts[i + 1] === '\n')) {
				items.push(part);
			}
		}
		
		console.log('📦 parseInputItems returning only COMPLETE items:', items);
		return items;
	}

	async function checkAndAddNewItems() {
		console.log('🔍 checkAndAddNewItems - inputText:', inputText);
		const currentItems = parseInputItems(inputText);
		console.log('📋 Parsed items:', currentItems);
		console.log('✅ Already added:', Array.from(addedItemsSet));
		
		const newItemsToAdd: string[] = [];

		// Find items that haven't been added yet
		for (const itemText of currentItems) {
			const lowerText = itemText.toLowerCase();
			if (!addedItemsSet.has(lowerText)) {
				console.log('🆕 New item to add:', itemText);
				newItemsToAdd.push(itemText);
				addedItemsSet.add(lowerText);
			} else {
				console.log('⏭️ Skipping duplicate:', itemText);
			}
		}

		console.log('➕ Adding', newItemsToAdd.length, 'new items');
		// Add new items to the list
		for (const itemText of newItemsToAdd) {
			const newItem = await addItem(itemText);
			items = [newItem, ...items]; // Add to beginning (newest on top)
			console.log('✅ Added:', newItem);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		console.log('⌨️ Key pressed:', event.key);
		// Enter just creates a new line - handleInput will detect it and add items
		// No special handling needed!
	}

	async function addItemsFromInput() {
		console.log('➕ addItemsFromInput called (form submit), inputText:', inputText);
		if (inputText.trim()) {
			await checkAndAddNewItems();
			autoGrow();
		}
	}

	async function handleInput() {
		console.log('🎯 handleInput CALLED');
		console.log('📝 Current inputText:', JSON.stringify(inputText));
		console.log('🔍 Has comma?', inputText.includes(','));
		console.log('🔍 Has newline?', inputText.includes('\n'));
		console.log('🔍 Char codes:', Array.from(inputText).map(c => c.charCodeAt(0)));
		
		autoGrow();
		
		// If user starts typing after archiving, clear the old list from UI and show hint
		if (inputText.length > 0 && hasArchivedList && items.length > 0) {
			console.log('🆕 User starting new list - clearing old one and showing hint');
			// User is starting a new list - clear from UI (already cleared from DB)
			items = [];
			addedItemsSet.clear();
			// Show hint NOW (when they start typing, not when they delete text)
			showArchiveHint = true;
		}
		
		// Check if there's a comma or newline - automatically add new items
		// This handles typing commas/newlines AND pasting text
		if (inputText.includes(',') || inputText.includes('\n')) {
			console.log('🔹 Comma or newline detected, checking for new items...');
			await checkAndAddNewItems();
		} else {
			console.log('❌ No comma or newline found, skipping checkAndAddNewItems');
		}
		
		// Hide hint when actually adding items (not just typing)
		if (inputText.length > 0 && items.length > 0) {
			showArchiveHint = false;
			hasArchivedList = false; // Reset archive state when user is working with items
		}
	}

	async function handlePaste() {
		// Wait a bit for paste to complete, then process
		setTimeout(async () => {
			// If pasting after archiving, clear the old list from UI
			if (hasArchivedList && items.length > 0) {
				items = [];
				addedItemsSet.clear();
				showArchiveHint = true; // Show hint when clearing
			}
			
			await checkAndAddNewItems();
			
			// Hide hint after adding items
			if (items.length > 0) {
				showArchiveHint = false;
				hasArchivedList = false; // Reset archive state
			}
			
			autoGrow();
		}, 10);
	}

	async function handleCheckboxChange(id: string) {
		await toggleItemDone(id);
		items = items.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
		
		// Check if all items are now done
		checkIfAllDone();
	}

	function handleTouchStart(event: TouchEvent, itemId: string) {
		const touch = event.touches[0];
		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
		currentSwipeId = itemId;
	}

	async function handleTouchMove(event: TouchEvent, itemId: string) {
		if (currentSwipeId !== itemId) return;

		const touch = event.touches[0];
		const deltaX = touch.clientX - touchStartX;
		const deltaY = touch.clientY - touchStartY;

		// Check if it's a horizontal swipe (not vertical)
		if (Math.abs(deltaY) > Math.abs(deltaX)) {
			currentSwipeId = null;
			return;
		}

		// Get the element width
		const element = event.currentTarget as HTMLElement;
		const elementWidth = element.offsetWidth;

		// Check if swiped 40-60% of the width from left to right
		const swipePercentage = (deltaX / elementWidth) * 100;

		if (swipePercentage >= 40 && swipePercentage <= 60) {
			// Mark as done
			const item = items.find((i) => i.id === itemId);
			if (item && !item.done) {
				await toggleItemDone(itemId);
				items = items.map((i) => (i.id === itemId ? { ...i, done: true } : i));
				
				// Check if all items are now done
				checkIfAllDone();
			}
			currentSwipeId = null;
		}
	}

	function handleTouchEnd() {
		currentSwipeId = null;
	}
</script>

<svelte:head>
	<title>Shopping List</title>
	<meta name="description" content="A simple and powerful shopping list app" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
	<div class="mx-auto max-w-2xl">
		<!-- Header -->
		<div class="mb-6 text-center">
			<h1 class="text-3xl font-bold text-gray-800">Shopping List</h1>
			<p class="text-sm text-gray-600">
				Paste your list or type items (comma/newline separated), then press Enter to add.
			</p>
		</div>

		<!-- Input Textarea with hidden form for iOS support -->
		<form onsubmit={(e) => { console.log('📝 FORM SUBMIT!'); e.preventDefault(); addItemsFromInput(); }} class="mb-6">
			<textarea
				bind:this={textareaElement}
				bind:value={inputText}
				oninput={handleInput}
				onkeydown={handleKeydown}
				onpaste={handlePaste}
				placeholder="Add items to your list..."
				class="w-full resize-none overflow-hidden rounded-lg border-2 border-indigo-300 bg-white px-4 py-3 text-lg shadow-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
				rows="1"
				style="min-height: 60px;"
				enterkeyhint="done"
			></textarea>
			<!-- Hidden submit button for iOS keyboard "Done" button -->
			<button type="submit" class="hidden" tabindex="-1" aria-hidden="true">Submit</button>
		</form>

		<!-- Shopping List -->
		<div class="space-y-2">
			{#if items.length === 0}
				{#if showArchiveHint}
					<button
						onclick={restoreArchivedList}
						class="w-full rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50 p-8 text-center transition-all hover:border-indigo-400 hover:bg-indigo-100"
					>
						<div class="text-indigo-600">
							<p class="mb-2 text-lg font-medium">🗂️ Previous list completed!</p>
							<p class="text-sm">
								Click to restore previous list and add items to it,<br />or type to create a new
								one
							</p>
						</div>
					</button>
				{:else}
					<div class="rounded-lg bg-white p-8 text-center text-gray-400 shadow-sm">
						<p>Your list is empty. Start adding items!</p>
					</div>
				{/if}
			{:else}
				{#each items as item (item.id)}
					<div
						class="group flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm transition-all hover:shadow-md"
						ontouchstart={(e) => handleTouchStart(e, item.id)}
						ontouchmove={(e) => handleTouchMove(e, item.id)}
						ontouchend={handleTouchEnd}
					>
						<input
							type="checkbox"
							checked={item.done}
							onchange={() => handleCheckboxChange(item.id)}
							class="h-5 w-5 cursor-pointer rounded border-gray-300 text-indigo-600 transition-all focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0"
						/>
						<span
							class="flex-1 text-lg transition-all {item.done
								? 'text-gray-400 line-through'
								: 'text-gray-800'}"
						>
							{item.text}
						</span>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	/* Custom scrollbar for textarea */
	textarea::-webkit-scrollbar {
		width: 8px;
	}

	textarea::-webkit-scrollbar-track {
		background: #f1f1f1;
		border-radius: 4px;
	}

	textarea::-webkit-scrollbar-thumb {
		background: #c7d2fe;
		border-radius: 4px;
	}

	textarea::-webkit-scrollbar-thumb:hover {
		background: #a5b4fc;
	}
</style>
