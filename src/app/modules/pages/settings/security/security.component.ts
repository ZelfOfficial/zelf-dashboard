import { ApiKeyVault, AuthStorage } from "app/core/auth/auth-storage";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, AfterViewInit, ViewEncapsulation } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { Router } from "@angular/router";
import { TranslocoService, TranslocoModule } from "@jsverse/transloco";
import { HttpWrapperService } from "../../../../http-wrapper.service";
import { SaveConfirmationService } from "../../../../core/services/save-confirmation.service";
import { PasskeyService } from "../../../../core/services/passkey.service";
import { environment } from "../../../../../environments/environment";

@Component({
	selector: "settings-security",
	templateUrl: "./security.component.html",
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		MatFormFieldModule,
		MatIconModule,
		MatInputModule,
		MatButtonModule,
		MatProgressSpinnerModule,
		TranslocoModule,
	],
})
export class SettingsSecurityComponent implements OnInit, AfterViewInit {
	securityForm: UntypedFormGroup;

	// Alert properties
	showAlert: boolean = false;
	alertMessage: string = "";
	alertType: "success" | "error" = "success";

	// Loading states
	isLoading: boolean = false;
	isLoadingApiKey: boolean = false;

	// API Key properties
	apiKey: string = "";
	showApiKey: boolean = false;

	// JWT Token properties
	jwtToken: string = "";
	showJwt: boolean = false;

	// Passkey properties
	passkeys: Array<{
		identifier: string;
		synced: boolean;
		credentialId: string;
		ipfsHash?: string;
		ipfsUrl?: string;
	}> = [];
	isSyncingPasskey: string | null = null;

	/**
	 * Constructor
	 */
	constructor(
		private _formBuilder: UntypedFormBuilder,
		private _httpWrapper: HttpWrapperService,
		private _cdr: ChangeDetectorRef,
		private _router: Router,
		private _saveConfirmationService: SaveConfirmationService,
		private _translocoService: TranslocoService,
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
		this.securityForm = this._formBuilder.group(
			{
				newPassword: ["", [Validators.required, Validators.minLength(8)]],
				confirmPassword: ["", [Validators.required]],
			},
			{ validators: this.passwordMatchValidator }
		);

		// Load JWT token from localStorage
		this.loadJwtToken();

		// Load API key from sessionStorage if available
		this.loadApiKeyFromStorage();

		// Load passkeys
		this.loadPasskeys();
	}

	/**
	 * After view init - refresh data when returning from other pages
	 */
	ngAfterViewInit(): void {
		// Refresh data when component becomes visible again
		this.loadJwtToken();
		this.loadApiKeyFromStorage();
		this.loadPasskeys();
	}

	// -----------------------------------------------------------------------------------------------------
	// @ Public methods
	// -----------------------------------------------------------------------------------------------------

