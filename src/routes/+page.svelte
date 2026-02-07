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

	let appState = $state<AppState>({ type: 'LOADING' });
	let displayItems = $state<ShoppingItem[]>([]);
	let listFadeTimeout: ReturnType<typeof setTimeout> | null = null;

	function dispatch(event: AppEvent) {
		appState = transition(appState, event);
	}

	let items = $derived(
		appState.type === 'ACTIVE' || appState.type === 'ALL_DONE' ? appState.items : []
	);

	let inputText = $state('');
	let textareaElement: HTMLTextAreaElement;
	let touchStartX = 0;
	let touchStartY = 0;
	let currentSwipeId: string | null = null;
	let swipeProgress = $state<Record<string, number>>({});
	let addedItemsSet = $state(new Set<string>());
	let isScrolled = $state(false);
	let hideDone = $state(false);

	let hasDoneItems = $derived(
		appState.type === 'ACTIVE' && appState.items.some((i: ShoppingItem) => i.done)
	);

	let shouldCollapseDone = $derived(
		hideDone && appState.type === 'ACTIVE'
	);

	$effect(() => {
		if (listFadeTimeout) {
			clearTimeout(listFadeTimeout);
			listFadeTimeout = null;
		}

		if (appState.type === 'ACTIVE' || appState.type === 'ALL_DONE') {
			displayItems = appState.items;
		} else if (appState.type === 'ARCHIVED_AVAILABLE') {
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
		(async () => {
			const loadedItems = await getAllItems();
			loadedItems.forEach((item: ShoppingItem) => addedItemsSet.add(item.text.toLowerCase()));

			const archived = await getArchivedList();
			const hasArchive = archived !== null;

			dispatch({ type: 'LOADED', items: loadedItems, hasArchive });
		})();

		const handleScroll = () => {
			const wasScrolled = isScrolled;
			isScrolled = window.scrollY > 20;

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
		if (appState.type === 'ACTIVE' && checkAllDone(appState.items)) {
			inputText = '';
			dispatch({ type: 'ALL_CHECKED' });
		}
	}

	async function archiveAndClear() {
		if (appState.type !== 'ALL_DONE') return;

		const plainItems = JSON.parse(JSON.stringify(appState.items));
		await archiveCurrentList(plainItems);
		await clearAllItems();
		addedItemsSet.clear();
	}

	async function restoreArchivedList() {
		hideDone = false;

		if (textareaElement) {
			textareaElement.focus();
		}
		
		const archived = await getArchivedList();
		if (!archived) return;

		const restoredItems: ShoppingItem[] = [];

		for (const item of archived.items) {
			const restoredItem = await addItem(item.text);

			if (item.done) {
				await toggleItemDone(restoredItem.id);
			}

			restoredItems.push({ ...restoredItem, done: item.done });
			addedItemsSet.add(item.text.toLowerCase());
		}

		dispatch({ type: 'RESTORE_ARCHIVE', items: restoredItems });
	}

	function autoGrow() {
		if (!textareaElement) return;
		textareaElement.style.height = 'auto';

		const maxHeight = isScrolled ? 80 : window.innerHeight * 0.5;
		const newHeight = Math.min(textareaElement.scrollHeight, maxHeight);
		textareaElement.style.height = newHeight + 'px';
	}

	async function addOrReactivateItem(itemText: string) {
		const lowerText = itemText.toLowerCase();
		
		if (addedItemsSet.has(lowerText)) {
			const existingItem = items.find(
				(i: ShoppingItem) => i.text.toLowerCase() === lowerText
			);
			
			if (existingItem && existingItem.done) {
				await toggleItemDone(existingItem.id);
				dispatch({ type: 'ITEM_TOGGLED', id: existingItem.id });
			}
		} else {
			const newItem = await addItem(itemText);
			dispatch({ type: 'ITEM_ADDED', item: newItem });
			addedItemsSet.add(lowerText);
		}
	}

	async function handleKeydown(event: KeyboardEvent) {
		// Skip if IME is composing (autocomplete, Chinese/Japanese input, etc.)
		if (event.isComposing) return;

		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();

			if (inputText.trim()) {
				const itemsToAdd = inputText
					.split(/[,\.]\s+/)
					.map((s) => s.trim())
					.filter((s) => s.length > 0);

				for (const itemText of itemsToAdd) {
					await addOrReactivateItem(itemText);
				}

				inputText = '';
				autoGrow();
			}
		}
	}

	function handleFormSubmit(e: SubmitEvent) {
		e.preventDefault();

		if (inputText.trim()) {
			const itemsToAdd = inputText
				.split(/[,\.]\s+/)
				.map((s) => s.trim())
				.filter((s) => s.length > 0);

			(async () => {
				for (const itemText of itemsToAdd) {
					await addOrReactivateItem(itemText);
				}

				inputText = '';
				autoGrow();
			})();
		}
	}

	async function handleInput() {
		autoGrow();

		if (inputText.length > 0 && appState.type === 'ALL_DONE') {
			const typedText = inputText;
			await archiveAndClear();
			dispatch({ type: 'START_TYPING' });
			inputText = typedText;
		}
	}

	function handlePaste() {
		setTimeout(() => autoGrow(), 10);
	}

	async function handleCheckboxChange(id: string) {
		await toggleItemDone(id);
		dispatch({ type: 'ITEM_TOGGLED', id });
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

		if (Math.abs(deltaY) > Math.abs(deltaX)) {
			currentSwipeId = null;
			swipeProgress = { ...swipeProgress, [itemId]: 0 };
			return;
		}

		const element = event.currentTarget as HTMLElement;
		const elementWidth = element.offsetWidth;

		const swipePercentage = Math.max(0, (deltaX / elementWidth) * 100);

		swipeProgress = { ...swipeProgress, [itemId]: Math.min(swipePercentage, 100) };

		if (swipePercentage >= 20) {
			const item = items.find((i: ShoppingItem) => i.id === itemId);
			if (item && !item.done) {
				await toggleItemDone(itemId);
				dispatch({ type: 'ITEM_TOGGLED', id: itemId });
				checkAndDispatchAllDone();
			}
			currentSwipeId = null;
			swipeProgress = { ...swipeProgress, [itemId]: 0 };
		}
	}

	function handleTouchEnd() {
		if (currentSwipeId) {
			swipeProgress = { ...swipeProgress, [currentSwipeId]: 0 };
		}
		currentSwipeId = null;
	}

	async function shareList() {
		const listText = items.map((item: ShoppingItem) => item.text).join(', ');

		const shareData = {
			text: listText
		};

		try {
			if (navigator.share) {
				await navigator.share(shareData);
			} else {
				await navigator.clipboard.writeText(listText);
				alert('List copied to clipboard!');
			}
		} catch (err) {
			console.error('Error sharing:', err);
		}
	}
</script>

<svelte:head>
	<title>Shopping List</title>
	<meta name="description" content="A simple and powerful shopping list app" />
	<meta name="color-scheme" content="light dark" />
</svelte:head>

<div class="min-h-screen bg-white p-4 dark:bg-[#0F0F0F]">
	<div class="mx-auto max-w-2xl">
		<!-- Header -->
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-3xl font-semibold text-[#2A2A2A] dark:text-[#D4D4D4]">Shopping List</h1>
			<button
				onclick={shareList}
				class="p-2 text-[#6B6B6B] transition-colors hover:text-[#2A2A2A] dark:text-[#9A9A9A] dark:hover:text-[#D4D4D4] {items.length >
				0
					? ''
					: 'pointer-events-none opacity-0'}"
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

		<!-- Input -->
		<div class="sticky top-0 z-10 mb-2 bg-white dark:bg-[#0F0F0F] {isScrolled ? 'py-2' : 'py-0'}">
			<form onsubmit={handleFormSubmit}>
				<textarea
					bind:this={textareaElement}
					bind:value={inputText}
					oninput={handleInput}
					onkeydown={handleKeydown}
					onpaste={handlePaste}
					placeholder="Type items ..."
					class="w-full resize-none rounded-lg border border-[#B8B1A3] bg-white px-4 py-3 text-[#2A2A2A] placeholder-[#6B6B6B] transition-all focus:border-[rgba(180,170,150,0.5)] focus:shadow-[0_0_0_3px_rgba(180,170,150,0.5)] focus:outline-none focus-visible:outline-none dark:border-[#6E6A63] dark:bg-[#1a1a1a] dark:text-[#D4D4D4] dark:placeholder-[#9A9A9A] dark:focus:border-[rgba(180,170,150,0.5)] dark:focus:shadow-[0_0_0_3px_rgba(180,170,150,0.5)] {isScrolled
						? 'overflow-y-auto'
						: 'overflow-hidden'}"
					rows="1"
					style="min-height: 60px; font-size: 24px; line-height: 1.4;"
					autocorrect="off"
					autocapitalize="off"
					spellcheck="false"
				></textarea>
				<button type="submit" class="hidden" tabindex="-1" aria-hidden="true">Submit</button>
			</form>
			<div class="hide-toggle-row {hasDoneItems ? 'hide-toggle-visible' : 'hide-toggle-hidden'}">
				<div class="flex justify-end pt-1">
					<button
						onclick={() => (hideDone = !hideDone)}
						tabindex={hasDoneItems ? 0 : -1}
						class="text-sm text-[#6B6B6B] transition-colors hover:text-[#2A2A2A] dark:text-[#9A9A9A] dark:hover:text-[#D4D4D4]"
					>
						{hideDone ? 'Show' : 'Hide'} what's done
					</button>
				</div>
			</div>
		</div>

		<!-- Messages -->
		{#if appState.type === 'ALL_DONE' || appState.type === 'ARCHIVED_AVAILABLE'}
			<div class="relative mb-4 min-h-[32px]">
				<div
					class="absolute top-0 left-0 transition-opacity duration-200 {appState.type === 'ALL_DONE'
						? 'opacity-100'
						: 'pointer-events-none opacity-0'}"
				>
					<span
						class="inline-block rounded bg-[#FFF4C2] px-2 py-1 text-base text-[#5A4A00] dark:bg-[#3A3420] dark:text-[#F3E6A1]"
					>
						— all done —
					</span>
				</div>
				<div
					class="absolute top-0 left-0 transition-opacity duration-200 {appState.type ===
					'ARCHIVED_AVAILABLE'
						? 'opacity-100'
						: 'pointer-events-none opacity-0'}"
				>
					<span class="inline-block rounded bg-[#E8F0FF] px-2 py-1 dark:bg-[#1E2A3D]">
						<button
							onclick={restoreArchivedList}
							tabindex="-1"
							class="text-[#243A5E] underline transition-opacity hover:opacity-80 dark:text-[#C7D7FF]"
						>
							Old list is still here.
						</button>
						<span class="text-[#243A5E] dark:text-[#C7D7FF]"> Type to start a new one.</span>
					</span>
				</div>
			</div>
		{/if}

		<!-- Shopping List -->
		<div
			class="transition-opacity duration-200 {appState.type === 'ARCHIVED_AVAILABLE'
				? 'opacity-0'
				: 'opacity-100'}"
		>
		{#if displayItems.length > 0}
			{#each displayItems as item (item.id)}
					<div
						transition:fade={{ duration: 530 }}
						class="item-row relative cursor-pointer px-1 {shouldCollapseDone && item.done ? 'item-collapsed' : 'item-expanded'}"
						role="button"
						tabindex={shouldCollapseDone && item.done ? -1 : 0}
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
						<input
							type="checkbox"
							checked={item.done}
							class="sr-only"
							tabindex="-1"
							aria-hidden="true"
						/>

						{#if swipeProgress[item.id] > 0 && !item.done}
							<div
								class="pointer-events-none absolute top-1/2 left-1 h-[2px] bg-[#2A2A2A] dark:bg-[#D4D4D4]"
								style="width: {swipeProgress[
									item.id
								]}%; transform: translateY(-50%); transition: width 0.05s linear;"
							></div>
						{/if}

						<span
							class="relative block {item.done
								? 'text-[#6B6B6B] line-through dark:text-[#9A9A9A]'
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
	.hide-toggle-row {
		overflow: hidden;
		transition: max-height 0.3s ease, opacity 0.25s ease;
	}

	.hide-toggle-visible {
		max-height: 40px;
		opacity: 1;
	}

	.hide-toggle-hidden {
		max-height: 0;
		opacity: 0;
		pointer-events: none;
	}

	.item-row {
		transition: max-height 0.35s ease, opacity 0.3s ease, padding 0.35s ease;
		overflow: hidden;
	}

	.item-expanded {
		max-height: 120px;
		opacity: 1;
		padding-top: 0.75rem;
		padding-bottom: 0.75rem;
	}

	.item-collapsed {
		max-height: 0;
		opacity: 0;
		padding-top: 0;
		padding-bottom: 0;
		pointer-events: none;
	}

	textarea::-webkit-scrollbar {
		width: 8px;
	}

	textarea::-webkit-scrollbar-track {
		background: #f1f1f1;
		border-radius: 4px;
	}

	textarea::-webkit-scrollbar-thumb {
		background: #9a9a9a;
		border-radius: 4px;
	}

	textarea::-webkit-scrollbar-thumb:hover {
		background: #6b6b6b;
	}

	textarea:focus,
	textarea:focus-visible {
		outline: none;
		border-color: rgba(180, 170, 150, 0.5);
		box-shadow: 0 0 0 3px rgba(180, 170, 150, 0.5);
	}

	@media (prefers-color-scheme: dark) {
		:global(body) {
			background-color: #0f0f0f;
		}

		textarea::-webkit-scrollbar-track {
			background: #2a2a2a;
		}

		textarea::-webkit-scrollbar-thumb {
			background: #6b6b6b;
		}

		textarea::-webkit-scrollbar-thumb:hover {
			background: #9a9a9a;
		}
	}
</style>
