import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, ChangeDetectorRef } from "@angular/core";
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatOptionModule } from "@angular/material/core";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { Router } from "@angular/router";
import { StaffService } from "app/core/services/staff.service";
import { SaveConfirmationService } from "app/core/services/save-confirmation.service";
import { cleanedCountryCodes } from "app/core/cleaned_country_codes";
import { Inject } from "@angular/core";

// Update Role Dialog Component
@Component({
	selector: "update-role-dialog",
	template: `
		<div class="flex flex-col">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="wise-section-title">Update Member Role</h2>
			</div>
			<div class="p-6">
				<form [formGroup]="roleForm" class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select New Role</label>
						<div class="grid grid-cols-1 gap-3">
							@for (role of data.roles; track role.value) {
								<div
									(click)="selectRole(role.value)"
									class="cursor-pointer border rounded-xl p-3 flex items-start gap-3 transition-all"
									[class]="
										roleForm.get('role').value === role.value
											? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
											: 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
									"
								>
									<div
										class="w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0"
										[class]="roleForm.get('role').value === role.value ? 'border-blue-500' : 'border-gray-400'"
									>
										@if (roleForm.get("role").value === role.value) {
											<div class="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
										}
									</div>
									<div>
										<div class="font-semibold text-sm" [class.text-blue-700]="roleForm.get('role').value === role.value">
											{{ role.label }}
										</div>
										<div class="text-xs text-gray-500 mt-0.5">{{ role.description }}</div>
									</div>
								</div>
							}
						</div>
					</div>
				</form>
			</div>
			<div class="bg-gray-50 dark:bg-slate-800/50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
				<button mat-button (click)="dialogRef.close()" class="!rounded-full text-gray-600">Cancel</button>
				<button
					mat-flat-button
					(click)="proceed()"
					[disabled]="roleForm.invalid"
					class="!rounded-full !bg-lime-voltage dark:!bg-lime-voltage !text-forest-ink dark:!text-forest-ink !font-semibold !px-6"
				>
					Update Role
				</button>
			</div>
		</div>
	`,
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule, MatButtonModule],
})
export class UpdateRoleDialogComponent {
	roleForm: FormGroup;

	constructor(
		public dialogRef: MatDialogRef<UpdateRoleDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any,
		private _formBuilder: FormBuilder
	) {
		this.roleForm = this._formBuilder.group({
			role: [data.currentRole || "read", Validators.required],
		});
	}

	selectRole(roleValue: string): void {
		this.roleForm.patchValue({ role: roleValue });
	}

	proceed(): void {
		if (this.roleForm.valid) {
			this.dialogRef.close(this.roleForm.value.role);
		}
	}
}

@Component({
	selector: "settings-team",
	templateUrl: "./team.component.html",
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		MatFormFieldModule,
		MatIconModule,
		MatInputModule,
		MatButtonModule,
		MatSelectModule,
		MatOptionModule,
		MatProgressSpinnerModule,
		MatSnackBarModule,
		MatTooltipModule,
		MatDialogModule,
	],
})
export class SettingsTeamComponent implements OnInit {
	members: any[] = [];
	roles: any[];
	isLoading: boolean = false;

	/**
	 * Constructor
	 */
	constructor(
		private _staffService: StaffService,
		private _formBuilder: FormBuilder,
		private _cdr: ChangeDetectorRef,
		private _snackBar: MatSnackBar,
		private _dialog: MatDialog,
		private _saveConfirmationService: SaveConfirmationService,
		private _router: Router
	) {}

	// -----------------------------------------------------------------------------------------------------
	// @ Lifecycle hooks
	// -----------------------------------------------------------------------------------------------------

	/**
	 * On init
	 */
	ngOnInit(): void {
		// Setup the roles
		this.roles = [
			{
				label: "Read",
				value: "read",
				description: "Can read client data settings.",
			},
			{
				label: "Write",
				value: "write",
				description: "Can read and update client data settings.",
			},
			{
				label: "Admin",
				value: "admin",
				description: "Can manage all settings including team members.",
			},
		];

		// Load staff
		this.loadStaff();
	}

	// -----------------------------------------------------------------------------------------------------
	// @ Public methods
	// -----------------------------------------------------------------------------------------------------

	async loadStaff(): Promise<void> {
		this.isLoading = true;
		this._cdr.markForCheck();

		try {
			const data = await this._staffService.getStaff();

			const rawMembers = Array.isArray(data) ? data : data.data || [];
			this.members = rawMembers.map((member: any) => {
				// Check for pending status in various possible locations
				const isPending =
					member.invitationStatus === "pending" ||
					member.publicData?.invitationStatus === "pending" ||
					member.metadata?.invitationStatus === "pending";

				return {
					...member,
					isPending,
				};
			});
			this.isLoading = false;
			this._cdr.markForCheck();
		} catch (err) {
			console.error("Error loading staff", err);
			this.isLoading = false;
			this._cdr.markForCheck();
		}
	}

