/**
 * Plan-area API error codes (Zelf ID quote, coupon, payment JWT, confirm, upgrade).
 *
 * The API is moving these from snake_case to UPPER_SNAKE_CASE with the
 * same words (zelf-online-version#212). Either form is the same code.
 * The canonical form used for matching and i18n keys is UPPER_SNAKE_CASE.
 */

/** Quote refusals the Zelf ID extend UI translates under `tags.detail.quoteErrors`. */
export const PLAN_QUOTE_ERROR_CODES = [
	"PLAN_DOWNGRADE_NOT_ALLOWED",
	"LIFETIME_ALREADY_OWNED",
	"PLAN_NOT_OFFERED_FOR_NAME",
	"PLAN_DURATION_NOT_OFFERED_BY_LICENSE",
] as const;

/** `plan_downgrade_not_allowed` and `PLAN_DOWNGRADE_NOT_ALLOWED` both become `PLAN_DOWNGRADE_NOT_ALLOWED`. */
export function canonicalPlanErrorCode(value: string | null | undefined): string {
	return String(value ?? "").trim().toUpperCase();
}

/** Case-insensitive containment check. `code` is the canonical (or legacy) plan error code. */
export function planErrorCodeIncludes(value: string | null | undefined, code: string): boolean {
	const needle = canonicalPlanErrorCode(code);
	return needle.length > 0 && canonicalPlanErrorCode(value).includes(needle);
}

/**
 * Known quote refusal as its uppercase translation key, or null when the API
 * sent something else (caller keeps its own fallback, e.g. `quote_failed`).
 */
export function knownPlanQuoteError(value: string | null | undefined): (typeof PLAN_QUOTE_ERROR_CODES)[number] | null {
	const normalized = canonicalPlanErrorCode(value);
	if (!normalized) return null;
	return PLAN_QUOTE_ERROR_CODES.find((code) => normalized.includes(code)) ?? null;
}
