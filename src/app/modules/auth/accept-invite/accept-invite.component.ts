import { Component, OnInit, ViewChild, ViewEncapsulation, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule, NgForm, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { ActivatedRoute, Router } from "@angular/router";
import { fuseAnimations } from "@fuse/animations";
import { FuseAlertComponent, FuseAlertType } from "@fuse/components/alert";
import { AuthService } from "app/core/auth/auth.service";
import { DataBiometricsComponent, BiometricData } from "../biometric-verification/biometric-verification.component";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { PasskeyPromptModalComponent } from "../passkey-prompt-modal/passkey-prompt-modal.component";
import { PasskeyService } from "app/core/services/passkey.service";

@Component({
	selector: "auth-accept-invite",
	templateUrl: "./accept-invite.component.html",
	encapsulation: ViewEncapsulation.None,
	animations: fuseAnimations,
	imports: [
		CommonModule,
		FuseAlertComponent,
		FormsModule,
		ReactiveFormsModule,
		MatFormFieldModule,
		MatInputModule,
		MatButtonModule,
		MatIconModule,
		MatProgressSpinnerModule,
		DataBiometricsComponent,
		TranslocoModule,
		PasskeyPromptModalComponent,
	],
})
export class AuthAcceptInviteComponent implements OnInit {
	@ViewChild("acceptInviteNgForm") acceptInviteNgForm: NgForm;
	@ViewChild("biometricVerification") biometricVerification: DataBiometricsComponent;

	alert: { type: FuseAlertType; message: string } = {
		type: "success",
		message: "",
	};
	acceptInviteForm: UntypedFormGroup;
	showAlert: boolean = false;
	showBiometricVerification: boolean = false;
	showPasskeyPrompt: boolean = false;
	isLoading: boolean = true;
	inviteData: any = null;
	token: string = "";

	constructor(
		private _authService: AuthService,
		private _formBuilder: UntypedFormBuilder,
		private _router: Router,
		private _route: ActivatedRoute,
		private _passkeyService: PasskeyService
	) {}

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
	private _translocoService = inject(TranslocoService);

	ngOnInit(): void {
		// Initialize current language
		this.currentLanguage = this._translocoService.getActiveLang() || "en";

		// Get token from URL
		this.token = this._route.snapshot.queryParamMap.get("token");

		if (!this.token) {
			this.isLoading = false;
			this.alert = {
				type: "error",
				message: "Invalid invitation link. Token is missing.",
			};
			this.showAlert = true;
			return;
		}

		// Validate token
		this._authService
			.validateInvite(this.token)
			.then((data) => {
				this.inviteData = data;
				if (data.isAlreadyRegistered && !data.invitationStatus) {
					// Assuming backend flag
					// Handle already registered logic if needed, but for now we proceed or show warning
					// The backend validateInvitation returns isAlreadyRegistered if ACTIVE account exists.
					// If so, maybe redirect to login? Or allow them to overwrite?
					// For now, let's just proceed but show a warning if useful, or assume they know.
					// Actually, if registered, createFromInvitation will throw error.
				}
				this.isLoading = false;
			})
			.catch((error) => {
				this.isLoading = false;
				this.alert = {
					type: "error",
					message: error.message || "Invalid or expired invitation link.",
				};
				this.showAlert = true;
			});

		// Create the form
		this.acceptInviteForm = this._formBuilder.group({
			masterPassword: ["", Validators.required],
		});
	}

	/**
	 * Accept invite
	 */
	acceptInvite(): void {
		if (this.acceptInviteForm.invalid) {
			return;
		}

		this.showBiometricVerification = true;
		this.showAlert = false;
	}

	/**
	 * Handle successful biometric verification
	 */
	onBiometricSuccess(biometricData: BiometricData): void {
		this.acceptInviteForm.disable();

		const data = {
			invitationToken: this.token,
			faceBase64: biometricData.faceBase64,
			masterPassword: this.acceptInviteForm.get("masterPassword")?.value,
		};

		this._authService
			.acceptInvite(data)
			.then((response) => {
				if (response.data?.token) {
					this._authService.setSession({
						zelfProof: response.data.zelfProof,
						zelfAccount: response.data.staffAccount,
					});
					this._authService.setAccessToken(response.data.token);

					// Prompt for passkey
					this.showPasskeyPrompt = true;
				}
			})
			.catch((error) => {
				console.error("Accept invite error:", error);
				this.acceptInviteForm.enable();
				this.showBiometricVerification = false;
				this.alert = {
					type: "error",
					message: error.message || "Failed to accept invitation.",
				};
				this.showAlert = true;

				if (this.biometricVerification && (error.message?.includes("face") || error.message?.includes("biometric"))) {
					this.biometricVerification.handleApiError(error);
				}
			});
	}

	onBiometricCancel(): void {
		this.showBiometricVerification = false;
	}

	onPasskeySave(): void {
		const email = this.inviteData?.staffEmail;
		const password = this.acceptInviteForm.get("masterPassword")?.value;

		if (email && password) {
			this._passkeyService
				.register(email)
				.then(async (regResult) => {
					if (regResult) {
						const encrypted = await this._passkeyService.encryptPassword(password, regResult.key);
						await this._passkeyService.savePasskeyMetadata(email, {
							credentialId: regResult.credentialId,
							salt: this._passkeyService.bufferToBase64(regResult.salt),
							iv: encrypted.iv,
							ciphertext: encrypted.ciphertext,
						});
					}
					this._router.navigateByUrl("/tags");
				})
				.catch((err) => {
					console.error("Passkey error", err);
					this._router.navigateByUrl("/tags");
				});
		} else {
			this._router.navigateByUrl("/tags");
		}
	}

	onPasskeyCancel(): void {
		this._router.navigateByUrl("/tags");
	}

	onLanguageChange(languageCode: string): void {
		this.currentLanguage = languageCode;
		this._translocoService.setActiveLang(languageCode);
	}
}
