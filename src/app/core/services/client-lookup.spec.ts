import { clientLookupHeaders } from "./client-lookup";

describe("GET /api/clients session header", () => {
	it("sends the session JWT as a bearer token", () => {
		const headers = clientLookupHeaders("session-jwt");
		expect(headers.get("Authorization")).toBe("Bearer session-jwt");
	});

	it("does not invent an authorization header when there is no session", () => {
		expect(clientLookupHeaders(null).has("Authorization")).toBeFalse();
		expect(clientLookupHeaders("").has("Authorization")).toBeFalse();
		expect(clientLookupHeaders(undefined).has("Authorization")).toBeFalse();
	});
});
