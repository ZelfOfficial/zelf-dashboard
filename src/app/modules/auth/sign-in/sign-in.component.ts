import { AuthStorage } from "app/core/auth/auth-storage";
import { Component, OnInit, ViewChild, ViewEncapsulation, inject } from "@angular/core";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { FormsModule, NgForm, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatRadioModule } from "@angular/material/radio";
import { MatSelectModule } from "@angular/material/select";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { fuseAnimations } from "@fuse/animations";
import { FuseAlertComponent, FuseAlertType } from "@fuse/components/alert";
import { AuthService } from "app/core/auth/auth.service";
import { PasskeyService } from "app/core/services/passkey.service";
import { PasskeyPromptModalComponent } from "../passkey-prompt-modal/passkey-prompt-modal.component";
import { DataBiometricsComponent, BiometricData } from "../biometric-verification/biometric-verification.component";
import { TranslocoService, TranslocoModule } from "@jsverse/transloco";
import { cleanedCountryCodes } from "app/core/cleaned_country_codes";
import { translocoKeyForApiErrorCode } from "app/core/i18n/api-error-codes";
import { attemptDashboardSignIn, SIGN_IN_GENERIC_ERROR_KEY, SIGN_IN_RECAPTURE_KEY } from "./sign-in-flow";

@Component({
	selector: "auth-sign-in",
	templateUrl: "./sign-in.component.html",
	encapsulation: ViewEncapsulation.None,
	animations: fuseAnimations,
	imports: [
		RouterLink,
		FuseAlertComponent,
		FormsModule,
		ReactiveFormsModule,
		MatFormFieldModule,
		MatInputModule,
		MatButtonModule,
		MatIconModule,
		MatCheckboxModule,
		MatProgressSpinnerModule,
		MatRadioModule,
		MatSelectModule,
		DataBiometricsComponent,
		TranslocoModule,
		PasskeyPromptModalComponent,
	],
})
export class AuthSignInComponent implements OnInit {
	@ViewChild("signInNgForm") signInNgForm: NgForm;
	@ViewChild("biometricVerification") biometricVerification: DataBiometricsComponent;

	alert: { type: FuseAlertType; message: string } = {
		type: "success",
		message: "",
	};
	signInForm: UntypedFormGroup;
	showAlert: boolean = false;
	showBiometricVerification: boolean = false;
	showPasskeyLogin: boolean = false;
	showPasskeyPrompt: boolean = false;
	userData: any = {};

	// Language picker
	availableLanguages = [
		{ code: "en", name: "English", flag: "🇺🇸" },
		{ code: "es", name: "Español", flag: "🇪🇸" },
		{ code: "fr", name: "Français", flag: "🇫🇷" },
		{ code: "zh", name: "中文", flag: "🇨🇳" },
		{ code: "ja", name: "日本語", flag: "🇯🇵" },
		{ code: "ko", name: "한국어", flag: "🇰🇷" },
	];
	currentLanguage = "en";

	// Country codes for phone number
	countryCodes = cleanedCountryCodes;

	/**
	 * Constructor
	 */
	private _translocoService = inject(TranslocoService);

	constructor(
		private _activatedRoute: ActivatedRoute,
		private _authService: AuthService,
		private _formBuilder: UntypedFormBuilder,
		private _router: Router,
		private _passkeyService: PasskeyService
	) {}

	// -----------------------------------------------------------------------------------------------------
	// @ Lifecycle hooks
	// -----------------------------------------------------------------------------------------------------

	/**
	 * On init
	 */
	ngOnInit(): void {
		// Create the form
		this.signInForm = this._formBuilder.group({
			identificationMethod: ["email", Validators.required],
			email: ["", [Validators.required, Validators.email]],
			countryCode: ["+1"],
			phone: [""],
			masterPassword: ["", Validators.required],
			rememberMe: [""],
		});

		// Watch for identification method changes to update validation
		this.signInForm.get("identificationMethod")?.valueChanges.subscribe((method) => {
			this.updateValidation(method);
			// Also check passkey when method changes
			setTimeout(() => this.checkPasskey(), 100);
		});

		// Monitor Email changes for Passkey
		this.signInForm
			.get("email")
			?.valueChanges.pipe(debounceTime(300), distinctUntilChanged())
			.subscribe(() => {
				this.checkPasskey();
			});

		// Monitor Phone changes for Passkey
		this.signInForm
			.get("phone")
			?.valueChanges.pipe(debounceTime(300), distinctUntilChanged())
			.subscribe(() => {
				this.checkPasskey();
			});

		// Set initial validation
		this.updateValidation("email");

		// Load saved data from localStorage
		this.loadRememberedData();

		// Initialize current language
		this.currentLanguage = this._translocoService.getActiveLang() || "en";
	}

