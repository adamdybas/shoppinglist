<script lang="ts">
	import { onMount, tick } from 'svelte';
	import ArchiveStatusMessage from '$lib/components/ArchiveStatusMessage.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ListInput from '$lib/components/ListInput.svelte';
	import ShoppingListItem from '$lib/components/ShoppingListItem.svelte';
	import {
		getAllItems,
		addItem,
		toggleItemDone,
		archiveCurrentList,
		getArchivedList,
		clearAllItems,
		type ShoppingItem
	} from '$lib/db';
	import { parseItemsFromInput, resolveItemAction, shareList, scanPhoto } from '$lib/list';
	import { transition, checkAllDone, type AppState, type AppEvent } from '$lib/stateMachine';
	import { getSwipeProgress, type SwipeStart } from '$lib/swipe';

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
	let textareaElement = $state<HTMLTextAreaElement>();
	let swipeStart: SwipeStart = { x: 0, y: 0 };
	let currentSwipeId: string | null = null;
	let swipeProgress = $state<Record<string, number>>({});
	let isScrolled = $state(false);
	let isScanning = $state(false);
	let scanError = $state('');
	let scanStatus = $state(''); // screen-reader-only progress/result announcement
	let showScanConsent = $state(false);
	let pendingScanFile: File | null = null;
	let scanButton = $state<HTMLButtonElement>();
	let hideDone = $state(
		typeof localStorage !== 'undefined' && localStorage.getItem('hideDone') === 'true'
	);

	let hasDoneItems = $derived(
		appState.type === 'ACTIVE' && appState.items.some((i: ShoppingItem) => i.done)
	);

	let shouldCollapseDone = $derived(hideDone && appState.type === 'ACTIVE');

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
	}

	async function restoreArchivedList() {
		hideDone = false;
		localStorage.setItem('hideDone', 'false');

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
		const action = resolveItemAction(items, itemText);

		if (action.kind === 'add') {
			const newItem = await addItem(itemText);
			dispatch({ type: 'ITEM_ADDED', item: newItem });
		} else if (action.kind === 'uncheck') {
			await toggleItemDone(action.id);
			dispatch({ type: 'ITEM_TOGGLED', id: action.id });
		}
	}

	async function submitItems() {
		if (!inputText.trim()) return;

		const itemsToAdd = parseItemsFromInput(inputText);
		for (const itemText of itemsToAdd) {
			await addOrReactivateItem(itemText);
		}

		inputText = '';
		await tick(); // let the cleared value flush before measuring height
		autoGrow();
	}

	async function handleKeydown(event: KeyboardEvent) {
		// Skip if IME is composing (autocomplete, Chinese/Japanese input, etc.)
		if (event.isComposing) return;

		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			await submitItems();
		}
	}

	function handleFormSubmit(e: SubmitEvent) {
		e.preventDefault();
		void submitItems();
	}

	// In ALL_DONE, adding must archive the old list first or ITEM_ADDED is ignored.
	async function ensureArchivedIfAllDone() {
		if (appState.type !== 'ALL_DONE') return;
		const preserved = inputText;
		await archiveAndClear();
		dispatch({ type: 'START_TYPING' });
		inputText = preserved;
	}

	function handleScan(file: File) {
		if (isScanning) return;

		// First use: ask consent before sending the photo to a third party.
		if (typeof localStorage !== 'undefined' && localStorage.getItem('scanConsent') !== 'true') {
			pendingScanFile = file;
			showScanConsent = true;
			return;
		}

		void runScan(file);
	}

	function confirmScanConsent() {
		showScanConsent = false;
		if (typeof localStorage !== 'undefined') localStorage.setItem('scanConsent', 'true');
		const file = pendingScanFile;
		pendingScanFile = null;
		if (file) void runScan(file);
	}

	async function cancelScanConsent() {
		showScanConsent = false;
		pendingScanFile = null;
		// Return focus to the trigger once the background is no longer inert.
		await tick();
		scanButton?.focus();
	}

	async function runScan(file: File) {
		isScanning = true;
		scanError = '';
		scanStatus = 'Scanning photo…';

		try {
			const detected = await scanPhoto(file);

			if (detected.length === 0) {
				scanStatus = '';
				scanError = "Couldn't read any items from that photo.";
				return;
			}

			scanStatus = `Found ${detected.length} item${detected.length === 1 ? '' : 's'} — review and add.`;

			// Archive first; if it throws we bail before populating the input.
			await ensureArchivedIfAllDone();

			// Fill the input for review rather than adding directly.
			const joined = detected.join(', ');
			inputText = inputText.trim() ? `${inputText.trim()}, ${joined}` : joined;

			await tick();
			autoGrow();
			if (textareaElement) {
				textareaElement.focus();
				const end = textareaElement.value.length;
				textareaElement.setSelectionRange(end, end);
			}
		} catch (err) {
			scanStatus = '';
			scanError = err instanceof Error ? err.message : 'Could not read the photo.';
		} finally {
			isScanning = false;
		}
	}

	async function handleInput() {
		autoGrow();

		if (scanError) scanError = '';

		if (inputText.length > 0) {
			await ensureArchivedIfAllDone();
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
		swipeStart = { x: touch.clientX, y: touch.clientY };
		currentSwipeId = itemId;
	}

	async function handleTouchMove(event: TouchEvent, itemId: string) {
		if (currentSwipeId !== itemId) return;

		const touch = event.touches[0];
		const element = event.currentTarget as HTMLElement;
		const swipe = getSwipeProgress(
			swipeStart,
			{ x: touch.clientX, y: touch.clientY },
			element.offsetWidth
		);

		if (swipe.cancelled) {
			currentSwipeId = null;
			swipeProgress = { ...swipeProgress, [itemId]: 0 };
			return;
		}

		swipeProgress = { ...swipeProgress, [itemId]: swipe.progress };

		if (swipe.thresholdReached) {
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
</script>

<svelte:head>
	<title>Shopping List</title>
	<meta name="description" content="A simple and powerful shopping list app" />
	<meta name="color-scheme" content="light dark" />
</svelte:head>

<!-- inert while the dialog is open: drops the background from focus/pointer/a11y -->
<div class="min-h-screen bg-white p-4 dark:bg-[#0F0F0F]" inert={showScanConsent}>
	<div class="mx-auto max-w-2xl">
		<!-- Header -->
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-3xl font-semibold text-[#2A2A2A] dark:text-[#D4D4D4]">Shopping List</h1>
			<button
				onclick={() => void shareList(items, hideDone)}
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
		<ListInput
			bind:inputText
			bind:textareaElement
			bind:scanButton
			{isScrolled}
			{hasDoneItems}
			{hideDone}
			{isScanning}
			onInput={handleInput}
			onKeydown={handleKeydown}
			onPaste={handlePaste}
			onSubmit={handleFormSubmit}
			onScan={handleScan}
			onToggleHideDone={() => {
				hideDone = !hideDone;
				localStorage.setItem('hideDone', String(hideDone));
			}}
		/>

		{#if scanError}
			<p class="mb-2 text-sm text-red-600 dark:text-red-400" role="alert">{scanError}</p>
		{/if}

		<!-- Screen-reader-only: announces scan progress and the result count -->
		<p class="sr-only" role="status" aria-live="polite">{scanStatus}</p>

		<!-- Messages -->
		<ArchiveStatusMessage stateType={appState.type} onRestoreArchivedList={restoreArchivedList} />

		<!-- Shopping List -->
		<div
			class="transition-opacity duration-200 {appState.type === 'ARCHIVED_AVAILABLE'
				? 'opacity-0'
				: 'opacity-100'}"
		>
			{#if displayItems.length > 0}
				{#each displayItems as item (item.id)}
					<ShoppingListItem
						{item}
						collapsed={shouldCollapseDone && item.done}
						swipeProgress={swipeProgress[item.id] ?? 0}
						onToggle={handleCheckboxChange}
						onTouchStart={handleTouchStart}
						onTouchMove={handleTouchMove}
						onTouchEnd={handleTouchEnd}
					/>
				{/each}
			{/if}
		</div>
	</div>
</div>

<ConfirmDialog
	open={showScanConsent}
	title="Scan with AI?"
	message="This photo will be sent to an AI service to read your list. You'll review the extracted items before anything is added."
	confirmLabel="Continue"
	cancelLabel="Cancel"
	onConfirm={confirmScanConsent}
	onCancel={cancelScanConsent}
/>

<style>
	@media (prefers-color-scheme: dark) {
		:global(body) {
			background-color: #0f0f0f;
		}
	}
</style>
