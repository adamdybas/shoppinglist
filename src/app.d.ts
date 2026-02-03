declare global {
	namespace App {}
}

declare namespace svelteHTML {
	interface HTMLAttributes {
		autocorrect?: 'on' | 'off';
	}
}

export {};