	/**
	 * Update form validation based on identification method
	 */
	private updateValidation(method: string): void {
		const emailControl = this.signInForm.get("email");
		const countryCodeControl = this.signInForm.get("countryCode");
		const phoneControl = this.signInForm.get("phone");

		if (method === "email") {
			// Email validation
			emailControl?.setValidators([Validators.required, Validators.email]);
			countryCodeControl?.clearValidators();
			phoneControl?.clearValidators();
		} else if (method === "phone") {
			// Phone validation
			emailControl?.clearValidators();
			countryCodeControl?.setValidators([Validators.required]);
			phoneControl?.setValidators([Validators.required, Validators.pattern(/^[0-9]{8,12}$/)]);
		}

		// Update validation status
		emailControl?.updateValueAndValidity();
		countryCodeControl?.updateValueAndValidity();
		phoneControl?.updateValueAndValidity();
	}

	// -----------------------------------------------------------------------------------------------------
	// @ Public methods
	// -----------------------------------------------------------------------------------------------------

	/**
	 * Get current identifier based on method
	 */
	private _getCurrentIdentifier(): string | null {
		const method = this.signInForm.get("identificationMethod")?.value;
		if (method === "email") {
			return this.signInForm.get("email")?.value;
		} else if (method === "phone") {
			const country = this.signInForm.get("countryCode")?.value;
			const phone = this.signInForm.get("phone")?.value;
			if (country && phone) {
				return `${country}${phone}`;
			}
		}
		return null;
	}

	/**
	 * Check if there is a passkey for the entered identifier
	 */
	async checkPasskey(): Promise<void> {
		const identifier = this._getCurrentIdentifier();
		if (identifier) {
			const metadata = await this._passkeyService.getPasskeyMetadata(identifier);
			this.showPasskeyLogin = !!metadata;
		} else {
			this.showPasskeyLogin = false;
		}
	}

	/**
	 * Login with Passkey
	 */
	async loginWithPasskey(): Promise<void> {
		const identifier = this._getCurrentIdentifier();
		if (!identifier) return;

		const metadata = await this._passkeyService.getPasskeyMetadata(identifier);
		if (!metadata) return;

		try {
			// Authenticate and derive key
			const key = await this._passkeyService.authenticate(metadata.credentialId, this._passkeyService.base64ToBuffer(metadata.salt));

			if (key) {
				// Decrypt password
				const password = await this._passkeyService.decryptPassword(metadata.ciphertext, metadata.iv, key);

				// Fill form and submit
				this.signInForm.patchValue({
					masterPassword: password,
					rememberMe: true,
				});
				this.signIn();
			}
		} catch (error) {
			console.error("Passkey login failed:", error);
			this.alert = {
				type: "error",
				message: "Passkey login failed. Please use your password.",
			};
			this.showAlert = true;
		}
	}

	/**
	 * Sign in
	 */
	signIn(): void {
		if (this.signInForm.invalid) return;

		// Save remembered data if checkbox is checked
		this.saveRememberedData();

		// Prepare user data based on identification method
		const formValue = this.signInForm.value;
		const identificationMethod = formValue.identificationMethod;

		if (identificationMethod === "email") {
			this.userData = {
				email: formValue.email,
				masterPassword: formValue.masterPassword,
				identificationMethod: "email",
			};
		} else if (identificationMethod === "phone") {
			this.userData = {
				countryCode: formValue.countryCode,
				phone: formValue.phone,
				masterPassword: formValue.masterPassword,
				identificationMethod: "phone",
			};
		}

		// Capture the face next. Account lookup requires a session, so sign-in posts the
		// captured face and password directly to client auth (with a staff-auth fallback).
		this.showBiometricVerification = true;
		this.showAlert = false;
	}

	/**
	 * Handle successful biometric verification
	 */
	onBiometricSuccess(biometricData: BiometricData): void {
		// Disable the form
		this.signInForm.disable();

		const signInData = {
			...this.userData,
			masterPassword: biometricData.password || this.userData?.masterPassword,
			faceBase64: biometricData.faceBase64,
		};

		attemptDashboardSignIn(signInData, {
			signIn: (credentials) => this._authService.signIn(credentials),
			signInStaff: (credentials) => this._authService.signInStaff(credentials),
		}).then((outcome) => {
			if (outcome.kind === "success") {
				void this._finishSignIn(outcome.response);
				return;
			}

			if (outcome.kind === "biometric") {
				this.signInForm.enable();
				this.biometricVerification?.handleApiError(outcome.error);
				return;
			}

			if (outcome.kind === "recapture") {
				this.signInForm.enable();
				const message = this._translocoService.translate(SIGN_IN_RECAPTURE_KEY);
				this.alert = { type: "error", message };
				this.showAlert = true;
				this.showBiometricVerification = true;
				this.biometricVerification?.handleApiError({ error: { message } });
				return;
			}

			this.signInForm.enable();
			this.signInNgForm.resetForm();
			this.showBiometricVerification = false;
			this.alert = {
				type: "error",
				message:
					outcome.kind === "generic"
						? this._translocoService.translate(SIGN_IN_GENERIC_ERROR_KEY)
						: this.getErrorMessage(outcome.error),
			};
			this.showAlert = true;
		});
	}

