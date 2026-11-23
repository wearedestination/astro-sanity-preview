import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

// Astro imports a site's config, and so this package, with plain Node rather
// than Vite, which doesn't load TypeScript from node_modules.
test("loads in Node without a bundler", () => {
	const { status, stderr } = spawnSync(
		process.execPath,
		[
			"--input-type=module",
			"--eval",
			`const { default: sanityPreview } = await import("${new URL("../dist/index.mjs", import.meta.url)}");
			sanityPreview({ enabled: true });`,
		],
		{ encoding: "utf8" },
	);

	expect(stderr).toBe("");
	expect(status).toBe(0);
});
