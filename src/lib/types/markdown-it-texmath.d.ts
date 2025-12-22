declare module 'markdown-it-texmath' {
	import type { PluginWithOptions } from 'markdown-it';

	interface TexmathOptions {
		engine?: {
			renderToString?: (latex: string, options?: object) => string;
			render?: (latex: string, element: HTMLElement, options?: object) => void;
		};
		delimiters?: 'dollars' | 'brackets' | 'gitlab' | 'julia' | 'kramdown';
		katexOptions?: object;
	}

	const texmath: PluginWithOptions<TexmathOptions>;
	export default texmath;
}
