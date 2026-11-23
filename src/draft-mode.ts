import { createHmac, timingSafeEqual } from "node:crypto";

// Set once the Presentation tool proves a request came from the Studio, and
// signed with the read token so it can't be forged.
export const DRAFT_MODE_COOKIE = "sanity-draft-mode";
export const DRAFT_MODE_MAX_AGE = 60 * 60;

function sign(token: string, value: string) {
	return createHmac("sha256", token).update(value).digest("base64url");
}

export function createDraftModeValue(token: string, now = Date.now()) {
	const expires = String(now + DRAFT_MODE_MAX_AGE * 1000);

	return `${expires}.${sign(token, expires)}`;
}

export function verifyDraftModeValue(
	token: string,
	value: string | undefined,
	now = Date.now(),
) {
	const [expires, signature] = value?.split(".") ?? [];
	if (!expires || !signature || !(Number(expires) > now)) return false;

	const expected = Buffer.from(sign(token, expires));
	const actual = Buffer.from(signature);

	return actual.length === expected.length && timingSafeEqual(actual, expected);
}
