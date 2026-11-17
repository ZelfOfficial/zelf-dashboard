import { apiErrorTextAndCode, isBiometricApiError } from "app/core/i18n/api-error-codes";

/** Shown for a missing account and for wrong credentials. Same text either way. */
export const SIGN_IN_GENERIC_ERROR_KEY = "errors.could_not_sign_in";

/** Shown when the API will not accept the capture that was just taken. */
export const SIGN_IN_RECAPTURE_KEY = "errors.sign_in_capture_face_again";

export interface SignInCredentials {
	email?: string;
	countryCode?: string;
	phone?: string;
	faceBase64: string;
	masterPassword?: string;
	identificationMethod?: string;
}

export interface StaffSignInCredentials {
	email: string;
	faceBase64: string;
	masterPassword: string;
}

export interface SignInApi {
	signIn(credentials: SignInCredentials): Promise<unknown>;
	signInStaff(credentials: StaffSignInCredentials): Promise<unknown>;
}

export type SignInOutcome =
	| { kind: "success"; response: unknown }
	| { kind: "biometric"; error: unknown }
	| { kind: "recapture"; error: unknown }
	| { kind: "generic"; error: unknown }
	| { kind: "other"; error: unknown };

const LOOKUP_MARKERS = [
	"client_not_found",
	"client not found",
	"staff_not_found",
	"staff not found",
	"account_doesnt_contain_zelf_proof",
	"account_not_found",
	"invalid_account",
];

const CREDENTIAL_MARKERS = [
	"error_decrypting",
	"decrypting_zelf_account",
	"verification_failed",
	"invalid_password",
	"password is invalid",
	"provided password is invalid",
	"err_invalid_password",
];

function errorBlob(error: unknown): { text: string; code: string; status?: number } {
	const { text, code } = apiErrorTextAndCode(error);
	const status = (error as { status?: unknown })?.status;
	return {
		text: text || "",
		code: code || "",
		status: typeof status === "number" ? status : undefined,
	};
}

function markerBlob(error: unknown): string {
	const { text, code } = errorBlob(error);
	return `${text} ${code}`.toLowerCase();
}

/**
 * Client auth answers 404 `client_not_found` when no client (or staff-indexed) record
 * matches, and 409 `account_doesnt_contain_zelf_proof` when the record cannot be signed into.
 * Those are the cases that should try `POST /api/staff/auth`.
 */
export function isSignInAccountLookupFailure(error: unknown): boolean {
	const { status } = errorBlob(error);
	if (status === 404) return true;
	const blob = markerBlob(error);
	return LOOKUP_MARKERS.some((marker) => blob.includes(marker));
}

/** Wrong password or a failed decrypt. Same user-facing message as a missing account. */
export function isSignInCredentialFailure(error: unknown): boolean {
	const blob = markerBlob(error);
	return CREDENTIAL_MARKERS.some((marker) => blob.includes(marker));
}

/**
 * Replay is stored only after a face request succeeds (HTTP < 400). A not-found
 * client auth therefore leaves the capture reusable. This matches the rejection
 * when the API will not accept that reuse.
 */
export function isFaceReplayError(error: unknown): boolean {
	const blob = markerBlob(error);
	return blob.includes("face_replay") || blob.includes("face replay");
}

function hasEmail(credentials: SignInCredentials): credentials is SignInCredentials & { email: string } {
	return typeof credentials.email === "string" && credentials.email.trim().length > 0;
}

function classifyTerminal(error: unknown): SignInOutcome {
	if (isFaceReplayError(error)) return { kind: "recapture", error };
	if (isBiometricApiError(error)) return { kind: "biometric", error };
	if (isSignInAccountLookupFailure(error) || isSignInCredentialFailure(error)) return { kind: "generic", error };
	return { kind: "other", error };
}

/**
 * Always tries client auth first. `POST /api/clients/auth` already returns a staff
 * token when the stored JSON has `accountType` `staff`. A not-found or invalid-account
 * failure retries `POST /api/staff/auth` with the same face and password when an email
 * is present. Staff auth requires an email, so a phone-only attempt stops after client auth.
 */
export async function attemptDashboardSignIn(credentials: SignInCredentials, api: SignInApi): Promise<SignInOutcome> {
	try {
		const response = await api.signIn(credentials);
		return { kind: "success", response };
	} catch (error) {
		if (isFaceReplayError(error)) return { kind: "recapture", error };
		if (isBiometricApiError(error)) return { kind: "biometric", error };

		const canTryStaff = isSignInAccountLookupFailure(error) && hasEmail(credentials) && !!credentials.faceBase64;
		if (!canTryStaff) return classifyTerminal(error);

		try {
			const response = await api.signInStaff({
				email: credentials.email.trim(),
				faceBase64: credentials.faceBase64,
				masterPassword: credentials.masterPassword || "",
			});
			return { kind: "success", response };
		} catch (staffError) {
			return classifyTerminal(staffError);
		}
	}
}

export function signInOutcomeMessageKey(outcome: SignInOutcome): string | null {
	if (outcome.kind === "generic") return SIGN_IN_GENERIC_ERROR_KEY;
	if (outcome.kind === "recapture") return SIGN_IN_RECAPTURE_KEY;
	return null;
}
