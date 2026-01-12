<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
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
	let swipeProgress = $state<Record<string, number>>({}); // Track swipe progress for each item
	let addedItemsSet = $state(new Set<string>()); // Track which items have been added
	let previousParsedItems: string[] = []; // Track what was previously in the input
	let showArchiveHint = $state(false);
	let hasArchivedList = $state(false);
	let showDoneMessage = $state(false);
	let allItemsDone = $state(false); // Track if all items are done (but not archived yet)
	let isScrolled = $state(false);
	let previousSeparatorCount = 0; // Track number of separators to detect new additions
	let isLoading = $state(true); // Track if we're still loading from IndexedDB

	onMount(() => {
		// Load items from IndexedDB
		(async () => {
			items = await getAllItems();
			// Populate the set with existing items
			items.forEach((item: ShoppingItem) => addedItemsSet.add(item.text.toLowerCase()));
			
			// Check if there's an archived list
			const archived = await getArchivedList();
			hasArchivedList = archived !== null;
			
			// Show hint if list is empty and there's an archived list
			showArchiveHint = items.length === 0 && hasArchivedList;
			
			// Done loading!
			isLoading = false;
		})();
		
		// Listen for scroll events
		const handleScroll = () => {
			const wasScrolled = isScrolled;
			isScrolled = window.scrollY > 20;
			
			// Adjust textarea height when scroll state changes
			if (wasScrolled !== isScrolled) {
				autoGrow();
			}
		};
		window.addEventListener('scroll', handleScroll);
		
		return () => {
			window.removeEventListener('scroll', handleScroll);
		};
	});

	function checkIfAllDone() {
		console.log('🔍 checkIfAllDone called, items:', items.length);
		// Only check if there are items
		if (items.length === 0) {
			allItemsDone = false;
			showDoneMessage = false;
			return;
		}
		
		const allDone = items.every((item: ShoppingItem) => item.done);
		console.log('✅ All done?', allDone);
		
		if (allDone && !allItemsDone) {
			// First time all items are done - show message and clear input
			console.log('✅ All items done - showing message and clearing input');
			allItemsDone = true;
			showDoneMessage = true;
			
			// Clear the input
			inputText = '';
			
			// Message stays visible until user starts typing (handled in handleInput)
		} else if (!allDone && allItemsDone) {
			// User unchecked something - reset the flag
			console.log('↩️ User unchecked item - resetting done state');
			allItemsDone = false;
			showDoneMessage = false;
		}
	}

	async function archiveAndClear() {
		console.log('📦 archiveAndClear START');
		
		// Create plain object copy (remove Svelte proxy)
		const plainItems = JSON.parse(JSON.stringify(items));
		
		// Archive current list
		await archiveCurrentList(plainItems);
		
		// Clear ALL items from IndexedDB immediately
		await clearAllItems();
		
		// Mark that we have archived list
		hasArchivedList = true;
		
		// Clear state - items will fade out via transition
		items = [];
		addedItemsSet.clear();
		allItemsDone = false;
		
		console.log('📦 archiveAndClear DONE - items cleared from state');
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
		
		// Focus input at the end to continue typing
		if (textareaElement) {
			setTimeout(() => {
				textareaElement.focus();
				// Set cursor to end of text
				const length = inputText.length;
				textareaElement.setSelectionRange(length, length);
			}, 100);
		}
	}

	function autoGrow() {
		if (!textareaElement) return;
		textareaElement.style.height = 'auto';
		
		// If scrolled, limit to ~2 lines (~80px), otherwise up to 50% of screen
		const maxHeight = isScrolled ? 80 : window.innerHeight * 0.5;
		const newHeight = Math.min(textareaElement.scrollHeight, maxHeight);
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
		
		// Clear input after adding items
		if (newItemsToAdd.length > 0) {
			console.log('🧹 Clearing input after adding items');
			inputText = '';
			previousSeparatorCount = 0; // Reset separator count
		}
	}

	async function handleKeydown(event: KeyboardEvent) {
		console.log('⌨️ Key pressed:', event.key);
		
		// Prevent Enter from creating new line - add item directly
		if (event.key === 'Enter') {
			event.preventDefault();
			
			// If there's text, add it directly
			if (inputText.trim()) {
				console.log('✅ Enter pressed - adding item directly');
				const itemToAdd = inputText.trim();
				
				// Add the item
				const lowerText = itemToAdd.toLowerCase();
				if (!addedItemsSet.has(lowerText)) {
					const newItem = await addItem(itemToAdd);
					items = [newItem, ...items];
					addedItemsSet.add(lowerText);
				}
				
				// Clear input
				inputText = '';
				previousSeparatorCount = 0;
			}
		}
	}

	async function addItemsFromInput() {
		console.log('➕ addItemsFromInput called (form submit), inputText:', inputText);
		if (inputText.trim()) {
			await checkAndAddNewItems();
			autoGrow();
		}
	}

	function handleFormSubmit(e: SubmitEvent) {
		console.log('📝 FORM SUBMIT!');
		e.preventDefault();
		addItemsFromInput();
	}

	async function handleInput() {
		console.log('🎯 handleInput CALLED');
		console.log('📝 Current inputText:', JSON.stringify(inputText));
		
		autoGrow();
		
		// If user starts typing when all items are done -> hide done message, archive and show hint
		if (inputText.length > 0 && allItemsDone && items.length > 0) {
			console.log('🆕 User starting new list after completing old one - archiving now');
			// Save what user is typing
			const typedText = inputText;
			// Hide done message
			showDoneMessage = false;
			await archiveAndClear();
			// Restore what user typed (don't lose their first letter!)
			inputText = typedText;
			// Show hint
			showArchiveHint = true;
			// Don't return - let the rest of handleInput process the text
		}
		
		// If user starts typing after archiving, clear the old list from UI and show hint
		if (inputText.length > 0 && hasArchivedList && items.length > 0) {
			console.log('🆕 User starting new list - clearing old one and showing hint');
			// User is starting a new list - clear from UI (already cleared from DB)
			items = [];
			addedItemsSet.clear();
			// Show hint NOW (when they start typing, not when they delete text)
			showArchiveHint = true;
		}
		
		// Count separators (commas and newlines)
		const currentSeparatorCount = (inputText.match(/[,\n]/g) || []).length;
		console.log('🔢 Separator count - previous:', previousSeparatorCount, 'current:', currentSeparatorCount);
		
		// Only add items if separator count INCREASED (new comma/enter added)
		if (currentSeparatorCount > previousSeparatorCount) {
			console.log('🔹 New separator detected, checking for new items...');
			await checkAndAddNewItems();
			previousSeparatorCount = currentSeparatorCount;
		} else {
			console.log('❌ No new separator, just editing - skipping checkAndAddNewItems');
			previousSeparatorCount = currentSeparatorCount;
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
			
			// If text doesn't end with separator, add comma to process last item
			const trimmed = inputText.trim();
			if (trimmed && !trimmed.endsWith(',') && !trimmed.endsWith('\n')) {
				console.log('📋 Paste: adding comma to process last item');
				inputText = inputText + ',';
			}
			
			// Update separator count before adding
			previousSeparatorCount = (inputText.match(/[,\n]/g) || []).length;
			
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
		items = items.map((item: ShoppingItem) => (item.id === id ? { ...item, done: !item.done } : item));
		
		// Check if all items are now done
		checkIfAllDone();
	}

	function handleTouchStart(event: TouchEvent, itemId: string) {
		const touch = event.touches[0];
		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
		currentSwipeId = itemId;
	}

	function createTouchStartHandler(itemId: string) {
		return (e: TouchEvent) => handleTouchStart(e, itemId);
	}

	function createTouchMoveHandler(itemId: string) {
		return (e: TouchEvent) => handleTouchMove(e, itemId);
	}

	async function handleTouchMove(event: TouchEvent, itemId: string) {
		if (currentSwipeId !== itemId) return;

		const touch = event.touches[0];
		const deltaX = touch.clientX - touchStartX;
		const deltaY = touch.clientY - touchStartY;

		// Check if it's a horizontal swipe (not vertical)
		if (Math.abs(deltaY) > Math.abs(deltaX)) {
			currentSwipeId = null;
			swipeProgress = { ...swipeProgress, [itemId]: 0 };
			return;
		}

		// Get the element width
		const element = event.currentTarget as HTMLElement;
		const elementWidth = element.offsetWidth;

		// Calculate swipe percentage (only positive/right swipes)
		const swipePercentage = Math.max(0, (deltaX / elementWidth) * 100);
		
		// Update visual progress (cap at 100%)
		swipeProgress = { ...swipeProgress, [itemId]: Math.min(swipePercentage, 100) };

		// Check if swiped 30% or more of the element width from left to right
		if (swipePercentage >= 30) {
			// Mark as done
			const item = items.find((i: ShoppingItem) => i.id === itemId);
			if (item && !item.done) {
				await toggleItemDone(itemId);
				items = items.map((i: ShoppingItem) => (i.id === itemId ? { ...i, done: true } : i));
				
				// Check if all items are now done
				checkIfAllDone();
			}
			currentSwipeId = null;
			swipeProgress = { ...swipeProgress, [itemId]: 0 };
		}
	}

	function handleTouchEnd() {
		if (currentSwipeId) {
			// Reset swipe progress for this item
			swipeProgress = { ...swipeProgress, [currentSwipeId]: 0 };
		}
		currentSwipeId = null;
	}

	async function shareList() {
		// Prepare the list text - simple comma-separated (like SMS)
		const listText = items
			.map((item: ShoppingItem) => item.text)
			.join(', ');
		
		const shareData = {
			text: listText
		};

		try {
			if (navigator.share) {
				await navigator.share(shareData);
				console.log('✅ List shared successfully');
			} else {
				// Fallback: copy to clipboard
				await navigator.clipboard.writeText(listText);
				console.log('📋 List copied to clipboard');
				alert('List copied to clipboard!');
			}
		} catch (err) {
			console.error('❌ Error sharing:', err);
		}
	}
</script>

<svelte:head>
	<title>Shopping List</title>
	<meta name="description" content="A simple and powerful shopping list app" />
	<meta name="color-scheme" content="light dark" />
</svelte:head>

<div class="min-h-screen bg-white dark:bg-[#0F0F0F] p-4">
	<div class="mx-auto max-w-2xl">
		<!-- Header -->
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-3xl font-semibold text-[#1A1A1A] dark:text-[#EDEDED]">Shopping List</h1>
			{#if items.length > 0}
				<button
					onclick={shareList}
					class="text-[#6B6B6B] dark:text-[#9A9A9A] hover:text-[#1A1A1A] dark:hover:text-[#EDEDED] transition-colors p-2"
					aria-label="Share list"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
						<polyline points="16 6 12 2 8 6" />
						<line x1="12" y1="2" x2="12" y2="15" />
					</svg>
				</button>
			{/if}
		</div>

		<!-- Input Textarea with hidden form for iOS support -->
		<form onsubmit={handleFormSubmit} class="mb-6 sticky top-0 bg-white dark:bg-[#0F0F0F] z-10 {isScrolled ? 'py-2 shadow-sm dark:shadow-gray-800' : 'py-0'}">
			<textarea
				bind:this={textareaElement}
				bind:value={inputText}
				oninput={handleInput}
				onkeydown={handleKeydown}
				onpaste={handlePaste}
				placeholder="Add items to your list..."
				class="w-full resize-none rounded border border-[#6B6B6B] dark:border-[#9A9A9A] bg-white dark:bg-[#1a1a1a] text-[#1A1A1A] dark:text-[#EDEDED] px-4 py-3 transition-all focus:outline-none focus:shadow-sm placeholder-[#6B6B6B] dark:placeholder-[#9A9A9A] {isScrolled ? 'overflow-y-auto' : 'overflow-hidden'}"
				rows="1"
				style="min-height: 60px; font-size: 24px; line-height: 1.4;"
				autocorrect="off"
				autocapitalize="off"
				spellcheck="false"
			></textarea>
			<!-- Hidden submit button for iOS keyboard "Done" button -->
			<button type="submit" class="hidden" tabindex="-1" aria-hidden="true">Submit</button>
		</form>

		<!-- Done message (shown after all items done - yellow highlighter) -->
		{#if showDoneMessage}
			<div class="mb-4" transition:fade={{ duration: 500 }}>
				<span 
					class="inline-block px-2 py-1 rounded text-base bg-[#FFF4C2] text-[#5A4A00] dark:bg-[#3A3420] dark:text-[#F3E6A1]"
				>
					Done. Next time you'll probably write a new one.
				</span>
			</div>
		{/if}

		<!-- Shopping List -->
		<div>
			{#if items.length === 0 && !isLoading}
			{#if showArchiveHint}
				<div class="mb-4" transition:fade={{ duration: 500 }}>
					<span class="inline-block px-2 py-1 rounded bg-[#E8F0FF] dark:bg-[#1E2A3D]">
						<button
							onclick={restoreArchivedList}
							class="underline text-[#243A5E] dark:text-[#C7D7FF] hover:opacity-80 transition-opacity"
						>
							Old list is still here.
						</button>
						<span class="text-[#243A5E] dark:text-[#C7D7FF]"> Type to start a new one.</span>
					</span>
				</div>
			{:else if !hasArchivedList}
				<div class="py-8 text-center text-[#6B6B6B] dark:text-[#9A9A9A]" transition:fade={{ duration: 500 }}>
					<p>Your list is empty. Start adding items!</p>
				</div>
			{/if}
			{:else}
				{#each items as item (item.id)}
					<div
						transition:fade={{ duration: 600 }}
						class="py-2 px-1 cursor-pointer relative"
						role="button"
						tabindex="0"
						ontouchstart={createTouchStartHandler(item.id)}
						ontouchmove={createTouchMoveHandler(item.id)}
						ontouchend={handleTouchEnd}
						onclick={() => handleCheckboxChange(item.id)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								handleCheckboxChange(item.id);
							}
						}}
					>
						<!-- Hidden checkbox for accessibility/state management -->
						<input
							type="checkbox"
							checked={item.done}
							class="sr-only"
							tabindex="-1"
							aria-hidden="true"
						/>
						
						<!-- Swipe "ink" line that grows with finger -->
						{#if swipeProgress[item.id] > 0 && !item.done}
							<div
								class="absolute left-1 top-1/2 h-[2px] bg-[#1A1A1A] dark:bg-[#EDEDED] pointer-events-none"
								style="width: {swipeProgress[item.id]}%; transform: translateY(-50%); transition: width 0.05s linear;"
							></div>
						{/if}
						
						<span
							class="block relative {item.done
								? 'text-[#6B6B6B] dark:text-[#9A9A9A] line-through'
								: 'text-[#1A1A1A] dark:text-[#EDEDED]'}"
							style="font-size: 21px; line-height: 1.4;"
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
		background: #6B6B6B;
		border-radius: 4px;
	}

	textarea::-webkit-scrollbar-thumb:hover {
		background: #1A1A1A;
	}

	/* Dark mode - follows system preferences */
	@media (prefers-color-scheme: dark) {
		/* Main background */
		:global(body) {
			background-color: #0F0F0F;
		}

		/* Scrollbar dark mode */
		textarea::-webkit-scrollbar-track {
			background: #2a2a2a;
		}

		textarea::-webkit-scrollbar-thumb {
			background: #9A9A9A;
		}

		textarea::-webkit-scrollbar-thumb:hover {
			background: #EDEDED;
		}
	}
</style>
