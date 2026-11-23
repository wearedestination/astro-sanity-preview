import { describe, expect, test } from "vitest";
import {
	createDraftModeValue,
	DRAFT_MODE_MAX_AGE,
	verifyDraftModeValue,
} from "../src/draft-mode";

describe("the draft mode cookie", () => {
	const now = Date.UTC(2026, 0, 1);
	const value = createDraftModeValue("token", now);

	test("verifies with the token it was signed with", () => {
		expect(verifyDraftModeValue("token", value, now)).toBe(true);
	});

	test("expires", () => {
		const later = now + DRAFT_MODE_MAX_AGE * 1000;
		expect(verifyDraftModeValue("token", value, later)).toBe(false);
	});

	test("doesn't verify with another token", () => {
		expect(verifyDraftModeValue("other", value, now)).toBe(false);
	});

	test("can't have its expiry changed", () => {
		const [, signature] = value.split(".");
		const extended = `${now + 10 * DRAFT_MODE_MAX_AGE * 1000}.${signature}`;
		expect(verifyDraftModeValue("token", extended, now)).toBe(false);
	});

	test("doesn't verify when missing or malformed", () => {
		for (const bad of [undefined, "", "1", "x.y", `${value}x`]) {
			expect(verifyDraftModeValue("token", bad, now)).toBe(false);
		}
	});
});
