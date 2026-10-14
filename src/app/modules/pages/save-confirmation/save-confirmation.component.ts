import { ApiKeyVault, AuthStorage } from "app/core/auth/auth-storage";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { Router, ActivatedRoute } from "@angular/router";
import { Subject, takeUntil } from "rxjs";
import { TranslocoService, TranslocoModule } from "@jsverse/transloco";
import { DataBiometricsComponent, BiometricData } from "../../auth/biometric-verification/biometric-verification.component";
import { isBiometricApiError } from "app/core/i18n/api-error-codes";
import { SaveConfirmationService, SaveConfirmationData } from "../../../core/services/save-confirmation.service";
import { HttpWrapperService } from "../../../http-wrapper.service";
import { PasskeyService } from "../../../core/services/passkey.service";
import { AuthService } from "../../../core/auth/auth.service";
import { StaffService } from "../../../core/services/staff.service";
import { LawyerService } from "../../../modules/zelf-legacy/lawyers/lawyer.service";
import { ClientService } from "../../../core/services/client.service";
import { environment } from "../../../../environments/environment";
import { License } from "../settings/license/license.class";
import { LicenseService } from "../settings/license/license.service";
import { TagsService } from "../../tags/tags.service";

@Component({
    selector: "app-save-confirmation",
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatProgressSpinnerModule,
        DataBiometricsComponent,
        TranslocoModule,
    ],
    templateUrl: "./save-confirmation.component.html",
    styleUrls: ["./save-confirmation.component.scss"],
})
export class SaveConfirmationComponent implements OnInit, OnDestroy {
    @ViewChild(DataBiometricsComponent) biometricVerification?: DataBiometricsComponent;

    private destroy$ = new Subject<void>();

    // Form data
    masterPassword: string = "";
    showPassword: boolean = false;
    hasPasskey: boolean = false;

    // Modal state
    showBiometricModal: boolean = false;
    isLoading: boolean = false;
    isSuccess: boolean = false;
    showAlert: boolean = false;
    alertMessage: string = "";
    alertType: "success" | "error" = "success";

    // Save data
    saveData: SaveConfirmationData | null = null;
    redirectUrl: string = "/settings/license";

    constructor(
        private saveConfirmationService: SaveConfirmationService,
        private httpWrapper: HttpWrapperService,
        private authService: AuthService,
        private router: Router,
        private route: ActivatedRoute,
        private translocoService: TranslocoService,
        private passkeyService: PasskeyService,
        private staffService: StaffService,
        private lawyerService: LawyerService,
        private clientService: ClientService,
        private licenseService: LicenseService,
        private tagsService: TagsService,
    ) {}

