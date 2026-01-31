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
	import { transition, checkAllDone, type AppState, type AppEvent } from '$lib/stateMachine';

	// State machine!
	let appState = $state<AppState>({ type: 'LOADING' });
	let displayItems = $state<ShoppingItem[]>([]);
	let listFadeTimeout: ReturnType<typeof setTimeout> | null = null;
	
	// Helper to dispatch events
	function dispatch(event: AppEvent) {
		console.log('📨 Dispatching:', event.type);
		appState = transition(appState, event);
		console.log('📍 New state:', appState.type);
	}
	
	// Derived values
	let items = $derived(appState.type === 'ACTIVE' || appState.type === 'ALL_DONE' ? appState.items : []);

	let inputText = $state('');
	let textareaElement: HTMLTextAreaElement;
	let touchStartX = 0;
	let touchStartY = 0;
	let currentSwipeId: string | null = null;
let swipeProgress = $state<Record<string, number>>({}); // Track swipe progress for each item
let addedItemsSet = $state(new Set<string>()); // Track which items have been added
let isScrolled = $state(false);

	$effect(() => {
		if (listFadeTimeout) {
			clearTimeout(listFadeTimeout);
			listFadeTimeout = null;
		}

		if (appState.type === 'ACTIVE' || appState.type === 'ALL_DONE') {
			displayItems = appState.items;
		} else if (appState.type === 'ARCHIVED_AVAILABLE') {
			// Fade out the last list before removing it from the DOM.
			listFadeTimeout = setTimeout(() => {
				if (appState.type === 'ARCHIVED_AVAILABLE') {
					displayItems = [];
				}
			}, 200);
		} else {
			displayItems = [];
		}
	});


	onMount(() => {
		// Load items from IndexedDB
		(async () => {
			const loadedItems = await getAllItems();
			// Populate the set with existing items
			loadedItems.forEach((item: ShoppingItem) => addedItemsSet.add(item.text.toLowerCase()));
			
			// Check if there's an archived list
			const archived = await getArchivedList();
			const hasArchive = archived !== null;
			
			// Dispatch LOADED event to state machine
			dispatch({ type: 'LOADED', items: loadedItems, hasArchive });
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

	function checkAndDispatchAllDone() {
		console.log('🔍 checkAndDispatchAllDone called');
		if (appState.type === 'ACTIVE' && checkAllDone(appState.items)) {
			console.log('✅ All items done - dispatching ALL_CHECKED');
			inputText = ''; // Clear input
			dispatch({ type: 'ALL_CHECKED' });
		}
	}

	async function archiveAndClear() {
		console.log('📦 archiveAndClear START');
		
		if (appState.type !== 'ALL_DONE') return;
		
		// Create plain object copy (remove Svelte proxy)
		const plainItems = JSON.parse(JSON.stringify(appState.items));
		
		// Archive current list
		await archiveCurrentList(plainItems);
		
		// Clear ALL items from IndexedDB immediately
		await clearAllItems();
		
		// Clear tracking
		addedItemsSet.clear();
		
		console.log('📦 archiveAndClear DONE');
	}

	async function restoreArchivedList() {
		console.log('🔄 Restoring archived list...');
		const archived = await getArchivedList();
		if (!archived) return;
		
		const restoredItems: ShoppingItem[] = [];
		
		// Restore items EXACTLY as they were (with done status!)
		// User will decide what to uncheck
		for (const item of archived.items) {
			const restoredItem = await addItem(item.text);
			
			// If item was done in archive, mark it as done again
			if (item.done) {
				await toggleItemDone(restoredItem.id);
			}
			
			restoredItems.push({ ...restoredItem, done: item.done });
			addedItemsSet.add(item.text.toLowerCase());
		}
		
		console.log('✅ Restored', restoredItems.length, 'items with their done status');
		
		// Dispatch to state machine
		dispatch({ type: 'RESTORE_ARCHIVE', items: restoredItems });
		
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


	async function handleKeydown(event: KeyboardEvent) {
		console.log('⌨️ Key pressed:', event.key, 'State:', appState.type);
		
		// Enter = add items (parse for smart separators)
		if (event.key === 'Enter') {
			event.preventDefault();
			
			if (inputText.trim()) {
				console.log('✅ Enter pressed, text:', inputText);
				
				// Parse text with smart separators (", " or ". " split into multiple items)
				// "1,5kg" → 1 item, "kanapka, woda" → 2 items
				const itemsToAdd = inputText
					.split(/[,\.]\s+/) // Split by comma/period + space(s)
					.map(s => s.trim())
					.filter(s => s.length > 0);
				
				console.log('📋 Parsed items from input:', itemsToAdd);
				
				// Add each item
				for (const itemText of itemsToAdd) {
					const lowerText = itemText.toLowerCase();
					if (!addedItemsSet.has(lowerText)) {
						console.log('🆕 Adding item:', itemText);
						const newItem = await addItem(itemText);
						dispatch({ type: 'ITEM_ADDED', item: newItem });
						addedItemsSet.add(lowerText);
					} else {
						console.log('⏭️ Skipping duplicate:', itemText);
					}
				}
				
				// Clear input
				inputText = '';
				console.log('🧹 Input cleared');
			} else {
				console.log('❌ No text to add');
			}
		}
	}

function handleFormSubmit(e: SubmitEvent) {
	console.log('📝 FORM SUBMIT (iOS keyboard)');
	e.preventDefault();
	
	// Same logic as Enter key
	if (inputText.trim()) {
		// Parse text with smart separators
		const itemsToAdd = inputText
			.split(/[,\.]\s+/)
			.map(s => s.trim())
			.filter(s => s.length > 0);
		
		console.log('📋 Form submit - parsed items:', itemsToAdd);
		
		// Add each item
		(async () => {
			for (const itemText of itemsToAdd) {
				const lowerText = itemText.toLowerCase();
				if (!addedItemsSet.has(lowerText)) {
					const newItem = await addItem(itemText);
					dispatch({ type: 'ITEM_ADDED', item: newItem });
					addedItemsSet.add(lowerText);
				}
			}
			
		// Clear input
		inputText = '';
		autoGrow();
		})();
	}
}

	async function handleInput() {
		console.log('🎯 handleInput CALLED');
		console.log('📝 Current inputText:', JSON.stringify(inputText));
		
		autoGrow();
		
		// If user starts typing when all items are done -> archive and transition to ARCHIVED_AVAILABLE
		if (inputText.length > 0 && appState.type === 'ALL_DONE') {
			console.log('🆕 User starting new list after completing old one - archiving now');
			// Save what user is typing
			const typedText = inputText;
			await archiveAndClear();
			// Dispatch START_TYPING event
			dispatch({ type: 'START_TYPING' });
			// Restore what user typed (don't lose their first letter!)
			inputText = typedText;
			// Don't return - let the rest of handleInput process the text
		}
		
	// Don't auto-add on comma/period anymore - only on Enter or Paste
	// Just let user type freely
	}

	async function handlePaste() {
		// Wait a bit for paste to complete, then auto-add items
		setTimeout(async () => {
			if (inputText.trim()) {
				console.log('📋 Paste detected, auto-adding items');
				
				// Parse pasted text with smart separators
				const itemsToAdd = inputText
					.split(/[,\.]\s+/) // Split by comma/period + space(s)
					.map(s => s.trim())
					.filter(s => s.length > 0);
				
				console.log('📋 Parsed items from paste:', itemsToAdd);
				
				// Add each item
				for (const itemText of itemsToAdd) {
					const lowerText = itemText.toLowerCase();
					if (!addedItemsSet.has(lowerText)) {
						console.log('🆕 Adding pasted item:', itemText);
						const newItem = await addItem(itemText);
						dispatch({ type: 'ITEM_ADDED', item: newItem });
						addedItemsSet.add(lowerText);
					} else {
						console.log('⏭️ Skipping duplicate:', itemText);
					}
				}
				
			// Clear input after paste
			inputText = '';
			}
			
			autoGrow();
		}, 10);
	}

	async function handleCheckboxChange(id: string) {
		await toggleItemDone(id);
		dispatch({ type: 'ITEM_TOGGLED', id });
		
		// Check if all items are now done
		checkAndDispatchAllDone();
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

	// Check if swiped 20% or more of the element width from left to right
	if (swipePercentage >= 20) {
			// Mark as done
			const item = items.find((i: ShoppingItem) => i.id === itemId);
			if (item && !item.done) {
				await toggleItemDone(itemId);
				dispatch({ type: 'ITEM_TOGGLED', id: itemId });
				
				// Check if all items are now done
				checkAndDispatchAllDone();
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
			<h1 class="text-3xl font-semibold text-[#2A2A2A] dark:text-[#D4D4D4]">Shopping List</h1>
			<button
				onclick={shareList}
				class="text-[#6B6B6B] dark:text-[#9A9A9A] hover:text-[#2A2A2A] dark:hover:text-[#D4D4D4] transition-colors p-2 {items.length > 0 ? '' : 'opacity-0 pointer-events-none'}"
				aria-label="Share list"
				aria-hidden={items.length === 0}
				tabindex={items.length > 0 ? 0 : -1}
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
		</div>

		<!-- Input Textarea with hidden form for iOS support -->
		<form onsubmit={handleFormSubmit} class="mb-6 sticky top-0 bg-white dark:bg-[#0F0F0F] z-10 {isScrolled ? 'py-2' : 'py-0'}">
			<textarea
				bind:this={textareaElement}
				bind:value={inputText}
				oninput={handleInput}
				onkeydown={handleKeydown}
				onpaste={handlePaste}
				placeholder="Type items ..."
				class="w-full resize-none rounded-lg border border-[#B8B1A3] dark:border-[#6E6A63] bg-white dark:bg-[#1a1a1a] text-[#2A2A2A] dark:text-[#D4D4D4] px-4 py-3 transition-all focus:outline-none focus-visible:outline-none focus:border-[rgba(180,170,150,0.5)] dark:focus:border-[rgba(180,170,150,0.5)] focus:shadow-[0_0_0_3px_rgba(180,170,150,0.5)] dark:focus:shadow-[0_0_0_3px_rgba(180,170,150,0.5)] placeholder-[#6B6B6B] dark:placeholder-[#9A9A9A] {isScrolled ? 'overflow-y-auto' : 'overflow-hidden'}"
				rows="1"
				style="min-height: 60px; font-size: 24px; line-height: 1.4;"
				autocorrect="off"
				autocapitalize="off"
				spellcheck="false"
			></textarea>
			<!-- Hidden submit button for iOS keyboard "Done" button -->
			<button type="submit" class="hidden" tabindex="-1" aria-hidden="true">Submit</button>
		</form>

	<!-- Messages (Done / Archive hint) -->
	{#if appState.type === 'ALL_DONE' || appState.type === 'ARCHIVED_AVAILABLE'}
		<div class="mb-4 relative min-h-[32px]">
			<div
				class="absolute left-0 top-0 transition-opacity duration-200 {appState.type === 'ALL_DONE' ? 'opacity-100' : 'opacity-0 pointer-events-none'}"
			>
				<span 
					class="inline-block px-2 py-1 rounded text-base bg-[#FFF4C2] text-[#5A4A00] dark:bg-[#3A3420] dark:text-[#F3E6A1]"
				>
					— all done —
				</span>
			</div>
			<div
				class="absolute left-0 top-0 transition-opacity duration-200 {appState.type === 'ARCHIVED_AVAILABLE' ? 'opacity-100' : 'opacity-0 pointer-events-none'}"
			>
				<span class="inline-block px-2 py-1 rounded bg-[#E8F0FF] dark:bg-[#1E2A3D]">
					<button
						onclick={restoreArchivedList}
						tabindex="-1"
						class="underline text-[#243A5E] dark:text-[#C7D7FF] hover:opacity-80 transition-opacity"
					>
						Old list is still here.
					</button>
					<span class="text-[#243A5E] dark:text-[#C7D7FF]"> Type to start a new one.</span>
				</span>
			</div>
		</div>
	{/if}

	<!-- Shopping List -->
	<div class="transition-opacity duration-200 {appState.type === 'ARCHIVED_AVAILABLE' ? 'opacity-0' : 'opacity-100'}">
		{#if displayItems.length > 0}
			{#each displayItems as item (item.id)}
				<div
					transition:fade={{ duration: 1200 }}
					class="py-3 px-1 cursor-pointer relative"
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
								class="absolute left-1 top-1/2 h-[2px] bg-[#2A2A2A] dark:bg-[#D4D4D4] pointer-events-none"
								style="width: {swipeProgress[item.id]}%; transform: translateY(-50%); transition: width 0.05s linear;"
							></div>
						{/if}
						
						<span
							class="block relative {item.done
								? 'text-[#6B6B6B] dark:text-[#9A9A9A] line-through'
								: 'text-[#2A2A2A] dark:text-[#F5F0E6]'}"
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
		background: #9A9A9A;
		border-radius: 4px;
	}

	textarea::-webkit-scrollbar-thumb:hover {
		background: #6B6B6B;
	}

	/* Override native focus ring (e.g., Safari blue outline) */
	textarea:focus,
	textarea:focus-visible {
		outline: none;
		border-color: rgba(180, 170, 150, 0.5);
		box-shadow: 0 0 0 3px rgba(180, 170, 150, 0.5);
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
			background: #6B6B6B;
		}

		textarea::-webkit-scrollbar-thumb:hover {
			background: #9A9A9A;
		}
	}
</style>
