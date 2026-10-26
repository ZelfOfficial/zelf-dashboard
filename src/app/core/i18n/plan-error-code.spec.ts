import { canonicalPlanErrorCode, knownPlanQuoteError, planErrorCodeIncludes } from "./plan-error-code";

describe("plan error codes", () => {
	it("canonicalizes legacy snake_case and already-uppercase codes to the same key", () => {
		expect(canonicalPlanErrorCode("plan_downgrade_not_allowed")).toBe("PLAN_DOWNGRADE_NOT_ALLOWED");
		expect(canonicalPlanErrorCode("PLAN_DOWNGRADE_NOT_ALLOWED")).toBe("PLAN_DOWNGRADE_NOT_ALLOWED");
		expect(canonicalPlanErrorCode("  lifetime_already_owned  ")).toBe("LIFETIME_ALREADY_OWNED");
		expect(canonicalPlanErrorCode("coupon_invalid")).toBe("COUPON_INVALID");
		expect(canonicalPlanErrorCode("QUOTE_EXPIRING")).toBe("QUOTE_EXPIRING");
		expect(canonicalPlanErrorCode("token_expired")).toBe("TOKEN_EXPIRED");
		expect(canonicalPlanErrorCode("upgrade_term_changed")).toBe("UPGRADE_TERM_CHANGED");
		expect(canonicalPlanErrorCode("ALREADY_LIFETIME")).toBe("ALREADY_LIFETIME");
	});

	it("matches either case inside a longer API message", () => {
		expect(planErrorCodeIncludes("plan_not_offered_for_name", "PLAN_NOT_OFFERED_FOR_NAME")).toBeTrue();
		expect(planErrorCodeIncludes("PLAN_NOT_OFFERED_FOR_NAME", "plan_not_offered_for_name")).toBeTrue();
		expect(planErrorCodeIncludes("409:plan_duration_not_offered_by_license", "PLAN_DURATION_NOT_OFFERED_BY_LICENSE")).toBeTrue();
		expect(planErrorCodeIncludes("409:PLAN_DURATION_NOT_OFFERED_BY_LICENSE", "plan_duration_not_offered_by_license")).toBeTrue();
		expect(planErrorCodeIncludes("tag_not_found", "PLAN_NOT_OFFERED_FOR_NAME")).toBeFalse();
		expect(planErrorCodeIncludes("", "PLAN_NOT_OFFERED_FOR_NAME")).toBeFalse();
	});

	it("returns the uppercase quote-error key for both API generations", () => {
		expect(knownPlanQuoteError("plan_downgrade_not_allowed")).toBe("PLAN_DOWNGRADE_NOT_ALLOWED");
		expect(knownPlanQuoteError("LIFETIME_ALREADY_OWNED")).toBe("LIFETIME_ALREADY_OWNED");
		expect(knownPlanQuoteError("plan_not_offered_for_name")).toBe("PLAN_NOT_OFFERED_FOR_NAME");
		expect(knownPlanQuoteError("PLAN_DURATION_NOT_OFFERED_BY_LICENSE")).toBe("PLAN_DURATION_NOT_OFFERED_BY_LICENSE");
		expect(knownPlanQuoteError("409:plan_downgrade_not_allowed")).toBe("PLAN_DOWNGRADE_NOT_ALLOWED");
		expect(knownPlanQuoteError("quote_failed")).toBeNull();
		expect(knownPlanQuoteError("COUPON_INVALID")).toBeNull();
	});
});
