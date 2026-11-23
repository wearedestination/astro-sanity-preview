import { access, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const X_FRAME_OPTIONS =
	/^[ \t]*- key: ["']?X-Frame-Options["']?[ \t]*\r?\n[ \t]*value: .*\r?\n/gim;
const FRAME_ANCESTORS = /frame-ancestors((?:\s+(?:'[^']*'|[^\s;"']+))*)/gi;

/**
 * Lets `origins` frame the site in an Amplify customHttp.yml: adds them to any
 * `frame-ancestors` directive, dropping `'none'`, and removes X-Frame-Options,
 * which can't allow another origin.
 */
export function allowFraming(customHttp: string, origins: string[]) {
	return customHttp
		.replace(X_FRAME_OPTIONS, "")
		.replace(FRAME_ANCESTORS, (_, sources: string) => {
			const kept = sources
				.trim()
				.split(/\s+/)
				.filter((source) => source && source !== "'none'");

			return `frame-ancestors ${[...new Set([...kept, ...origins])].join(" ")}`;
		});
}

async function exists(path: string) {
	return access(path).then(
		() => true,
		() => false,
	);
}

/** The nearest `name` in `dir` or a directory above it. */
export async function findUp(name: string, dir: string) {
	for (let current = dir; ; current = dirname(current)) {
		const path = join(current, name);
		if (await exists(path)) return path;
		if (dirname(current) === current) return undefined;
	}
}

/**
 * Moves the adapter's deployment bundle into `outDir`, where an Amplify build
 * spec's `baseDirectory` points for the static build: Amplify reads
 * `deploy-manifest.json` from there.
 */
export async function moveDeploymentBundle(bundle: string, outDir: string) {
	await rm(outDir, { recursive: true, force: true });
	await rename(bundle, outDir);
}

/** Lets `origins` frame the site in the nearest customHttp.yml, if there is one. */
export async function allowFramingIn(dir: string, origins: string[]) {
	const file = await findUp("customHttp.yml", dir);
	if (!file) return undefined;

	await writeFile(file, allowFraming(await readFile(file, "utf8"), origins));

	return file;
}
