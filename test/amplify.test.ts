import { describe, expect, test } from "vitest";
import { allowFraming } from "../src/amplify";

const origins = ["https://site.sanity.studio", "https://www.sanity.io"];

describe("allowFraming", () => {
	test("adds the origins to frame-ancestors and removes X-Frame-Options", () => {
		const customHttp = `applications:
  - appRoot: apps/web
    customHeaders:
      - pattern: '**/*'
        headers:
          - key: X-Content-Type-Options
            value: nosniff
          - key: X-Frame-Options
            value: SAMEORIGIN
          - key: Content-Security-Policy
            value: "frame-ancestors 'self'"
`;

		expect(allowFraming(customHttp, origins)).toBe(`applications:
  - appRoot: apps/web
    customHeaders:
      - pattern: '**/*'
        headers:
          - key: X-Content-Type-Options
            value: nosniff
          - key: Content-Security-Policy
            value: "frame-ancestors 'self' https://site.sanity.studio https://www.sanity.io"
`);
	});

	test("keeps the policy's other directives", () => {
		expect(
			allowFraming(
				`value: "default-src 'self'; frame-ancestors 'none'; img-src *"`,
				origins,
			),
		).toBe(
			`value: "default-src 'self'; frame-ancestors https://site.sanity.studio https://www.sanity.io; img-src *"`,
		);
	});

	test("leaves headers without framing rules alone", () => {
		const customHttp = "- key: X-Content-Type-Options\n  value: nosniff\n";
		expect(allowFraming(customHttp, origins)).toBe(customHttp);
	});
});
