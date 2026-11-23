import { sanityClient } from "sanity:client";
import { studioUrl } from "virtual:@destination/astro-sanity-preview/config";
import type { SanityClient } from "@sanity/client";
import type { AstroCookies } from "astro";
import {
	createDraftModeValue,
	DRAFT_MODE_COOKIE,
	DRAFT_MODE_MAX_AGE,
	verifyDraftModeValue,
} from "./draft-mode";

/** What these functions need from `Astro` or an endpoint's context. */
export interface RequestContext {
	isPrerendered: boolean;
	cookies: AstroCookies;
}

// Read on each request: on Amplify, the adapter loads it into the server's
// environment at startup.
function readToken() {
	return process.env.SANITY_API_READ_TOKEN;
}

// The Studio shows the preview in a cross-site frame, where only a
// SameSite=None cookie is sent, and Safari and Firefox only keep one that's
// partitioned.
const cookieOptions = {
	path: "/",
	secure: true,
	sameSite: "none",
	partitioned: true,
} as const;

/** Whether the request came from the Studio's Presentation tool. Always false for a prerendered page. */
export function isDraftMode({ isPrerendered, cookies }: RequestContext) {
	const token = readToken();
	if (isPrerendered || !token) return false;

	return verifyDraftModeValue(token, cookies.get(DRAFT_MODE_COOKIE)?.value);
}

/** A client for drafts, authenticated with the read token. */
export function previewClient(): SanityClient {
	return sanityClient.withConfig({
		token: readToken(),
		perspective: "drafts",
		useCdn: false,
	});
}

/**
 * The client for a page: in draft mode, one for drafts that stega-encodes
 * strings so the Presentation tool can link them to their fields, and
 * otherwise `sanity:client`'s published content.
 */
export function getClient(context: RequestContext): SanityClient {
	if (!isDraftMode(context)) return sanityClient;

	return previewClient().withConfig({
		stega: { enabled: Boolean(studioUrl), studioUrl },
	});
}

export function hasReadToken() {
	return Boolean(readToken());
}

export function enableDraftMode(cookies: AstroCookies) {
	const token = readToken();
	if (!token) throw new Error("SANITY_API_READ_TOKEN isn't set");

	cookies.set(DRAFT_MODE_COOKIE, createDraftModeValue(token), {
		...cookieOptions,
		httpOnly: true,
		maxAge: DRAFT_MODE_MAX_AGE,
	});
}

export function disableDraftMode(cookies: AstroCookies) {
	cookies.delete(DRAFT_MODE_COOKIE, cookieOptions);
}