    ngOnInit(): void {
        // Get redirect URL from query params
        this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
            if (params["redirect"]) {
                this.redirectUrl = params["redirect"];
            }
        });

        // Get save data from service
        this.saveConfirmationService.saveData$.pipe(takeUntil(this.destroy$)).subscribe((data) => {
            if (data) {
                this.saveData = data;
                // Update redirect URL from save data if provided
                if (data.redirectUrl) {
                    this.redirectUrl = data.redirectUrl;
                }

                return;
            }

            // No data available, redirect back
            this.router.navigate([this.redirectUrl]);
        });

        // Check for passkey
        const email = this.authService.zelfAccount?.publicData?.accountEmail || this.authService.zelfAccount?.publicData?.staffEmail;
        if (email) {
            this.passkeyService.getPasskeyMetadata(email).then((metadata) => {
                if (metadata) {
                    this.hasPasskey = true;
                }
            });
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Toggle password visibility
     */
    togglePasswordVisibility(): void {
        this.showPassword = !this.showPassword;
    }

    /**
     * Login with Passkey
     */
    async onPasskeyLogin(): Promise<void> {
        this.isLoading = true;
        try {
            const email = this.authService.zelfAccount?.publicData?.accountEmail || this.authService.zelfAccount?.publicData?.staffEmail;
            if (!email) throw new Error("No user email found");

            const metadata = await this.passkeyService.getPasskeyMetadata(email);
            if (!metadata) throw new Error("No passkey metadata found");

            // Authenticate with passkey
            const key = await this.passkeyService.authenticate(metadata.credentialId, this.passkeyService.base64ToBuffer(metadata.salt));

            if (key) {
                // Decrypt master password
                const decryptedPassword = await this.passkeyService.decryptPassword(metadata.ciphertext, metadata.iv, key);

                if (decryptedPassword) {
                    this.masterPassword = decryptedPassword;
                    this.isLoading = false;
                    this.proceedToBiometric();
                    return;
                }
            }
            throw new Error("Passkey authentication failed");
        } catch (error) {
            console.error("Passkey login error:", error);
            this.showError("Passkey login failed. Please use your master password.");
            this.isLoading = false;
        }
    }

    /**
     * Proceed to biometric verification
     */
    proceedToBiometric(): void {
        if (!this.masterPassword.trim()) {
            this.showError("Please enter your master password");
            return;
        }

        if (!this.saveData) {
            this.showError("No save data available");
            return;
        }

        // Show biometric modal
        this.showBiometricModal = true;
    }

    /**
     * Handle successful biometric verification
     */
    onBiometricSuccess(biometricData: BiometricData): void {
        if (!this.isLoading) {
            this.isLoading = true;
        }

        if (!this.saveData) {
            this.showBiometricModal = false;
            this.showError("No save data available");
            this.isLoading = false;
            return;
        }

        // Check if this is a security operation
        if (this.saveData.securityData) {
            // Handle security operation (password change)
            this.handleSecurityOperation(biometricData);
        } else if (this.saveData.themeData) {
            // Handle theme operation
            this.handleThemeOperation(biometricData);
        } else if (this.saveData.domainConfig && !this.saveData.domain) {
            // Handle license operation (full license creation) - legacy support
            this.handleLicenseOperation(biometricData);
        } else if (this.saveData.domainConfig) {
            // Handle domain config operation (updating existing license)
            this.handleDomainConfigOperation(biometricData);
        } else if (this.saveData.profileData) {
            // Handle profile operation
            this.handleProfileOperation(biometricData);
        } else if (this.saveData.staffData) {
            // Handle staff operation
            this.handleStaffOperation(biometricData);
        } else if (this.saveData.tagExtensionData) {
            // Handle tag extension operation
            this.handleTagExtensionOperation(biometricData);
        } else {
            this.showBiometricModal = false;
            this.showError("Invalid operation data");
            this.isLoading = false;
        }
    }

    /**
     * Handle biometric verification cancellation
     */
    onBiometricCancel(): void {
        this.showBiometricModal = false;
    }

    /**
     * Go back to previous screen
     */
    goBack(): void {
        this.saveConfirmationService.clearSaveData();
        this.router.navigate([this.redirectUrl]);
    }

    /**
     * Handle security operation (password change or load API key)
     */
    private async handleSecurityOperation(biometricData: BiometricData): Promise<void> {
        if (!this.saveData?.securityData) {
            this.showError("No security data available");
            this.isLoading = false;
            return;
        }

        try {
            const securityData = {
                ...this.saveData.securityData,
                faceBase64: biometricData.faceBase64,
                masterPassword: biometricData.password || this.masterPassword,
            };

            // Check operation type
            if (securityData.operation === "loadApiKey") {
                await this.loadApiKey(securityData);
            } else if (securityData.operation === "changePassword") {
                await this.changePassword(securityData);
            } else {
                this.showError("Unknown security operation");
                this.isLoading = false;
            }
        } catch (error) {
            const operation = this.saveData?.securityData?.operation === "loadApiKey" ? "load API key" : "change password";
            this._handleSaveError(error, `Failed to ${operation}. Please try again.`);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Handle theme operation (update theme settings)
     */
    private async handleThemeOperation(biometricData: BiometricData): Promise<void> {
        if (!this.saveData?.themeData) {
            this.showError("No theme data available");
            this.isLoading = false;
            return;
        }

        try {
            const themeData = {
                ...this.saveData.themeData,
                faceBase64: biometricData.faceBase64,
                masterPassword: biometricData.password || this.masterPassword,
            };

            // Check operation type
            if (themeData.operation === "updateThemeSettings") {
                await this.updateThemeSettings(themeData);
            } else {
                this.showError("Unknown theme operation");
                this.isLoading = false;
            }
        } catch (error) {
            this._handleSaveError(error, "Failed to update theme settings. Please try again.");
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Handle license operation
     */
    private async handleLicenseOperation(biometricData: BiometricData): Promise<void> {
        if (!this.saveData?.domainConfig) {
            this.showError("No license data available");

            this.isLoading = false;

            return;
        }

        try {
            const licenseData = {
                domain: this.saveData.domainConfig.name,
                domainConfig: this.saveData.domainConfig,
                faceBase64: biometricData.faceBase64,
                masterPassword: biometricData.password || this.masterPassword,
                ...(this.saveData.logoBase64 ? { logoBase64: this.saveData.logoBase64 } : {}),
            };

            await this.createLicense(licenseData);
        } catch (error) {
            this._handleSaveError(error, "Failed to save license. Please try again.");
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Handle domain config operation (updating existing license)
     */
    private async handleDomainConfigOperation(biometricData: BiometricData): Promise<void> {
        if (!this.saveData?.domainConfig) {
            this.showError("No domain config data available");
            this.isLoading = false;
            return;
        }

        try {
            const updateData = {
                domain: this.saveData.domain,
                domainConfig: this.saveData.domainConfig,
                faceBase64: biometricData.faceBase64,
                masterPassword: biometricData.password || this.masterPassword,
                ...(this.saveData.logoBase64 ? { logoBase64: this.saveData.logoBase64 } : {}),
            };

            await this.createLicense(updateData);
        } catch (error) {
            this._handleSaveError(error, "Failed to update license configuration. Please try again.");
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Handle profile operation
     */
    private async handleProfileOperation(biometricData: BiometricData): Promise<void> {
        if (!this.saveData?.profileData) {
            this.showError("No profile data available");
            this.isLoading = false;
            return;
        }

        try {
            const profileData = {
                ...this.saveData.profileData,
                faceBase64: biometricData.faceBase64,
                masterPassword: biometricData.password || this.masterPassword,
            };

            await this.updateProfile(profileData);
        } catch (error) {
            let errorMessage = "Failed to update profile. Please try again.";

            if (error?.message) {
                if (error.message.includes("error_decrypting_zelf_account")) {
                    errorMessage = "Biometric verification failed. Please check your face image and master password.";
                } else if (error.message.includes("zelf_account_not_found")) {
                    errorMessage = "Account not found. Please contact support.";
                } else if (error.message.includes("404")) {
                    errorMessage = "Account not found. Please contact support.";
                } else if (error.message.includes("409")) {
                    errorMessage = "Verification failed. Please try again.";
                } else {
                    errorMessage = error.message;
                }
            }

            this._handleSaveError(error, errorMessage);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Handle staff operation (invite, remove, update role)
     */
    private async handleStaffOperation(biometricData: BiometricData): Promise<void> {
        if (!this.saveData?.staffData) {
            this.showError("No staff data available");
            this.isLoading = false;
            return;
        }

        try {
            const staffData = {
                ...this.saveData.staffData,
                faceBase64: biometricData.faceBase64,
                masterPassword: biometricData.password || this.masterPassword,
            };

            switch (staffData.operation) {
                case "inviteStaff":
                    await this.inviteStaff(staffData);
                    break;
                case "removeStaff":
                    await this.removeStaff(staffData);
                    break;
                case "inviteLawyer":
                    await this.inviteLawyer(staffData);
                    break;
                case "removeLawyer":
                    await this.removeLawyer(staffData);
                    break;
                case "updateRole":
                    await this.updateStaffRole(staffData);
                    break;
                default:
                    throw new Error("Unknown staff operation");
            }
        } catch (error) {
            const apiMessage = error?.error?.message || error?.message || "";
            let errorMessage = "Failed to complete operation. Please try again.";

            if (apiMessage) {
                if (apiMessage.includes("error_decrypting_zelf_account")) {
                    errorMessage = "Biometric verification failed. Please check your face image and master password.";
                } else if (apiMessage.includes("staff_already_exists") || apiMessage.includes("lawyer_already_exists")) {
                    errorMessage = "This member already exists.";
                } else if (apiMessage.includes("staff_not_found") || apiMessage.includes("lawyer_not_found")) {
                    errorMessage = "Member not found.";
                } else if (apiMessage.includes("client_not_found")) {
                    errorMessage = "Client account not found. Please verify your credentials.";
                } else if (apiMessage.includes("verification_failed")) {
                    errorMessage = "Verification failed. Please try again.";
                } else {
                    errorMessage = apiMessage;
                }
            }

            this._handleSaveError(error, errorMessage);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Load API key
     */
    private async loadApiKey(securityData: any): Promise<void> {
        try {
            const zelfAccount = this.authService.zelfAccount;
            const accountEmail = zelfAccount?.publicData?.accountEmail;

            const requestData = {
                ...securityData,
                email: accountEmail,
                identificationMethod: "email",
            };

            const response = await this.httpWrapper.sendRequest(
                "post",
                `${environment.apiUrl}${environment.endpoints.security.loadApiKey}`,
                requestData,
            );

            if (response && response.data && response.data.apiKey) {
                // Keep the API key in memory only (never in browser storage).
                ApiKeyVault.set(response.data.apiKey);

                // Update access token if provided
                if (response.data.token) {
                    AuthStorage.setItem("accessToken", response.data.token);
                }

                // Update zelfAccount if provided
                if (response.data.zelfAccount) {
                    AuthStorage.setItem("zelfAccount", JSON.stringify(response.data.zelfAccount));
                }

                // Update zelfProof if provided
                if (response.data.zelfProof) {
                    AuthStorage.setItem("zelfProof", response.data.zelfProof);
                }

                this.showSuccess(
                    this.translocoService.translate("saving_operations.api_key_loaded_successfully", {
                        itemName: this.saveData?.operation?.itemName || "API Key",
                    }),
                );
            } else {
                throw new Error("No API key received from server");
            }

            // Redirect after success
            setTimeout(() => {
                this.saveConfirmationService.clearSaveData();
                this.router.navigate([this.redirectUrl]);
            }, 2000);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Change password
     */
    private async changePassword(securityData: any): Promise<void> {
        try {
            const requestData = {
                ...securityData,
                identificationMethod: "email",
            };

            const response = await this.httpWrapper.sendRequest(
                "put",
                `${environment.apiUrl}${environment.endpoints.security.changePassword}`,
                requestData,
            );

            if (response && response.data) {
                this.showSuccess(
                    this.translocoService.translate("saving_operations.password_changed_successfully", {
                        itemName: this.saveData?.operation?.itemName || "Password",
                    }),
                );
                // Redirect after success
                setTimeout(() => {
                    this.saveConfirmationService.clearSaveData();
                    this.router.navigate([this.redirectUrl]);
                }, 2000);
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update theme settings
     */
    private async updateThemeSettings(themeData: any): Promise<void> {
        try {
            const requestData = {
                ...themeData,
                identificationMethod: "email",
            };

            const response = await this.httpWrapper.sendRequest("post", `${environment.apiUrl}/api/license/theme`, requestData);

            if (response && response.data) {
                this.showSuccess(
                    this.translocoService.translate("saving_operations.theme_settings_updated_successfully", {
                        itemName: this.saveData?.operation?.itemName || "Theme Settings",
                    }),
                );
                // Redirect after success
                setTimeout(() => {
                    this.saveConfirmationService.clearSaveData();
                    this.router.navigate([this.redirectUrl]);
                }, 2000);
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Create new license
     */
    private async createLicense(licenseData: any): Promise<void> {
        try {
            const response = await this.licenseService.createOrUpdateLicense(licenseData);

            const license = License.fromAPIResponseWithWrapper(response);

            // Store in localStorage
            localStorage.setItem("license", JSON.stringify(license.toJSON()));

            this.showSuccess(
                this.translocoService.translate("saving_operations.created_successfully", {
                    itemName: this.saveData?.operation?.itemName || "Configuration",
                }),
            );

            // Redirect after success
            setTimeout(() => {
                this.saveConfirmationService.clearSaveData();
                this.router.navigate([this.redirectUrl]);
            }, 2000);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update profile
     */
    private async updateProfile(profileData: any): Promise<void> {
        try {
            const requestData = {
                ...profileData,
                // Don't override the email - let the backend handle it
            };

            let response;

            const isStaff = this.authService.zelfAccount?.publicData?.accountType === "staff_account";
            const isLawyer = this.authService.isLawyer;

            if (isLawyer) {
                response = await this.lawyerService.updateProfile(requestData);
            } else if (isStaff) {
                response = await this.staffService.updateProfile(requestData);
            } else {
                response = await this.clientService.updateProfile(requestData);
            }

            if (response && response.data) {
                // Update zelfAccount if provided
                if (response.data.zelfAccount) {
                    AuthStorage.setItem("zelfAccount", JSON.stringify(response.data.zelfAccount));
                    // Update the auth service
                    this.authService.setSession({
                        zelfProof: response.data.zelfProof || this.authService.zelfProof,
                        zelfAccount: response.data.zelfAccount,
                    });
                }

                // Update zelfProof if provided
                if (response.data.zelfProof) {
                    AuthStorage.setItem("zelfProof", response.data.zelfProof);
                }

                this.showSuccess(
                    this.translocoService.translate("saving_operations.updated_successfully", {
                        itemName: this.saveData?.operation?.itemName || "Profile",
                    }),
                );

                // Redirect after success
                setTimeout(() => {
                    this.saveConfirmationService.clearSaveData();
                    this.router.navigate([this.redirectUrl]);
                }, 2000);
            } else {
                throw new Error("No response data received from server");
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Show success message
     */
    private showSuccess(message: string): void {
        this.showBiometricModal = false;
        this.isSuccess = true;
        this.alertMessage = message;
        this.alertType = "success";
        this.showAlert = true;
        setTimeout(() => {
            this.showAlert = false;
        }, 5000);
    }

    /**
     * Invite staff member
     */
    private async inviteStaff(staffData: any): Promise<void> {
        const response: any = await this.staffService.inviteStaff({
            staffEmail: staffData.staffEmail,
            staffPhone: staffData.staffPhone,
            staffCountryCode: staffData.staffCountryCode,
            staffName: staffData.staffName,
            role: staffData.role,
            faceBase64: staffData.faceBase64,
            masterPassword: staffData.masterPassword,
            isResend: staffData.isResend,
        });

        this.showSuccess("Invitation sent successfully!");
        setTimeout(() => {
            this.router.navigate([this.saveData?.redirectUrl || "/settings/team"]);
        }, 2000);
    }

    /**
     * Remove staff member
     */
    private async removeStaff(staffData: any): Promise<void> {
        await this.staffService.removeStaff({
            staffEmail: staffData.staffEmail,
            faceBase64: staffData.faceBase64,
            masterPassword: staffData.masterPassword,
        });

        this.showSuccess("Staff member removed successfully!");
        setTimeout(() => {
            this.router.navigate([this.saveData?.redirectUrl || "/settings/team"]);
        }, 2000);
    }


    /**
     * Invite lawyer
     */
    private async inviteLawyer(staffData: any): Promise<void> {
        await this.lawyerService.inviteLawyer({
            lawyerEmail: staffData.staffEmail,
            lawyerPhone: staffData.staffPhone,
            lawyerCountryCode: staffData.staffCountryCode,
            lawyerName: staffData.staffName,
            domain: "zelf",
            faceBase64: staffData.faceBase64,
            masterPassword: staffData.masterPassword,
        });

        this.showSuccess("Lawyer invitation sent successfully!");
        setTimeout(() => {
            this.router.navigate([this.saveData?.redirectUrl || "/zelf-legacy/lawyers"]);
        }, 2000);
    }

    /**
     * Remove lawyer
     */
    private async removeLawyer(staffData: any): Promise<void> {
        await this.lawyerService.removeLawyer({
            lawyerEmail: staffData.staffEmail,
            faceBase64: staffData.faceBase64,
            masterPassword: staffData.masterPassword,
        });

        this.showSuccess("Lawyer removed successfully!");
        setTimeout(() => {
            this.router.navigate([this.saveData?.redirectUrl || "/zelf-legacy/lawyers"]);
        }, 2000);
    }
    /**
     * Update staff member role
     */
    private async updateStaffRole(staffData: any): Promise<void> {
        await this.staffService.updateRole({
            staffEmail: staffData.staffEmail,
            newRole: staffData.newRole,
            faceBase64: staffData.faceBase64,
            masterPassword: staffData.masterPassword,
        });

        this.showSuccess("Role updated successfully!");
        setTimeout(() => {
            this.router.navigate([this.saveData?.redirectUrl || "/settings/team"]);
        }, 2000);
    }

    /**
     * Show error message
     */
    private _handleSaveError(error: unknown, fallback: string): void {
        if (isBiometricApiError(error) && this.biometricVerification) {
            this.biometricVerification.handleApiError(error);
            this.isLoading = false;
            return;
        }

        this.showBiometricModal = false;
        this.showError(this._apiErrorMessage(error, fallback));
    }

    private _apiErrorMessage(error: unknown, fallback: string): string {
        const body = (error as { error?: { validationError?: string; message?: string }; message?: string }) || {};
        const fromBody = body.error?.validationError || body.error?.message || body.message;

        return typeof fromBody === "string" && fromBody.trim() ? fromBody : fallback;
    }

    private showError(message: string): void {
        this.alertMessage = message;
        this.alertType = "error";
        this.showAlert = true;
        setTimeout(() => {
            this.showAlert = false;
        }, 5000);
    }

    /**
     * Handle tag extension operation (free owner extension)
     */
    private async handleTagExtensionOperation(biometricData: BiometricData): Promise<void> {
        if (!this.saveData?.tagExtensionData) {
            this.showError("No tag extension data available");
            this.isLoading = false;
            return;
        }

        try {
            const ext = this.saveData.tagExtensionData;
            const duration =
                ext.duration === 0 || ext.duration === "0" ? "lifetime" : ext.duration;

            const extensionData = {
                ...ext,
                duration,
                faceBase64: biometricData.faceBase64,
                password: biometricData.password || this.masterPassword,
            };

            await this.tagsService.extendLicenseForOwner(extensionData);

            this.showSuccess("License extended successfully!");

            setTimeout(() => {
                this.saveConfirmationService.clearSaveData();
                this.router.navigate([this.redirectUrl]);
            }, 2000);
        } catch (error) {
            let errorMessage = "Failed to extend license. Please try again.";

            if (error?.message) {
                if (error.message.includes("domain_not_owned")) {
                    errorMessage = "You do not own this domain.";
                } else if (error.message.includes("license_not_found")) {
                    errorMessage = "License not found. Please verify your credentials.";
                } else if (error.message.includes("tag_not_found")) {
                    errorMessage = "Tag not found.";
                } else if (error.message.includes("error_decrypting")) {
                    errorMessage = "Biometric verification failed. Please check your face image and master password.";
                } else {
                    errorMessage = error.message;
                }
            }

            this._handleSaveError(error, errorMessage);
        } finally {
            this.isLoading = false;
        }
    }
}