	/**
	 * Password match validator
	 */
	passwordMatchValidator(form: UntypedFormGroup) {
		const newPassword = form.get("newPassword");
		const confirmPassword = form.get("confirmPassword");

		if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
			confirmPassword.setErrors({ passwordMismatch: true });
			return { passwordMismatch: true };
		} else {
			if (confirmPassword?.hasError("passwordMismatch")) {
				confirmPassword.setErrors(null);
			}
			return null;
		}
	}

	/**
	 * Load JWT token from localStorage
	 */
	loadJwtToken(): void {
		this.jwtToken = AuthStorage.getItem("accessToken") || "";
		this._cdr.detectChanges();
	}

	/**
	 * Load API key from sessionStorage
	 */
	loadApiKeyFromStorage(): void {
		// In-memory only; also drop any copy older builds left in sessionStorage.
		sessionStorage.removeItem("apiKey");
		this.apiKey = ApiKeyVault.get();
		this._cdr.detectChanges();
	}

	/**
	 * Load API key with biometric verification
	 */
	loadApiKey(): void {
		// Create security data object for API key loading
		const securityData = {
			operation: "loadApiKey",
			faceBase64: "", // Will be set during biometric verification
			masterPassword: "", // Will be set during biometric verification
		};

		// Set save data in service
		this._saveConfirmationService.setSaveData({
			domain: null, // Not needed for security operations
			domainConfig: null, // Not needed for security operations
			redirectUrl: "/settings/security",
			operation: {
				title: this._translocoService.translate("saving_operations.load_api_key.title"),
				description: this._translocoService.translate("saving_operations.load_api_key.description"),
				action: this._translocoService.translate("saving_operations.load_api_key.action"),
				itemName: this._translocoService.translate("saving_operations.load_api_key.itemName"),
			},
			securityData: securityData, // Add security-specific data
		});

		// Navigate to save confirmation page
		this._router.navigate(["/save-confirmation"], {
			queryParams: { redirect: "/settings/security" },
		});
	}

	/**
	 * Toggle API key visibility
	 */
	toggleApiKeyVisibility(): void {
		this.showApiKey = !this.showApiKey;
		this._cdr.detectChanges();
	}

	/**
	 * Toggle JWT token visibility
	 */
	toggleJwtVisibility(): void {
		this.showJwt = !this.showJwt;
		this._cdr.detectChanges();
	}

	/**
	 * Save password with biometric verification
	 */
	savePassword(): void {
		if (this.securityForm.invalid) {
			this.showError("Please fill in all required fields correctly");
			return;
		}

		const formValue = this.securityForm.value;

		// Create security data object
		const securityData = {
			newPassword: formValue.newPassword,
			confirmPassword: formValue.confirmPassword,
			operation: "changePassword",
			faceBase64: "", // Will be set during biometric verification
			masterPassword: "", // Will be set during biometric verification
		};

		// Set save data in service
		this._saveConfirmationService.setSaveData({
			domain: null, // Not needed for security operations
			domainConfig: null, // Not needed for security operations
			redirectUrl: "/settings/security",
			operation: {
				title: this._translocoService.translate("saving_operations.password_change.title"),
				description: this._translocoService.translate("saving_operations.password_change.description"),
				action: this._translocoService.translate("saving_operations.password_change.action"),
				itemName: this._translocoService.translate("saving_operations.password_change.itemName"),
			},
			securityData: securityData, // Add security-specific data
		});

		// Navigate to save confirmation page
		this._router.navigate(["/save-confirmation"], {
			queryParams: { redirect: "/settings/security" },
		});
	}

	/**
	 * Cancel operation
	 */
	cancel(): void {
		this.securityForm.reset();
		this.showAlert = false;
		this._cdr.detectChanges();
	}

	/**
	 * Load passkeys from localStorage for current user
	 */
	loadPasskeys(): void {
		try {
			// Get current user's email/phone from zelfAccount
			const zelfAccount = AuthStorage.getItem("zelfAccount");

			if (!zelfAccount) {
				this.passkeys = [];

				this._cdr.detectChanges();

				return;
			}

			const account = JSON.parse(zelfAccount);

			// For staff accounts, use staffEmail/staffPhone; for client accounts, use email/phone
			const userIdentifier =
				account.publicData.staffEmail || account.publicData.email || account.publicData.staffPhone || account.publicData.phone;

			if (!userIdentifier) {
				this.passkeys = [];

				this._cdr.detectChanges();

				return;
			}

			// Get passkeys from localStorage
			const passkeyStore = localStorage.getItem("zelf_passkeys");

			if (!passkeyStore) {
				this.passkeys = [];
				this._cdr.detectChanges();
				return;
			}

			const store = JSON.parse(passkeyStore);

			// Filter passkeys for current user
			const filteredKeys = Object.keys(store).filter((key) => key === userIdentifier);

			this.passkeys = filteredKeys.map((key) => ({
				identifier: key,
				synced: store[key].synced || false,
				credentialId: store[key].credentialId,
			}));

			// Fetch IPFS details for synced passkeys
			this.passkeys.forEach((passkey) => {
				if (passkey.synced) {
					this.fetchIpfsDetails(passkey.identifier);
				}
			});

			this._cdr.detectChanges();
		} catch (error) {
			console.error("Error loading passkeys:", error);
			this.passkeys = [];
			this._cdr.detectChanges();
		}
	}

	/**
	 * Sync a passkey to the cloud
	 */
	async syncPasskey(identifier: string): Promise<void> {
		try {
			this.isSyncingPasskey = identifier;
			this._cdr.detectChanges();

			// Get the passkey metadata from localStorage
			const passkeyStore = localStorage.getItem("zelf_passkeys");
			if (!passkeyStore) {
				throw new Error("No passkeys found");
			}

			const store = JSON.parse(passkeyStore);
			const metadata = store[identifier];

			if (!metadata) {
				throw new Error("Passkey not found");
			}

			// Call savePasskeyMetadata which will sync to cloud and update the synced flag
			await this._passkeyService.savePasskeyMetadata(identifier, {
				credentialId: metadata.credentialId,
				salt: metadata.salt,
				iv: metadata.iv,
				ciphertext: metadata.ciphertext,
			});

			// Fetch IPFS details after successful sync
			await this.fetchIpfsDetails(identifier);

			this.showSuccess("Passkey synced to IPFS successfully");
		} catch (error) {
			console.error("Error syncing passkey:", error);
			this.showError("Failed to sync passkey");
		} finally {
			this.isSyncingPasskey = null;
			this._cdr.detectChanges();
		}
	}

	/**
	 * Fetch IPFS details for a synced passkey
	 */
	async fetchIpfsDetails(identifier: string): Promise<void> {
		try {
			// Determine if identifier is email or phone
			const isEmail = identifier.includes("@");

			const keyType = isEmail ? "passKeysEmail" : "passKeysPhone";

			// Call backend to get IPFS record details
			const response: any = await this._httpWrapper.sendRequest(
				"get",
				`${environment.apiUrl}/api/staff/passkeys/ipfs-details?identifier=${encodeURIComponent(identifier)}&keyType=${keyType}`,
				null
			);

			if (response && response.data) {
				// Update the passkey with IPFS details
				const passkeyIndex = this.passkeys.findIndex((p) => p.identifier === identifier);
				if (passkeyIndex !== -1) {
					this.passkeys[passkeyIndex] = {
						...this.passkeys[passkeyIndex],
						synced: true,
						ipfsHash: response.data.ipfsHash,
						ipfsUrl: response.data.ipfsUrl,
					};
					this._cdr.detectChanges();
				}
			}
		} catch (error) {
			console.error("Error fetching IPFS details:", error);
			// Don't throw - just reload passkeys without IPFS details
			this.loadPasskeys();
		}
	}

	/**
	 * Delete a passkey from local storage and IPFS
	 */
	async deletePasskey(identifier: string): Promise<void> {
		if (!confirm(`Are you sure you want to delete the passkey for ${identifier}? This action cannot be undone.`)) {
			return;
		}

		try {
			this.isSyncingPasskey = identifier; // Reuse loading state
			this._cdr.detectChanges();

			// Delete from both local and cloud
			await this._passkeyService.deletePasskeyMetadata(identifier);

			// Reload passkeys to reflect deletion
			this.loadPasskeys();
			this.showSuccess("Passkey deleted successfully");
		} catch (error) {
			console.error("Error deleting passkey:", error);
			this.showError("Failed to delete passkey");
		} finally {
			this.isSyncingPasskey = null;
			this._cdr.detectChanges();
		}
	}

	/**
	 * Show success message
	 */
	private showSuccess(message: string): void {
		this.alertMessage = message;
		this.alertType = "success";
		this.showAlert = true;
		setTimeout(() => {
			this.showAlert = false;
			this._cdr.detectChanges();
		}, 5000);
		this._cdr.detectChanges();
	}

	/**
	 * Show error message
	 */
	private showError(message: string): void {
		this.alertMessage = message;
		this.alertType = "error";
		this.showAlert = true;
		setTimeout(() => {
			this.showAlert = false;
			this._cdr.detectChanges();
		}, 5000);
		this._cdr.detectChanges();
	}
}