	openInviteModal(): void {
		const dialogRef = this._dialog.open(InviteStaffDialogComponent, {
			width: "600px",
			maxWidth: "90vw",
			data: { roles: this.roles },
			panelClass: "invite-staff-dialog",
		});

		dialogRef.afterClosed().subscribe((formData) => {
			if (formData) {
				// Navigate to save-confirmation with staff data
				this._saveConfirmationService.setSaveData({
					domain: null,
					domainConfig: null,
					redirectUrl: "/settings/team",
					operation: {
						title: "Invite Team Member",
						description: "Verify your identity to send the invitation",
						action: "inviting",
						itemName: "team member",
					},
					staffData: {
						staffEmail: formData.email,
						staffPhone: formData.phone,
						staffCountryCode: formData.countryCode,
						staffName: formData.name,
						role: formData.role,
						operation: "inviteStaff",
					},
				});
				this._router.navigate(["/save-confirmation"]);
			}
		});
	}

	initiateRemove(member: any): void {
		const email = member.publicData?.staffEmail || member.publicData?.email || member.email || member.staffEmail;
		const name = member.publicData?.staffName || member.name;

		// Navigate to save-confirmation with remove staff data
		this._saveConfirmationService.setSaveData({
			domain: null,
			domainConfig: null,
			redirectUrl: "/settings/team",
			operation: {
				title: "Remove Team Member",
				description: `Verify your identity to remove ${name}`,
				action: "removing",
				itemName: "team member",
			},
			staffData: {
				staffEmail: email,
				staffPhone: "", // Not needed for removal
				staffName: name,
				role: "",
				operation: "removeStaff",
			},
		});
		this._router.navigate(["/save-confirmation"]);
	}

	initiateResend(member: any): void {
		const email = member.publicData?.staffEmail || member.publicData?.email || member.email || member.staffEmail;
		const name = member.publicData?.staffName || member.name;
		const phone = member.publicData?.staffPhone || member.phone || "";
		// Extract role, handling potentially inconsistent data structures
		const role = member.publicData?.staffRole || member.role || "read";

		this._saveConfirmationService.setSaveData({
			domain: null,
			domainConfig: null,
			redirectUrl: "/settings/team",
			operation: {
				title: "Resend Invitation",
				description: `Verify your identity to resend the invitation to ${name}`,
				action: "resending",
				itemName: "invitation",
			},
			staffData: {
				staffEmail: email,
				staffPhone: phone,
				staffName: name,
				role: role,
				operation: "inviteStaff", // Re-use invite logic
				isResend: true,
			},
		});
		this._router.navigate(["/save-confirmation"]);
	}

	initiateUpdateRole(member: any): void {
		const email = member.publicData?.staffEmail || member.publicData?.email || member.email || member.staffEmail;
		const name = member.publicData?.staffName || member.name;
		const currentRole = member.publicData?.staffRole || member.role;

		const dialogRef = this._dialog.open(UpdateRoleDialogComponent, {
			width: "500px",
			maxWidth: "90vw",
			data: { roles: this.roles, currentRole },
			panelClass: "update-role-dialog",
		});

		dialogRef.afterClosed().subscribe((newRole) => {
			if (newRole && newRole !== currentRole) {
				// Navigate to save-confirmation with update role data
				this._saveConfirmationService.setSaveData({
					domain: null,
					domainConfig: null,
					redirectUrl: "/settings/team",
					operation: {
						title: "Update Team Member Role",
						description: `Verify your identity to change ${name}'s role to ${newRole}`,
						action: "updating",
						itemName: "team member role",
					},
					staffData: {
						staffEmail: email,
						staffPhone: "",
						staffName: name,
						role: currentRole,
						operation: "updateRole",
						newRole: newRole,
					},
				});
				this._router.navigate(["/save-confirmation"]);
			}
		});
	}

	/**
	 * Track by function for ngFor loops
	 *
	 * @param index
	 * @param item
	 */
	trackByFn(index: number, item: any): any {
		return item.id || index;
	}
}

