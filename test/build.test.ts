import { type ChildProcess, spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sanity from "@sanity/astro";
import { build } from "astro";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createDraftModeValue, DRAFT_MODE_COOKIE } from "../src/draft-mode";
import type builtSanityPreview from "../src/index";

// The built package, as a site installs it. npm test builds it first.
const { default: sanityPreview }: { default: typeof builtSanityPreview } =
	await import(new URL("../dist/index.mjs", import.meta.url).href);

const root = fileURLToPath(new URL("./fixtures/site/", import.meta.url));
const TOKEN = "test-token";

async function buildFixture(name: string, enabled: boolean) {
	const outDir = `${root}dist/${name}/`;
	await build({
		root,
		outDir,
		logLevel: "silent",
		integrations: [
			sanity({
				projectId: "test1234",
				dataset: "production",
				useCdn: false,
				apiVersion: "2026-09-21",
			}),
			sanityPreview({ enabled, studioUrl: "https://fixture.sanity.studio" }),
		],
	});
	return outDir;
}

async function files(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { recursive: true, withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name));
}

function freePort() {
	return new Promise<number>((resolve) => {
		const server = createServer().listen(0, () => {
			const address = server.address();
			server.close(() =>
				resolve(typeof address === "object" && address ? address.port : 0),
			);
		});
	});
}

describe("the static build", async () => {
	const outDir = await buildFixture("static", false);

	test("is prerendered as usual", async () => {
		const html = await readFile(`${outDir}index.html`, "utf8");
		expect(html).toContain("<h1>Fixture</h1>");
		expect(html).not.toContain("<script");
	});

	test("leaves out the visual editing code", async () => {
		expect(await files(outDir)).toEqual([`${outDir}index.html`]);
	});

	test("has no deployment bundle", async () => {
		expect(await files(outDir)).not.toContainEqual(
			expect.stringContaining("deploy-manifest.json"),
		);
	});
});

describe("the preview build", async () => {
	process.env.SANITY_API_READ_TOKEN = TOKEN;
	const outDir = await buildFixture("preview", true).finally(() => {
		delete process.env.SANITY_API_READ_TOKEN;
	});
	const compute = `${outDir}compute/default/`;

	let server: ChildProcess;
	let origin = "";

	beforeAll(async () => {
		const port = await freePort();
		origin = `http://localhost:${port}`;
		server = spawn(process.execPath, ["entry.mjs"], {
			cwd: compute,
			env: { ...process.env, PORT: String(port) },
			stdio: "ignore",
		});
		for (let i = 0; i < 50; i++) {
			if (
				await fetch(origin).then(
					() => true,
					() => false,
				)
			)
				return;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		throw new Error("The preview server didn't start");
	});

	afterAll(() => {
		server?.kill();
	});

	test("puts Amplify's deployment bundle in outDir", async () => {
		const manifest = JSON.parse(
			await readFile(`${outDir}deploy-manifest.json`, "utf8"),
		);
		expect(manifest.computeResources[0]).toMatchObject({
			name: "default",
			runtime: "nodejs24.x",
		});
	});

	test("bundles its dependencies", async () => {
		const imports = new Set<string>();
		for (const file of await files(compute)) {
			if (!file.endsWith(".mjs")) continue;
			const code = await readFile(file, "utf8");
			for (const [, specifier] of code.matchAll(
				/^\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/gm,
			)) {
				imports.add(specifier);
			}
		}
		const bare = [...imports].filter(
			(specifier) => !/^(?:node:|\.{1,2}\/)/.test(specifier),
		);
		expect(bare).toEqual([]);
	});

	test("turns everyone but the Studio away", async () => {
		const response = await fetch(origin);
		expect(response.status).toBe(401);
		expect(response.headers.get("x-robots-tag")).toBe("noindex");
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});

	test("serves pages in draft mode, with the visual editing script", async () => {
		const response = await fetch(origin, {
			headers: {
				Cookie: `${DRAFT_MODE_COOKIE}=${createDraftModeValue(TOKEN)}`,
			},
		});
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("<h1>Fixture</h1>");
		expect(html).toMatch(/<script type="module"/);
	});

	test("refuses a cookie signed with another token", async () => {
		const response = await fetch(origin, {
			headers: {
				Cookie: `${DRAFT_MODE_COOKIE}=${createDraftModeValue("other")}`,
			},
		});
		expect(response.status).toBe(401);
	});

	test("leaves draft mode", async () => {
		const response = await fetch(`${origin}/api/draft-mode/disable`, {
			redirect: "manual",
		});
		expect(response.status).toBe(307);
		const cookie = response.headers.get("set-cookie");
		expect(cookie).toMatch(new RegExp(`^${DRAFT_MODE_COOKIE}=`));
		expect(cookie).toContain("Expires=Thu, 01 Jan 1970");
		// Partitioned like the cookie it replaces, or the browser keeps that one.
		expect(cookie).toContain("Partitioned");
	});
});
