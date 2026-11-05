import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";
import { TENANT_PADRAO } from "./src/config/tenant/tenant-padrao.ts";
import { corHslParaHex, lerCorHsl } from "./src/shared/domain/tema.ts";

const corPrimaria = lerCorHsl(TENANT_PADRAO.visual.primaryColorHsl);
const corTema = corPrimaria ? corHslParaHex(corPrimaria) : "#23378b";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		{
			name: "cor-tema-html",
			transformIndexHtml: (html) => html.replaceAll("%COR_TEMA%", corTema),
		},
		// PWA (TODO 2.10.1): o app inteiro fica no precache e abre sem internet
		// depois do primeiro acesso. `prompt`: a versão nova espera o usuário
		// tocar em "Atualizar" (ver `AvisoNovaVersao`), para não recarregar a
		// tela no meio de um orçamento.
		VitePWA({
			registerType: "prompt",
			injectRegister: false,
			includeAssets: [
				"favicon.svg",
				"favicon.ico",
				"apple-touch-icon-180x180.png",
			],
			manifest: {
				id: "/",
				name: TENANT_PADRAO.empresa.nomeFantasia,
				short_name: TENANT_PADRAO.empresa.nomeFantasia,
				description:
					"Orçamentos e pedidos do representante comercial, mesmo sem internet.",
				lang: "pt-BR",
				start_url: "/",
				scope: "/",
				display: "standalone",
				theme_color: corTema,
				background_color: "#ffffff",
				icons: [
					{ src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
					{ src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
					{ src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
					{
						src: "maskable-icon-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			workbox: {
				globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
				// O gerador de PDF (`@react-pdf/renderer`) passa do limite padrão de 2 MiB.
				maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
				navigateFallback: "/index.html",
				cleanupOutdatedCaches: true,
			},
		}),
	],
	test: {
		environment: "node",
		setupFiles: ["./vitest.setup.ts"],
	},
});
