import { validatePreviewUrl } from "@sanity/preview-url-secret";
import type { APIRoute } from "astro";
import { enableDraftMode, hasReadToken, previewClient } from "../client";

// The Presentation tool opens this with a short-lived secret it has written to
// the dataset, which only a client with the read token can look up.
export const GET: APIRoute = async ({ request, cookies, redirect }) => {
	if (!hasReadToken()) {
		return new Response("SANITY_API_READ_TOKEN isn't set", { status: 503 });
	}

	const { isValid, redirectTo = "/" } = await validatePreviewUrl(
		previewClient(),
		request.url,
	);

	if (!isValid) {
		return new Response("Invalid preview secret", { status: 401 });
	}

	enableDraftMode(cookies);

	return redirect(redirectTo, 307);
};
