import {
	defineConfig,
	minimal2023Preset,
} from "@vite-pwa/assets-generator/config";

/**
 * Gera os ícones do PWA a partir de `public/favicon.svg` (iniciais do tenant
 * na cor primária). Rode `pnpm icones` depois de trocar o SVG; os PNGs gerados
 * ficam versionados em `public/`.
 */
export default defineConfig({
	headLinkOptions: { preset: "2023" },
	preset: {
		...minimal2023Preset,
		maskable: {
			...minimal2023Preset.maskable,
			resizeOptions: { background: "#23378b" },
		},
		apple: {
			...minimal2023Preset.apple,
			resizeOptions: { background: "#23378b" },
		},
	},
	images: ["public/favicon.svg"],
});