	/**
	 * Store the session from either client auth (`zelfAccount`) or staff auth (`staffAccount`).
	 */
	private async _finishSignIn(response: any): Promise<void> {
		const account = response?.data?.zelfAccount || response?.data?.staffAccount;

		if (response?.data?.token && response?.data?.zelfProof && account) {
			this._authService.setSession({
				zelfProof: response.data.zelfProof,
				zelfAccount: account,
			});
			this._authService.setAccessToken(response.data.token);

			if (response.data?.wallet) {
				AuthStorage.setItem("wallet", JSON.stringify(response.data.wallet));
			}

			const identifier = this._getCurrentIdentifier();
			const password = this.signInForm.get("masterPassword")?.value;

			if (identifier && password) {
				const hasPasskey = await this._passkeyService.getPasskeyMetadata(identifier);
				if (!hasPasskey) {
					this.showPasskeyPrompt = true;
				} else {
					this._router.navigateByUrl("/analytics");
				}
			} else {
				this._router.navigateByUrl("/analytics");
			}
			return;
		}

		console.error("Sign in response missing required authentication data:", response);
		this.alert = {
			type: "error",
			message: this.getErrorMessage({ message: "Incomplete authentication data received" }),
		};
		this.showAlert = true;
		this.signInForm.enable();
		this.showBiometricVerification = false;
	}

	/**
	 * Handle Passkey Save
	 */
	onPasskeySave(): void {
		const identifier = this._getCurrentIdentifier();
		const password = this.signInForm.get("masterPassword")?.value;

		if (identifier && password) {
			this._passkeyService.register(identifier).then(async (regResult) => {
				if (regResult) {
					const encrypted = await this._passkeyService.encryptPassword(password, regResult.key);
					await this._passkeyService.savePasskeyMetadata(identifier, {
						credentialId: regResult.credentialId,
						salt: this._passkeyService.bufferToBase64(regResult.salt),
						iv: encrypted.iv,
						ciphertext: encrypted.ciphertext,
					});
					// We can show a toast here if we had one, for now just close
				}
				this.showPasskeyPrompt = false;
				this._router.navigateByUrl("/analytics");
			});
		}
	}

	/**
	 * Handle Passkey Cancel
	 */
	onPasskeyCancel(): void {
		this.showPasskeyPrompt = false;
		this._router.navigateByUrl("/analytics");
	}

	/**
	 * Handle biometric verification cancellation
	 */
	onBiometricCancel(): void {
		this.showBiometricVerification = false;
		this.userData = {};
		// Clear remembered data when user cancels biometric verification
		this.clearRememberedData();
	}

	/**
	 * Parse JSON error body from HttpClient (Angular puts API body on error.error).
	 */
	private _httpErrorBody(error: any): { message: string; code?: string } {
		const body = error?.error;
		if (body && typeof body === "object" && !Array.isArray(body)) {
			return {
				message: typeof body.message === "string" ? body.message : "",
				code: typeof body.code === "string" ? body.code : undefined,
			};
		}
		if (typeof body === "string") {
			try {
				const parsed = JSON.parse(body);
				if (parsed && typeof parsed === "object") {
					return {
						message: typeof parsed.message === "string" ? parsed.message : "",
						code: typeof parsed.code === "string" ? parsed.code : undefined,
					};
				}
			} catch {
				return { message: body };
			}
		}
		return {
			message: typeof error?.message === "string" ? error.message : "",
			code: typeof error?.code === "string" ? error.code : undefined,
		};
	}

