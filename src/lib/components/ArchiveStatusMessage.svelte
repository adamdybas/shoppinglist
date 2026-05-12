<script lang="ts">
	import type { AppState } from '$lib/stateMachine';

	let {
		stateType,
		onRestoreArchivedList
	}: {
		stateType: AppState['type'];
		onRestoreArchivedList: () => void | Promise<void>;
	} = $props();
</script>

{#if stateType === 'ALL_DONE' || stateType === 'ARCHIVED_AVAILABLE'}
	<div class="relative mb-4 min-h-[32px]">
		<div
			class="absolute top-0 left-0 transition-opacity duration-200 {stateType === 'ALL_DONE'
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
			class="absolute top-0 left-0 transition-opacity duration-200 {stateType ===
			'ARCHIVED_AVAILABLE'
				? 'opacity-100'
				: 'pointer-events-none opacity-0'}"
		>
			<span class="inline-block rounded bg-[#E8F0FF] px-2 py-1 dark:bg-[#1E2A3D]">
				<button
					onclick={() => void onRestoreArchivedList()}
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
