<script lang="ts">
	let {
		open,
		title,
		message,
		confirmLabel = 'OK',
		cancelLabel = 'Cancel',
		onConfirm,
		onCancel
	}: {
		open: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();

	let confirmButton = $state<HTMLButtonElement>();

	// Move focus onto the dialog when it opens so Enter/Escape work right away.
	$effect(() => {
		if (open) confirmButton?.focus();
	});

	function handleKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') onCancel();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			class="absolute inset-0 bg-black/50"
			aria-label={cancelLabel}
			tabindex="-1"
			onclick={onCancel}
		></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="confirm-title"
			class="relative w-full max-w-sm rounded-2xl border border-[#B8B1A3] bg-white p-5 shadow-xl dark:border-[#6E6A63] dark:bg-[#1a1a1a]"
		>
			<h2 id="confirm-title" class="text-lg font-semibold text-[#2A2A2A] dark:text-[#D4D4D4]">
				{title}
			</h2>
			<p class="mt-2 text-sm leading-relaxed text-[#6B6B6B] dark:text-[#9A9A9A]">
				{message}
			</p>
			<div class="mt-5 flex justify-end gap-2">
				<button
					type="button"
					onclick={onCancel}
					class="rounded-lg px-4 py-2 text-sm font-medium text-[#6B6B6B] transition-colors hover:bg-[#F0EDE6] hover:text-[#2A2A2A] dark:text-[#9A9A9A] dark:hover:bg-[#2A2A2A] dark:hover:text-[#D4D4D4]"
				>
					{cancelLabel}
				</button>
				<button
					bind:this={confirmButton}
					type="button"
					onclick={onConfirm}
					class="rounded-lg bg-[#2A2A2A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(180,170,150,0.8)] dark:bg-[#D4D4D4] dark:text-[#0F0F0F] dark:hover:bg-white"
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