	/**
	 * Map error codes to translated messages
	 */
	private getErrorMessage(error: any): string {
		const { message: errorMessage, code: apiCode } = this._httpErrorBody(error);
		const errorCode = apiCode || error?.error?.code || error?.code || "unknown_error";

		const apiTransKey = translocoKeyForApiErrorCode(apiCode);
		if (apiTransKey) {
			return this._translocoService.translate(apiTransKey);
		}
		if (errorMessage.toUpperCase().includes("LIVENESS")) {
			return this._translocoService.translate("errors.api.ERR_LIVENESS_FAILED");
		}
		if (/face (quality|too small|too large)/i.test(errorMessage)) {
			return this._translocoService.translate("errors.api.ERR_FACE_VERIFICATION");
		}

		// Map error codes to translation keys
		const errorMapping: { [key: string]: string } = {
			client_not_found: SIGN_IN_GENERIC_ERROR_KEY,
			staff_not_found: SIGN_IN_GENERIC_ERROR_KEY,
			CLIENT_NOT_FOUND: SIGN_IN_GENERIC_ERROR_KEY,
			client_invalid_api_key: "errors.client_invalid_api_key",
			"403:client_not_found": SIGN_IN_GENERIC_ERROR_KEY,
			"403:client_invalid_api_key": "errors.client_invalid_api_key",
			Forbidden: "errors.unknown_error", // Generic 403 error
			Conflict: "errors.unknown_error", // Generic 409 error
			BadRequest: "errors.validation_error",
			UnprocessableEntity: "errors.validation_error",
			InternalServerError: "errors.unknown_error",
			Timeout: "errors.network_error",
			unknown_error: "errors.unknown_error",
			network_error: "errors.network_error",
			validation_error: "errors.validation_error",
		};

		// Check if it's a specific error message that contains our error codes
		if (errorMessage) {
			if (
				errorMessage.includes("client_not_found") ||
				errorMessage.includes("staff_not_found") ||
				errorMessage.includes("CLIENT_NOT_FOUND") ||
				errorMessage.toUpperCase().includes("THE PROVIDED PASSWORD IS INVALID") ||
				errorMessage.includes("error_decrypting")
			) {
				return this._translocoService.translate(SIGN_IN_GENERIC_ERROR_KEY);
			}
			if (errorMessage.includes("client_invalid_api_key")) {
				return this._translocoService.translate("errors.client_invalid_api_key");
			}
			if (errorMessage.includes("Incomplete authentication data received")) {
				return this._translocoService.translate("errors.incomplete_auth_data");
			}
			// Backend may return only a numeric status as message; avoid showing raw "422" as user text
			if (/^\d{3}$/.test(errorMessage.trim()) && apiCode) {
				const fromApiCode = translocoKeyForApiErrorCode(apiCode);
				if (fromApiCode) return this._translocoService.translate(fromApiCode);
				if (errorMapping[apiCode]) return this._translocoService.translate(errorMapping[apiCode]);
			}
		}

		const translationKey = errorMapping[errorCode] || "errors.unknown_error";

		// Return translated message
		return this._translocoService.translate(translationKey);
	}

	/**
	 * Load remembered data from localStorage
	 */
	private loadRememberedData(): void {
		try {
			const rememberedData = localStorage.getItem("zelf_remembered_signin");
			if (rememberedData) {
				const data = JSON.parse(rememberedData);

				// Set the identification method
				if (data.identificationMethod) {
					this.signInForm.patchValue({
						identificationMethod: data.identificationMethod,
					});
					this.updateValidation(data.identificationMethod);
				}

				// Set email if available
				if (data.email) {
					this.signInForm.patchValue({
						email: data.email,
					});
				}

				// Set phone data if available
				if (data.countryCode) {
					this.signInForm.patchValue({
						countryCode: data.countryCode,
					});
				}
				if (data.phone) {
					this.signInForm.patchValue({
						phone: data.phone,
					});
				}

				// Set remember me checkbox
				if (data.rememberMe) {
					this.signInForm.patchValue({
						rememberMe: data.rememberMe,
					});
				}
			}
		} catch (error) {
			console.error("Error loading remembered data:", error);
		}
	}

	/**
	 * Save data to localStorage if remember me is checked
	 */
	private saveRememberedData(): void {
		const formValue = this.signInForm.value;
		const rememberMe = formValue.rememberMe;

		if (rememberMe) {
			try {
				const dataToSave: any = {
					identificationMethod: formValue.identificationMethod,
					rememberMe: true,
				};

				if (formValue.identificationMethod === "email" && formValue.email) {
					dataToSave.email = formValue.email;
				} else if (formValue.identificationMethod === "phone") {
					if (formValue.countryCode) {
						dataToSave.countryCode = formValue.countryCode;
					}
					if (formValue.phone) {
						dataToSave.phone = formValue.phone;
					}
				}

				localStorage.setItem("zelf_remembered_signin", JSON.stringify(dataToSave));
			} catch (error) {
				console.error("Error saving remembered data:", error);
			}
		} else {
			// Clear saved data if remember me is unchecked
			localStorage.removeItem("zelf_remembered_signin");
		}
	}

	/**
	 * Clear remembered data from localStorage
	 */
	private clearRememberedData(): void {
		localStorage.removeItem("zelf_remembered_signin");
	}

	/**
	 * Change language
	 */
	onLanguageChange(languageCode: string): void {
		this.currentLanguage = languageCode;
		this._translocoService.setActiveLang(languageCode);
	}
}
