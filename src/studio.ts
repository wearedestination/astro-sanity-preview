import {
	type PresentationPluginOptions,
	presentationTool,
} from "sanity/presentation";

/**
 * The Presentation tool, pointed at the preview build at `origin`, as a list
 * to spread into a Studio's plugins. Empty when `origin` isn't set, so a site
 * without previews gets no Presentation tool.
 */
export function previewTool(
	origin: string | undefined,
	options: Omit<PresentationPluginOptions, "previewUrl"> = {},
) {
	if (!origin) return [];

	return [
		presentationTool({
			...options,
			previewUrl: {
				origin,
				previewMode: {
					enable: "/api/draft-mode/enable",
					disable: "/api/draft-mode/disable",
				},
			},
		}),
	];
}
