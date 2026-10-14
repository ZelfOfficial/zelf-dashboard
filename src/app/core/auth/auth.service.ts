import { ApiKeyVault, AuthStorage } from "app/core/auth/auth-storage";
import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { AuthUtils } from "app/core/auth/auth.utils";
import { UserService } from "app/core/user/user.service";
import { HttpWrapperService } from "app/http-wrapper.service";
import { catchError, Observable, of, switchMap, throwError } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class AuthService {
	private _authenticated: boolean = false;
	private _httpClient = inject(HttpClient);
	private _userService = inject(UserService);
	private _httpWrapper = inject(HttpWrapperService);

	// -----------------------------------------------------------------------------------------------------
	// @ Accessors
	// -----------------------------------------------------------------------------------------------------

	/**
	 * Setter & getter for access token
	 */
	set accessToken(token: string) {
		AuthStorage.setItem("accessToken", token);
	}

	get accessToken(): string {
		return AuthStorage.getItem("accessToken") ?? "";
	}

	/**
	 * Get if user is staff
	 */
	get isStaff(): boolean {
		const token = this.accessToken;

		if (!token) return false;

		try {
			const payload = AuthUtils.decodeToken(token);
			return payload?.accountType === "staff" || payload?.accountType === "staff_account";
		} catch (e) {
			return false;
		}
	}

	/**
	 * Get owner email (for context)
	 */
	get ownerEmail(): string {
		const token = this.accessToken;
		if (!token) return "";
		try {
			const payload = AuthUtils.decodeToken(token);
			return payload?.ownerEmail || payload?.email || "";
		} catch (e) {
			return "";
		}
	}

	/**
	 * Get user role
	 */
	get role(): string {
		const token = this.accessToken;
		if (!token) return "read";
		try {
			const payload = AuthUtils.decodeToken(token);
			const isStaff = payload?.accountType === "staff" || payload?.accountType === "staff_account";
			if (!isStaff) return "admin";
			return payload?.role || "read";
		} catch (e) {
			return "read";
		}
	}

	/**
	 * Get user account type
	 */
	get accountType(): string {
		const token = this.accessToken;
		if (!token) return "";
		try {
			const payload = AuthUtils.decodeToken(token);
			return payload?.accountType || "";
		} catch (e) {
			return "";
		}
	}

	/**
	 * Getter for zelfProof
	 */
	get zelfProof(): string {
		return AuthStorage.getItem("zelfProof") ?? "";
	}

	/**
	 * Getter for zelfAccount
	 */
	get zelfAccount(): any {
		const account = AuthStorage.getItem("zelfAccount");
		return account ? JSON.parse(account) : null;
	}

	/**
	 * Getter for wallet
	 */
	get wallet(): any {
		const wallet = AuthStorage.getItem("wallet");
		return wallet ? JSON.parse(wallet) : null;
	}

	// -----------------------------------------------------------------------------------------------------
	// @ Public methods
	// -----------------------------------------------------------------------------------------------------

	/**
	 * Sign in
	 *
	 * @param credentials
	 */
	signIn(credentials: {
		email?: string;
		countryCode?: string;
		phone?: string;
		zelfProof: string;
		faceBase64: string;
		masterPassword: string;
		identificationMethod: string;
	}): Promise<any> {
		// Throw error, if the user is already logged in
		if (this._authenticated) {
			return Promise.reject(new Error("User is already logged in."));
		}

		return this._httpWrapper.sendRequest("post", `${environment.apiUrl}${environment.endpoints.auth.signIn}`, credentials);
	}

	/**
	 * Staff sign in (v4): POST /api/staff/auth { email, faceBase64, masterPassword }.
	 * Returns the staff JWT (accountType "staff", role, ownerEmail) that /api/license and staff routes expect.
	 */
	signInStaff(credentials: { email: string; faceBase64: string; masterPassword: string }): Promise<any> {
		return this._httpWrapper.sendRequest("post", `${environment.apiUrl}/api/staff/auth`, credentials);
	}

	/**
	 * Sign out
	 */
	signOut(): Observable<any> {
		// Remove all authentication data from local storage
		AuthStorage.clear();
		ApiKeyVault.clear();
		sessionStorage.removeItem("apiKey");
		AuthStorage.removeItem("accessToken");
		AuthStorage.removeItem("zelfProof");
		AuthStorage.removeItem("zelfAccount");
		localStorage.removeItem("license");
		AuthStorage.removeItem("wallet");

		// Remove session and account-related data
		localStorage.removeItem("sessionToken");
		localStorage.removeItem("subscription");
		localStorage.removeItem("domainNotificationSettings");
		localStorage.removeItem("signedDataPrice");

		// Set the authenticated flag to false
		this._authenticated = false;

		// Return the observable
		return of(true);
	}

	/**
	 * Sign up
	 *
	 * @param user
	 */
	signUp(user: {
		name: string;
		email: string;
		password: string;
		countryCode: string;
		phone: string;
		company: string;
		faceBase64: string;
		masterPassword: string;
	}): Promise<any> {
		return this._httpWrapper.sendRequest("post", `${environment.apiUrl}${environment.endpoints.auth.signUp}`, user);
	}

	/**
	 * Validate staff invitation
	 * @param token
	 */
	validateInvite(token: string): Promise<any> {
		return this._httpWrapper.sendRequest("get", `${environment.apiUrl}/api/staff/validate-invite?token=${token}`);
	}

	/**
	 * Accept staff invitation
	 * @param data
	 */
	acceptInvite(data: { invitationToken: string; masterPassword: string; faceBase64: string }): Promise<any> {
		return this._httpWrapper.sendRequest("post", `${environment.apiUrl}/api/staff/accept-invite`, data);
	}

	/**
	 * Get if user is a lawyer
	 */
	get isLawyer(): boolean {
		const token = this.accessToken;
		if (!token) return false;
		try {
			const payload = AuthUtils.decodeToken(token);
			return payload?.accountType === "lawyer";
		} catch (e) {
			return false;
		}
	}

	/**
	 * Validate lawyer invitation
	 */
	validateLawyerInvite(token: string): Promise<any> {
		return this._httpWrapper.sendRequest("get", `${environment.apiUrl}/api/lawyers/validate-invite?token=${token}`);
	}

	/**
	 * Accept lawyer invitation
	 */
	acceptLawyerInvite(data: { invitationToken: string; masterPassword: string; faceBase64: string }): Promise<any> {
		return this._httpWrapper.sendRequest("post", `${environment.apiUrl}/api/lawyers/accept-invite`, data);
	}


	/**
	 * Check if all required authentication data is present
	 */
	hasValidSession(): boolean {
		return !!(this.accessToken && this.zelfProof && this.zelfAccount);
	}

	/**
	 * Check the authentication status
	 */
	check(): Observable<boolean> {
		// Check if the user is logged in
		if (this._authenticated) {
			return of(true);
		}

		// Check if all required session data is present
		if (!this.hasValidSession()) {
			return of(false);
		}

		// Check the access token expire date
		if (AuthUtils.isTokenExpired(this.accessToken)) {
			return of(false);
		}

		// For our custom auth system, if we have all required data and token is valid, we're authenticated
		// No need to call signInUsingToken since we don't have that endpoint
		this._authenticated = true;
		return of(true);
	}

	setSession(session: { zelfProof: string; zelfAccount: string }): void {
		AuthStorage.setItem("zelfProof", session.zelfProof);

		AuthStorage.setItem("zelfAccount", JSON.stringify(session.zelfAccount));
	}

	setAccessToken(token: string): void {
		AuthStorage.setItem("accessToken", token);
	}

	verifyClientExists(user: { email: string; phone: string }): Observable<any> {
		return this._httpClient.get(`${environment.apiUrl}${environment.endpoints.auth.verifyClientExists}`, { params: user });
	}
}
