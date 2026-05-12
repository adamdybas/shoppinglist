<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { ShoppingItem } from '$lib/db';

	let {
		item,
		collapsed = false,
		swipeProgress = 0,
		onToggle,
		onTouchStart,
		onTouchMove,
		onTouchEnd
	}: {
		item: ShoppingItem;
		collapsed?: boolean;
		swipeProgress?: number;
		onToggle: (id: string) => void | Promise<void>;
		onTouchStart: (event: TouchEvent, id: string) => void;
		onTouchMove: (event: TouchEvent, id: string) => void | Promise<void>;
		onTouchEnd: () => void;
	} = $props();
</script>

<div
	transition:fade={{ duration: 530 }}
	class="item-row relative cursor-pointer px-1 {collapsed ? 'item-collapsed' : 'item-expanded'}"
	role="checkbox"
	aria-checked={item.done}
	aria-label={item.done ? `Mark ${item.text} as not done` : `Mark ${item.text} as done`}
	aria-hidden={collapsed}
	tabindex={collapsed ? -1 : 0}
	ontouchstart={(event) => onTouchStart(event, item.id)}
	ontouchmove={(event) => void onTouchMove(event, item.id)}
	ontouchend={onTouchEnd}
	onclick={() => void onToggle(item.id)}
	onkeydown={(event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			void onToggle(item.id);
		}
	}}
>
	{#if swipeProgress > 0 && !item.done}
		<div
			class="pointer-events-none absolute top-1/2 left-1 h-[2px] bg-[#2A2A2A] dark:bg-[#D4D4D4]"
			style="width: {swipeProgress}%; transform: translateY(-50%); transition: width 0.05s linear;"
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

<style>
	.item-row {
		transition:
			max-height 0.35s ease,
			opacity 0.3s ease,
			padding 0.35s ease;
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
</style>
