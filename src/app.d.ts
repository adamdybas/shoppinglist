declare global {
	namespace App {}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare namespace svelteHTML {
	interface HTMLAttributes {
		autocorrect?: 'on' | 'off';
	}
}

export {};
