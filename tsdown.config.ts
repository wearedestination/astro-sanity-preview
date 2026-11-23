import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		client: "src/client.ts",
		studio: "src/studio.ts",
		middleware: "src/middleware.ts",
		"routes/enable": "src/routes/enable.ts",
		"routes/disable": "src/routes/disable.ts",
		"visual-editing": "src/visual-editing.ts",
	},
	deps: {
		// Provided by Astro, @sanity/astro and this integration's Vite plugin.
		neverBundle: [/^astro:/, /^sanity:/, /^virtual:/],
		// It ships TypeScript, which Node won't load from node_modules when Astro
		// imports the site's config. Its server entrypoint is left to Vite.
		alwaysBundle: [/^astro-aws-amplify$/],
	},
	dts: true,
});
