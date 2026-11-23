# Astro Sanity Preview

Astro integration that serves Sanity draft previews to the Studio's
[Presentation tool](https://www.sanity.io/docs/visual-editing/configuring-the-presentation-tool), from a server build
of an otherwise static site hosted on AWS Amplify.

The site builds twice from the same branch. The live site is static, and the integration does nothing to it. The
preview build, with `SANITY_PREVIEW=true`, renders every page on request and shows drafts, but only to the Studio:

- The Studio writes a short-lived secret to the dataset and opens `/api/draft-mode/enable` with it. The site checks
  the secret with a read token and sets a signed draft-mode cookie.
- Pages are only served with that cookie. Anyone else gets a 401, so a site that isn't public yet stays private.
- In draft mode, pages read drafts and stega-encode strings, and the Presentation tool's overlays link each one to its
  field.

Amplify sets server rendering per app, not per branch, so the preview build needs a second Amplify app on the
`WEB_COMPUTE` platform, building the same branch with the variables under [Environment](#environment). Point the
Studio's Presentation tool at that app's URL (see [Studio](#studio)).

## Installation

```console
npm install @destination/astro-sanity-preview
```

It needs [`@sanity/astro`](https://github.com/sanity-io/sanity-astro) configured, as it reads drafts through
`sanity:client`.

## Usage

```js
// astro.config.mjs
import purgeCss from "@destination/astro-purge-css";
import sanityPreview, { isPreviewBuild } from "@destination/astro-sanity-preview";
import sanity from "@sanity/astro";
import { defineConfig } from "astro/config";

export default defineConfig({
	output: "static",
	integrations: [
		sanity({ projectId: "abc123de", dataset: "production", useCdn: false, apiVersion: "2026-09-21" }),
		sanityPreview(),
		// Integrations that need a static build, such as astro-purge-css, stay out of the preview build.
		!isPreviewBuild() && purgeCss(),
	],
});
```

Fetch content with `getClient(Astro)`, which returns `sanity:client` in the static build and for anyone outside
draft mode:

```astro
---
import { getClient } from "@destination/astro-sanity-preview/client";

const page = await getClient(Astro).fetch(PAGE_QUERY, { slug: Astro.params.slug });
---
```

Render `VisualEditing` once in the layout. It loads the overlays in draft mode, and renders nothing otherwise:

```astro
---
import VisualEditing from "@destination/astro-sanity-preview/VisualEditing.astro";
---

<body>
	<slot />
	<VisualEditing />
</body>
```

In draft mode, strings carry invisible stega encoding. Pass anything that ends up in `<head>`, an attribute, a URL or
a CSS value through `stegaClean` from `@sanity/client/stega`.

A page that looks content up from `Astro.params` should return a 404 when it finds nothing, since the preview build
renders it for any path rather than only the paths `getStaticPaths` returns.

### Options

| Option           | Default                                       | Description                                                                                              |
|------------------|-----------------------------------------------|----------------------------------------------------------------------------------------------------------|
| `enabled`        | `SANITY_PREVIEW === "true"`                   | Whether this is the preview build.                                                                       |
| `studioUrl`      | `https://<SANITY_STUDIO_HOST>.sanity.studio` | The Studio that stega-encoded strings link to. Without one, strings aren't encoded.                      |
| `frameAncestors` | The Studio's origin and `https://www.sanity.io` | Origins allowed to frame the preview on Amplify. Hosted Studios run inside a frame on sanity.io.      |

### Environment

| Variable                | Where                         | Description                                                                         |
|-------------------------|-------------------------------|-------------------------------------------------------------------------------------|
| `SANITY_PREVIEW`        | The preview app's build       | `true` for the preview build.                                                       |
| `SANITY_API_READ_TOKEN` | The preview app's build       | A viewer token, which reads drafts and the Studio's preview secrets.                 |
| `SANITY_STUDIO_HOST`    | `.env`                        | The hosted Studio's name, for `studioUrl`'s default.                                |

## Studio

Add the Presentation tool with `previewTool`, which points it at the preview build and its draft-mode routes. It's
empty without an origin, so a site without previews gets no Presentation tool:

```ts
// sanity.config.ts
import { previewTool } from "@destination/astro-sanity-preview/studio";
import { defineDocuments } from "sanity/presentation";

export default defineConfig({
	plugins: [
		structureTool(),
		...previewTool(process.env.SANITY_STUDIO_PREVIEW_URL, {
			resolve: {
				mainDocuments: defineDocuments([
					{ route: "/", filter: `_type == "page" && slug.current == "/"` },
					{ route: "/:slug+", filter: `_type == "page" && slug.current == $slug` },
				]),
			},
		}),
	],
});
```

## Amplify

The preview build uses [astro-aws-amplify](https://github.com/alexnguyennz/astro-aws-amplify), which the integration
adds itself. To fit a build spec written for the static build:

- **The deployment bundle is moved to `outDir`.** Amplify reads `deploy-manifest.json` from the build spec's
  `baseDirectory`, and Amplify uses the repository's `amplify.yml` over the app's own build spec, so both apps share
  one `baseDirectory`.
- **Dependencies are bundled into the server build.** Amplify's compute bundle has no `node_modules`.
- **The Studio is let in to frame the preview.** Amplify applies `customHttp.yml` after the build, and its headers
  override the site's own. On Amplify, the build adds `frameAncestors` to any `frame-ancestors` directive in the
  nearest `customHttp.yml` and removes `X-Frame-Options`. It only edits the file on Amplify, as it's a tracked file.
- **The read token reaches the server.** Amplify gives build environment variables to the build only, so the
  adapter writes `SANITY_API_READ_TOKEN` into the server bundle's `.env`.

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for development and release steps.

## License

MIT
