import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import awsAmplify from "astro-aws-amplify";
import { allowFramingIn, moveDeploymentBundle } from "./amplify";

export interface Options {
	/**
	 * Whether this is the preview build. Defaults to `SANITY_PREVIEW` being
	 * `"true"`.
	 */
	enabled?: boolean;
	/**
	 * The Studio that stega-encoded strings link to, and that may frame the
	 * preview. Defaults to `https://<SANITY_STUDIO_HOST>.sanity.studio`.
	 */
	studioUrl?: string;
	/**
	 * Origins allowed to frame the preview on Amplify. Defaults to the Studio's
	 * origin and sanity.io's dashboard, which hosted Studios run inside.
	 */
	frameAncestors?: string[];
}

const NAME = "@destination/astro-sanity-preview";
const CONFIG_MODULE = `virtual:${NAME}/config`;

/** Whether this is the preview build, for leaving out integrations that need a static one. */
export function isPreviewBuild() {
	return process.env.SANITY_PREVIEW === "true";
}

export default function sanityPreview(options: Options = {}): AstroIntegration {
	const enabled = options.enabled ?? isPreviewBuild();
	const studioUrl =
		options.studioUrl ??
		(process.env.SANITY_STUDIO_HOST
			? `https://${process.env.SANITY_STUDIO_HOST}.sanity.studio`
			: undefined);
	const frameAncestors = options.frameAncestors ?? [
		...(studioUrl ? [new URL(studioUrl).origin] : []),
		"https://www.sanity.io",
	];

	return {
		name: NAME,
		hooks: {
			"astro:config:setup": ({ updateConfig, injectRoute, addMiddleware }) => {
				updateConfig({
					vite: {
						plugins: [
							{
								name: CONFIG_MODULE,
								resolveId: (id) =>
									id === CONFIG_MODULE ? `\0${CONFIG_MODULE}` : undefined,
								load: (id) =>
									id === `\0${CONFIG_MODULE}`
										? `export const studioUrl = ${JSON.stringify(studioUrl)};`
										: undefined,
							},
						],
						// The package imports virtual modules, so Vite has to bundle it.
						// The preview build bundles everything: Amplify's compute bundle
						// has no node_modules.
						environments: {
							ssr: { resolve: { noExternal: enabled ? true : [NAME] } },
							prerender: { resolve: { noExternal: [NAME] } },
						},
					},
				});

				if (!enabled) return;

				const adapter = amplifyAdapter();
				// Astro runs the hooks of integrations added here too, in order, so
				// the bundle is moved after the adapter has written it.
				updateConfig({
					output: "server",
					adapter,
					integrations: [adapter, amplifyBuild(frameAncestors)],
				});

				for (const action of ["enable", "disable"]) {
					injectRoute({
						pattern: `/api/draft-mode/${action}`,
						entrypoint: new URL(`./routes/${action}.mjs`, import.meta.url),
						prerender: false,
					});
				}

				addMiddleware({
					entrypoint: new URL("./middleware.mjs", import.meta.url),
					order: "pre",
				});
			},
		},
	};
}

/**
 * astro-aws-amplify, with its server entrypoint resolved from this package: a
 * site with pnpm's isolated node_modules can't resolve it by name, as it's this
 * package's dependency rather than the site's.
 */
function amplifyAdapter(): AstroIntegration {
	const adapter = awsAmplify({
		runtime: "nodejs24.x",
		// Amplify gives build environment variables to the build only.
		runtimeEnv: ["SANITY_API_READ_TOKEN"],
	});
	const configDone = adapter.hooks["astro:config:done"];
	const serverEntrypoint = fileURLToPath(
		import.meta.resolve("astro-aws-amplify/server"),
	);

	return {
		...adapter,
		hooks: {
			...adapter.hooks,
			"astro:config:done": (params) =>
				configDone?.({
					...params,
					setAdapter: (options) =>
						params.setAdapter({ ...options, serverEntrypoint }),
				}),
		},
	};
}

function amplifyBuild(frameAncestors: string[]): AstroIntegration {
	let root = "";
	let outDir = "";

	return {
		name: `${NAME}/amplify`,
		hooks: {
			"astro:config:done": ({ config }) => {
				root = fileURLToPath(config.root);
				outDir = fileURLToPath(config.outDir);
			},
			"astro:build:done": async ({ logger }) => {
				await moveDeploymentBundle(`${root}.amplify-hosting`, outDir);
				logger.info(`Moved the Amplify deployment bundle to ${outDir}`);

				// Amplify applies customHttp.yml after the build. Only edit it there,
				// as it's a tracked file.
				if (process.env.AWS_APP_ID) {
					const file = await allowFramingIn(root, frameAncestors);
					if (file) {
						logger.info(
							`Allowed ${frameAncestors.join(", ")} to frame the site in ${file}`,
						);
					}
				}
			},
		},
	};
}
