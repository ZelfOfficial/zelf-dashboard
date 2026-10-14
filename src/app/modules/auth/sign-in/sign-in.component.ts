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
	/** True when the identifier belongs to a staff account (signs in via /api/staff/auth). */
	private _isStaffSignIn = false;
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

		/**
		 * {
    "data": {
        "id": "7de688a7-302d-4a32-962b-9e37d0b716d4",
        "ipfs_pin_hash": "bafkreif43dolp3yedc2cos6kkhlho6zriglmyi3owetx65xvimualqh5ju",
        "size": 1189,
        "user_id": "622f63b9-c03d-4702-9679-5d1409ae5e20",
        "date_pinned": "2025-09-11T16:32:04.266Z",
        "date_unpinned": null,
        "metadata": {
			"type": "client_account",
			"email": "emery.garcia@icloud.com",
			"phone": "8131259467",
			"company": "Smart Contracts Ltd",
			"zelfProof": "A5boXuG+IXX0FsSzEmPfXQLCT7dP2qKum81DZqaDkInIYNkO6mmYFIo9j7dgsAaF5fA4TuRYeewTOXuiF4k2+L6USP2qC7lpMiOUr8cqWshWaqCROorkA9+cJ2AAYY0bJIuTcoSUWX5tec9HoYHC1TGcoMOnYvIX7IMiDQpkdbD59TA+BD6H3yAa6vCS6bp5Enezyj474jg8ODy5CJHDuh1jRs9X+UE41j5IQGecKR64zKMjc4SflfvkdrLuXKfrsxuKBO/q15EllywddDNyH8DnLsGi8BYYXAiJ3V4n3J26nJhyIs1v0gVMXpxHd3P30pZOIQFXWYDr3kcKGoLOFBfPsqf8gSoD61cMtm4Bso9mh6WMkCk8zlEhQrqH8W7O6+dbkc6dlWJAC6stLAQAC0lyiReiEif5HXKSwRbMxh5di73IeQVl2VPD4OXP7nHV0/u3rMjXrh7ZZ4pMQWjgsbirko6roO/at9KegvOODD0LSgFAEbUM+hq3bGkGiisQNjYYV595Z9onflJxWUYu9Xv+upsEo99tYfO4soqmANlNcEtDC6OPOIQ6CpRpHxyzDbbdckWMl4QASI2uuHmlUAhuQ84UzrLiPdHDc9dOvK2E8gewm9adQXlej/MOtLcU+T7h4o8lqyTYYorlooTLinlmmh3aM/+rxaCTc3i5LAMIoSFN1vI5KsoGfIm4T6XTObB2/BKMCFgcUlXsKqi5LEKf3UvLZ4ZrJWFX6M2pRsDTMre2xLckyjg3XwK6ywoiRL2agxSMuh+5hVq1AwVUmw5W1XVdSpxMDtn+I7KpP3Vn7YcyGQOhrG6lTkjl6haqldJ2J1aFqql8jNwoZVUS28ImOkiWJUwugLwrnwU02BkeybceYsKzzSC/zYY3sf32bDDx0OYgThxqSc2hCdLBKWaeG3wBaMnkFX4r5nFmnoD/8IqFY5F/B34Io1JZAA==",
			"countryCode": "+64",
			"subscriptionId": "free" 
        },
        "regions": [
            {
                "regionId": "pinata",
                "currentReplicationCount": 1,
                "desiredReplicationCount": 1
            }
        ],
        "mime_type": "false",
        "number_of_files": 1,
        "url": "https://blush-selective-earwig-920.mypinata.cloud/ipfs/bafkreif43dolp3yedc2cos6kkhlho6zriglmyi3owetx65xvimualqh5ju"
    }
}
		 */

		// here we will need to call the backend to try to find the client using the identification method and the identifier
		this._authService.verifyClientExists(this.userData).subscribe(
			(response) => {
				const publicData = response.data?.publicData;
				// The API stores staff records as either "staff" or "staff_account"; accept both.
				const isStaffAccount = publicData?.accountType === "staff_account" || publicData?.accountType === "staff";
				this._isStaffSignIn = isStaffAccount;

				// Handle both client and staff accounts
				if (isStaffAccount) {
					// Staff account - use staffEmail, staffPhone, staffCountryCode
					this.userData = {
						...this.userData, // Preserve original userData including masterPassword and identificationMethod
						email: publicData?.staffEmail,
						phone: publicData?.staffPhone,
						countryCode: publicData?.staffCountryCode,
					};
				} else {
					// Client account - use accountEmail, accountPhone, accountCountryCode
					this.userData = {
						...this.userData, // Preserve original userData including masterPassword and identificationMethod
						email: publicData?.accountEmail,
						phone: publicData?.accountPhone,
						countryCode: publicData?.accountCountryCode,
					};
				}

				if (publicData?.accountEmail || publicData?.staffEmail) {
					this.showBiometricVerification = true;

					this.showAlert = false;

					return;
				}

				this.showAlert = true;

				this.alert = {
					type: "error",
					message: this.getErrorMessage({ message: "Client not found" }),
				};
			},
			(error) => {
				console.error("Verify client exists error:", error);
				this.showAlert = true;
				this.alert = {
					type: "error",
					message: this.getErrorMessage(error),
				};
			}
		);
	}

	/**
	 * Handle successful biometric verification
	 */
	onBiometricSuccess(biometricData: BiometricData): void {
		// Disable the form
		this.signInForm.disable();

		// Combine user data with biometric data
		const signInData = {
			...this.userData,
			masterPassword: biometricData.password,
			faceBase64: biometricData.faceBase64,
		};

		// Staff sign in through the v4 staff endpoint; clients keep using /api/clients/auth.
		const signInRequest =
			this._isStaffSignIn && signInData.email
				? this._authService.signInStaff({
						email: signInData.email,
						faceBase64: signInData.faceBase64,
						masterPassword: signInData.masterPassword,
					})
				: this._authService.signIn(signInData);

		signInRequest.then(
			async (response) => {
				// /api/staff/auth returns the staff IPFS record as `staffAccount` (same as accept-invite).
				const account = response.data?.zelfAccount || response.data?.staffAccount;

				// Check if we have all required data for authentication
				if (response.data?.token && response.data?.zelfProof && account) {
					// Set session data
					this._authService.setSession({
						zelfProof: response.data.zelfProof,
						zelfAccount: account,
					});

					// Set access token
					this._authService.setAccessToken(response.data.token);

					// Save wallet data to localStorage if available
					if (response.data?.wallet) {
						AuthStorage.setItem("wallet", JSON.stringify(response.data.wallet));
					}

					// POC: Prompt to save with Passkey
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
						// Navigate to dashboard
						this._router.navigateByUrl("/analytics");
					}
				} else {
					// Handle case where required data is missing
					console.error("Sign in response missing required authentication data:", response);

					// Show error message
					this.alert = {
						type: "error",
						message: this.getErrorMessage({ message: "Incomplete authentication data received" }),
					};
					this.showAlert = true;

					// Re-enable the form
					this.signInForm.enable();
					this.showBiometricVerification = false;
				}
			},
			(error) => {
				console.error("Sign in error:", error);

				const { message: apiMessage, code: apiCode } = this._httpErrorBody(error);
				const apiLower = apiMessage.toLowerCase();
				const isBiometricError =
					!!apiMessage &&
					(apiLower.includes("multiple face") ||
						apiLower.includes("no face detected") ||
						apiLower.includes("face not recognized") ||
						apiLower.includes("biometric") ||
						apiLower.includes("face quality") ||
						apiLower.includes("face is not central") ||
						apiLower.includes("not central") ||
						apiMessage.includes("LIVENESS") ||
						apiLower.includes("liveness") ||
						(!!apiCode && (apiCode === "ERR_LIVENESS_FAILED" || apiCode.includes("FACE_"))));

				if (isBiometricError && this.biometricVerification) {
					this.biometricVerification.handleApiError(error);
					return;
				}

				// Re-enable the form
				this.signInForm.enable();

				// Reset the form
				this.signInNgForm.resetForm();

				// Hide biometric verification
				this.showBiometricVerification = false;

				// Get translated error message
				const errorMessage = this.getErrorMessage(error);

				// Set the alert with translated message
				this.alert = {
					type: "error",
					message: errorMessage,
				};

				// Show the alert
				this.showAlert = true;
			}
		);
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
			client_not_found: "errors.client_not_found",
			client_invalid_api_key: "errors.client_invalid_api_key",
			"403:client_not_found": "errors.client_not_found",
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
			if (errorMessage.includes("client_not_found")) {
				return this._translocoService.translate("errors.client_not_found");
			}
			if (errorMessage.includes("client_invalid_api_key")) {
				return this._translocoService.translate("errors.client_invalid_api_key");
			}
			if (errorMessage.toUpperCase().includes("THE PROVIDED PASSWORD IS INVALID")) {
				return this._translocoService.translate("errors.invalid_password");
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
