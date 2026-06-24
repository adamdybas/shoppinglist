<script lang="ts">
	const textareaInputAttributes = {
		autocorrect: 'off',
		autocapitalize: 'off',
		spellcheck: 'false'
	} as const;

	let {
		inputText = $bindable(''),
		textareaElement = $bindable(),
		isScrolled,
		hasDoneItems,
		hideDone,
		isScanning,
		onInput,
		onKeydown,
		onPaste,
		onSubmit,
		onToggleHideDone,
		onScan
	}: {
		inputText?: string;
		textareaElement?: HTMLTextAreaElement;
		isScrolled: boolean;
		hasDoneItems: boolean;
		hideDone: boolean;
		isScanning: boolean;
		onInput: () => void | Promise<void>;
		onKeydown: (event: KeyboardEvent) => void | Promise<void>;
		onPaste: () => void;
		onSubmit: (event: SubmitEvent) => void;
		onToggleHideDone: () => void;
		onScan: (file: File) => void | Promise<void>;
	} = $props();

	let fileInput = $state<HTMLInputElement>();

	function handleFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			// Focus synchronously inside the change gesture so iOS Safari opens the
			// keyboard and keeps it up during the async scan — a focus() after the
			// network call would be ignored as it's outside a user gesture.
			textareaElement?.focus();
			void onScan(file);
		}
		input.value = ''; // allow re-selecting the same file
	}
</script>

<div class="sticky top-0 z-10 mb-2 bg-white dark:bg-[#0F0F0F] {isScrolled ? 'py-2' : 'py-0'}">
	<form onsubmit={onSubmit} class="relative">
		<textarea
			bind:this={textareaElement}
			bind:value={inputText}
			oninput={() => void onInput()}
			onkeydown={(event) => void onKeydown(event)}
			onpaste={onPaste}
			placeholder="Type items ..."
			class="w-full resize-none rounded-lg border border-[#B8B1A3] bg-white py-3 pr-14 pl-4 text-[#2A2A2A] placeholder-[#6B6B6B] transition-all focus:border-[rgba(180,170,150,0.5)] focus:shadow-[0_0_0_3px_rgba(180,170,150,0.5)] focus:outline-none focus-visible:outline-none dark:border-[#6E6A63] dark:bg-[#1a1a1a] dark:text-[#D4D4D4] dark:placeholder-[#9A9A9A] dark:focus:border-[rgba(180,170,150,0.5)] dark:focus:shadow-[0_0_0_3px_rgba(180,170,150,0.5)] {isScrolled
				? 'overflow-y-auto'
				: 'overflow-hidden'}"
			rows="1"
			style="min-height: 60px; font-size: 24px; line-height: 1.4;"
			{...textareaInputAttributes}
		></textarea>
		<input
			bind:this={fileInput}
			onchange={handleFileChange}
			type="file"
			accept="image/*"
			class="hidden"
			tabindex="-1"
			aria-hidden="true"
		/>
		<button
			type="button"
			onclick={() => fileInput?.click()}
			disabled={isScanning}
			class="absolute top-3 right-3 p-1 text-[#6B6B6B] transition-colors hover:text-[#2A2A2A] disabled:cursor-not-allowed dark:text-[#9A9A9A] dark:hover:text-[#D4D4D4]"
			aria-label="Scan a photo of a list (sends the image to an AI service to read it)"
			title="Scan a photo of a list — sends the image to an AI service to read it"
		>
			{#if isScanning}
				<svg
					class="animate-spin"
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
					<path d="M21 12a9 9 0 1 1-6.219-8.56" />
				</svg>
			{:else}
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
					<path
						d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"
					/>
					<circle cx="12" cy="13" r="3" />
				</svg>
			{/if}
		</button>
		<button type="submit" class="hidden" tabindex="-1" aria-hidden="true">Submit</button>
	</form>
	<div class="hide-toggle-row {hasDoneItems ? 'hide-toggle-visible' : 'hide-toggle-hidden'}">
		<div class="flex justify-end pt-1">
			<button
				onclick={onToggleHideDone}
				tabindex={hasDoneItems ? 0 : -1}
				class="text-sm text-[#6B6B6B] transition-colors hover:text-[#2A2A2A] dark:text-[#9A9A9A] dark:hover:text-[#D4D4D4]"
			>
				{hideDone ? 'Show' : 'Hide'} what's done
			</button>
		</div>
	</div>
</div>

<style>
	.hide-toggle-row {
		overflow: hidden;
		transition:
			max-height 0.3s ease,
			opacity 0.25s ease;
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
