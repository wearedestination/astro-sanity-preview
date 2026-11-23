import type { MiddlewareHandler } from "astro";
import { isDraftMode } from "./client";

// The preview build is only for the Studio's Presentation tool, which opens
// /api/draft-mode/enable before any page. Everyone else gets a 401, as the
// site may not be public yet. Whatever it serves stays out of caches and
// search results.
export const onRequest: MiddlewareHandler = async (context, next) => {
	if (context.isPrerendered) return next();

	const response =
		context.url.pathname.startsWith("/api/draft-mode/") || isDraftMode(context)
			? await next()
			: new Response("Open this preview from the Sanity Studio.", {
					status: 401,
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});

	response.headers.set("Cache-Control", "private, no-store");
	response.headers.set("X-Robots-Tag", "noindex");

	return response;
};
