import { attemptDashboardSignIn, signInOutcomeMessageKey, SIGN_IN_GENERIC_ERROR_KEY } from "./sign-in-flow";

const face = "captured-face-base64";
const password = "master-secret";

const clientCredentials = {
	email: "person@example.com",
	masterPassword: password,
	faceBase64: face,
	identificationMethod: "email",
};

const clientSuccess = {
	data: {
		token: "client-token",
		zelfProof: "proof",
		zelfAccount: { publicData: { accountType: "client_account", accountEmail: "person@example.com" } },
	},
};

const staffSuccess = {
	data: {
		token: "staff-token",
		zelfProof: "staff-proof",
		staffAccount: { publicData: { accountType: "staff_account", staffEmail: "person@example.com" } },
	},
};

function httpError(status: number, message: string, code: string): { status: number; error: { message: string; code: string } } {
	return { status, error: { message, code } };
}

describe("dashboard sign-in flow", () => {
	it("completes when client auth succeeds and does not call staff auth", async () => {
		const signIn = jasmine.createSpy("signIn").and.resolveTo(clientSuccess);
		const signInStaff = jasmine.createSpy("signInStaff");

		const outcome = await attemptDashboardSignIn(clientCredentials, { signIn, signInStaff });

		expect(outcome.kind).toBe("success");
		if (outcome.kind === "success") expect(outcome.response).toBe(clientSuccess);
		expect(signIn).toHaveBeenCalledOnceWith(clientCredentials);
		expect(signInStaff).not.toHaveBeenCalled();
	});

	it("reuses the same face and password on staff auth when the client account is missing", async () => {
		const signIn = jasmine.createSpy("signIn").and.rejectWith(httpError(404, "client_not_found", "NotFound"));
		const signInStaff = jasmine.createSpy("signInStaff").and.resolveTo(staffSuccess);

		const outcome = await attemptDashboardSignIn(clientCredentials, { signIn, signInStaff });

		expect(outcome.kind).toBe("success");
		if (outcome.kind === "success") expect(outcome.response).toBe(staffSuccess);
		expect(signInStaff).toHaveBeenCalledOnceWith({
			email: "person@example.com",
			faceBase64: face,
			masterPassword: password,
		});
	});

	it("falls back to staff auth for an invalid account record", async () => {
		const signIn = jasmine
			.createSpy("signIn")
			.and.rejectWith(httpError(409, "account_doesnt_contain_zelf_proof", "Conflict"));
		const signInStaff = jasmine.createSpy("signInStaff").and.resolveTo(staffSuccess);

		const outcome = await attemptDashboardSignIn(clientCredentials, { signIn, signInStaff });

		expect(outcome.kind).toBe("success");
		expect(signInStaff).toHaveBeenCalledTimes(1);
	});

	it("uses one generic outcome for a missing account and for wrong credentials", async () => {
		const missingClient = jasmine.createSpy("signIn").and.rejectWith(httpError(404, "client_not_found", "NotFound"));
		const missingStaff = jasmine.createSpy("signInStaff").and.rejectWith(httpError(404, "staff_not_found", "NotFound"));
		const wrongPassword = jasmine
			.createSpy("signIn")
			.and.rejectWith(httpError(409, "THE PROVIDED PASSWORD IS INVALID", "Conflict"));
		const staffAfterPassword = jasmine.createSpy("signInStaff");

		const missing = await attemptDashboardSignIn(clientCredentials, { signIn: missingClient, signInStaff: missingStaff });
		const rejected = await attemptDashboardSignIn(clientCredentials, { signIn: wrongPassword, signInStaff: staffAfterPassword });

		expect(missing.kind).toBe("generic");
		expect(rejected.kind).toBe("generic");
		expect(signInOutcomeMessageKey(missing)).toBe(SIGN_IN_GENERIC_ERROR_KEY);
		expect(signInOutcomeMessageKey(rejected)).toBe(signInOutcomeMessageKey(missing));
		expect(staffAfterPassword).not.toHaveBeenCalled();
		expect(SIGN_IN_GENERIC_ERROR_KEY).not.toContain("client_not_found");
		expect(SIGN_IN_GENERIC_ERROR_KEY).not.toContain("password");
	});

	it("does not ask for the face again when staff auth accepts the same capture", async () => {
		const signIn = jasmine.createSpy("signIn").and.rejectWith(httpError(404, "client_not_found", "NotFound"));
		const signInStaff = jasmine.createSpy("signInStaff").and.resolveTo(staffSuccess);

		const outcome = await attemptDashboardSignIn(clientCredentials, { signIn, signInStaff });

		expect(outcome.kind).not.toBe("recapture");
		expect(signInStaff.calls.mostRecent().args[0].faceBase64).toBe(face);
	});

	it("asks for a new capture when the API rejects reuse of the face", async () => {
		const signIn = jasmine.createSpy("signIn").and.rejectWith(httpError(404, "client_not_found", "NotFound"));
		const signInStaff = jasmine.createSpy("signInStaff").and.rejectWith(httpError(409, "Face replay detected", "face_replay_detected"));

		const outcome = await attemptDashboardSignIn(clientCredentials, { signIn, signInStaff });

		expect(outcome.kind).toBe("recapture");
		expect(signInOutcomeMessageKey(outcome)).toBe("errors.sign_in_capture_face_again");
	});

	it("keeps a face-capture error on the biometric step and does not try staff auth", async () => {
		const signIn = jasmine.createSpy("signIn").and.rejectWith(httpError(400, "LIVENESS_FAILED", "ERR_LIVENESS_FAILED"));
		const signInStaff = jasmine.createSpy("signInStaff");

		const outcome = await attemptDashboardSignIn(clientCredentials, { signIn, signInStaff });

		expect(outcome.kind).toBe("biometric");
		expect(signInStaff).not.toHaveBeenCalled();
	});

	it("does not call staff auth for a phone-only attempt", async () => {
		const signIn = jasmine.createSpy("signIn").and.rejectWith(httpError(404, "client_not_found", "NotFound"));
		const signInStaff = jasmine.createSpy("signInStaff");

		const outcome = await attemptDashboardSignIn(
			{ phone: "5550102030", countryCode: "+1", masterPassword: password, faceBase64: face, identificationMethod: "phone" },
			{ signIn, signInStaff }
		);

		expect(outcome.kind).toBe("generic");
		expect(signInStaff).not.toHaveBeenCalled();
	});
});