// ============================================================================
// Invite Staff Dialog Component (Simplified - No verification here)
// ============================================================================
@Component({
	selector: "invite-staff-dialog",
	template: `
		<div class="flex flex-col max-h-[90vh]">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="wise-section-title">Invite New Member</h2>
			</div>

			<div class="p-6 overflow-y-auto flex-1">
				<form [formGroup]="inviteForm" class="space-y-5">
					<mat-form-field class="w-full" appearance="outline" [subscriptSizing]="'dynamic'">
						<mat-label>Email Address</mat-label>
						<input matInput formControlName="email" placeholder="colleague@company.com" />
						<mat-icon matPrefix class="mr-2 text-gray-400">mail</mat-icon>
					</mat-form-field>

					<mat-form-field class="w-full" appearance="outline" [subscriptSizing]="'dynamic'">
						<mat-label>Full Name</mat-label>
						<input matInput formControlName="name" placeholder="John Doe" />
						<mat-icon matPrefix class="mr-2 text-gray-400">person</mat-icon>
					</mat-form-field>

					<!-- Country Code + Phone Number -->
					<div class="space-y-2">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
						<div class="flex gap-2 items-start">
							<!-- Country Code Selector -->
							<div class="relative country-code-field" style="width: 140px">
								<mat-form-field class="w-full" appearance="outline" [subscriptSizing]="'dynamic'">
									<input
										matInput
										type="text"
										[(ngModel)]="countryCodeSearchTerm"
										[ngModelOptions]="{ standalone: true }"
										(focus)="showCountryDropdown = true"
										(blur)="onCountryCodeBlur($event)"
										(input)="filterCountryCodes()"
										placeholder="🇺🇸 +1"
									/>
								</mat-form-field>
								@if (showCountryDropdown && filteredCountryCodes.length > 0) {
									<div
										class="absolute z-50 w-64 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
										style="top: 100%"
									>
										@for (country of filteredCountryCodes; track country.code + country.country) {
											<button
												type="button"
												(click)="selectCountryCode(country)"
												class="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm"
											>
												<span class="text-xl">{{ country.flag }}</span>
												<span class="flex-1 text-gray-900 dark:text-white">{{ country.country }}</span>
												<span class="text-gray-500 dark:text-gray-400">{{ country.code }}</span>
											</button>
										}
									</div>
								}
							</div>

							<!-- Phone Number Input -->
							<mat-form-field class="flex-1" appearance="outline" [subscriptSizing]="'dynamic'">
								<input matInput formControlName="phone" placeholder="1234567890" />
							</mat-form-field>
						</div>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Access Role</label>
						<div class="grid grid-cols-1 gap-3">
							@for (role of data.roles; track role.value) {
								<div
									(click)="selectRole(role.value)"
									class="cursor-pointer border rounded-xl p-3 flex items-start gap-3 transition-all"
									[class]="
										inviteForm.get('role').value === role.value
											? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
											: 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
									"
								>
									<div
										class="w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0"
										[class]="inviteForm.get('role').value === role.value ? 'border-blue-500' : 'border-gray-400'"
									>
										@if (inviteForm.get("role").value === role.value) {
											<div class="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
										}
									</div>
									<div>
										<div class="font-semibold text-sm" [class.text-blue-700]="inviteForm.get('role').value === role.value">
											{{ role.label }}
										</div>
										<div class="text-xs text-gray-500 mt-0.5">{{ role.description }}</div>
									</div>
								</div>
							}
						</div>
					</div>
				</form>
			</div>

			<div class="bg-gray-50 dark:bg-slate-800/50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
				<button mat-button (click)="dialogRef.close()" class="!rounded-full text-gray-600">Cancel</button>
				<button
					mat-flat-button
					(click)="proceed()"
					[disabled]="inviteForm.invalid"
					class="!rounded-full !bg-lime-voltage dark:!bg-lime-voltage !text-forest-ink dark:!text-forest-ink !font-semibold !px-6"
				>
					Continue
				</button>
			</div>
		</div>
	`,
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		MatFormFieldModule,
		MatIconModule,
		MatInputModule,
		MatButtonModule,
		MatSelectModule,
		MatOptionModule,
		MatDialogModule,
	],
})
export class InviteStaffDialogComponent {
	inviteForm: FormGroup;

	// Country code functionality
	countryCodes = cleanedCountryCodes;
	filteredCountryCodes: any[] = [];
	countryCodeSearchTerm = "";
	showCountryDropdown = false;

	constructor(
		public dialogRef: MatDialogRef<InviteStaffDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any,
		private _formBuilder: FormBuilder
	) {
		this.inviteForm = this._formBuilder.group({
			email: ["", [Validators.required, Validators.email]],
			name: ["", [Validators.required]],
			countryCode: ["+1", Validators.required],
			phone: ["", [Validators.required]],
			role: ["read", [Validators.required]],
		});
		this.filteredCountryCodes = this.countryCodes;
	}

	selectRole(roleValue: string): void {
		this.inviteForm.patchValue({ role: roleValue });
	}

	proceed(): void {
		if (this.inviteForm.valid) {
			this.dialogRef.close(this.inviteForm.value);
		}
	}

	// Country code methods
	filterCountryCodes(): void {
		if (!this.countryCodeSearchTerm.trim()) {
			this.filteredCountryCodes = this.countryCodes;
			return;
		}

		const searchTerm = this.countryCodeSearchTerm.toLowerCase().trim();
		this.filteredCountryCodes = this.countryCodes.filter(
			(country) => country.country.toLowerCase().includes(searchTerm) || country.code.toLowerCase().includes(searchTerm)
		);
	}

	selectCountryCode(country: any): void {
		this.inviteForm.patchValue({ countryCode: country.code });
		this.countryCodeSearchTerm = `${country.flag} ${country.code}`;
		this.filteredCountryCodes = this.countryCodes;
		this.showCountryDropdown = false;
	}

	onCountryCodeBlur(event: FocusEvent): void {
		const target = event.relatedTarget as HTMLElement;
		const countryCodeField = target?.closest(".country-code-field");
		if (!countryCodeField) {
			setTimeout(() => {
				this.showCountryDropdown = false;
			}, 200);
		}
	}
}
