import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewEncapsulation, Inject } from "@angular/core";
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatOptionModule } from "@angular/material/core";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatTabsModule } from "@angular/material/tabs";
import { Router } from "@angular/router";
import { TranslocoModule } from "@jsverse/transloco";
import { LawyerService } from "./lawyer.service";
import { SaveConfirmationService } from "app/core/services/save-confirmation.service";
import { cleanedCountryCodes } from "app/core/cleaned_country_codes";

@Component({
	selector: "invite-lawyer-dialog",
	template: `
		<div class="flex flex-col max-h-[90vh]">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="wise-section-title">{{ 'lawyers.invite.title' | transloco }}</h2>
				<p class="text-sm text-gray-500 mt-1">{{ 'lawyers.invite.description' | transloco }}</p>
			</div>
			<div class="p-6 overflow-y-auto flex-1">
				<form [formGroup]="inviteForm" class="space-y-5">
					<mat-form-field class="w-full" appearance="outline" [subscriptSizing]="'dynamic'">
						<mat-label>{{ 'lawyers.invite.emailLabel' | transloco }}</mat-label>
						<input matInput formControlName="email" placeholder="lawyer@firm.com" />
						<mat-icon matPrefix class="mr-2 text-gray-400">mail</mat-icon>
					</mat-form-field>
					<mat-form-field class="w-full" appearance="outline" [subscriptSizing]="'dynamic'">
						<mat-label>{{ 'lawyers.invite.fullNameLabel' | transloco }}</mat-label>
						<input matInput formControlName="name" placeholder="Carlos Reyes" />
						<mat-icon matPrefix class="mr-2 text-gray-400">person</mat-icon>
					</mat-form-field>
					<div class="space-y-2">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
						<div class="flex gap-2 items-start">
							<div class="relative country-code-field" style="width: 140px">
								<mat-form-field class="w-full" appearance="outline" [subscriptSizing]="'dynamic'">
									<input matInput type="text" [(ngModel)]="countryCodeSearchTerm" [ngModelOptions]="{ standalone: true }" (focus)="showCountryDropdown = true" (blur)="onCountryCodeBlur($event)" (input)="filterCountryCodes()" placeholder="🇺🇸 +1" />
								</mat-form-field>
								@if (showCountryDropdown && filteredCountryCodes.length > 0) {
									<div class="absolute z-50 w-64 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto" style="top: 100%">
										@for (country of filteredCountryCodes; track country.code + country.country) {
											<button type="button" (click)="selectCountryCode(country)" class="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm">
												<span class="text-xl">{{ country.flag }}</span>
												<span class="flex-1 text-gray-900 dark:text-white">{{ country.country }}</span>
												<span class="text-gray-500 dark:text-gray-400">{{ country.code }}</span>
											</button>
										}
									</div>
								}
							</div>
							<mat-form-field class="flex-1" appearance="outline" [subscriptSizing]="'dynamic'">
								<input matInput formControlName="phone" placeholder="1234567890" />
							</mat-form-field>
						</div>
					</div>
				</form>
			</div>
			<div class="bg-gray-50 dark:bg-slate-800/50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
				<button mat-button (click)="dialogRef.close()" class="!rounded-full text-gray-600">Cancel</button>
				<button mat-flat-button (click)="proceed()" [disabled]="inviteForm.invalid" class="!rounded-full !bg-lime-voltage dark:!bg-lime-voltage !text-forest-ink dark:!text-forest-ink !font-semibold !px-6">Continue</button>
			</div>
		</div>
	`,
	standalone: true,
	imports: [CommonModule, FormsModule, ReactiveFormsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatButtonModule, MatDialogModule, TranslocoModule],
})
export class InviteLawyerDialogComponent {
	inviteForm: FormGroup;
	countryCodes = cleanedCountryCodes;
	filteredCountryCodes: any[] = [];
	countryCodeSearchTerm = "";
	showCountryDropdown = false;

	constructor(public dialogRef: MatDialogRef<InviteLawyerDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any, private _formBuilder: FormBuilder) {
		this.inviteForm = this._formBuilder.group({
			email: ["", [Validators.required, Validators.email]],
			name: ["", [Validators.required]],
			countryCode: ["+1", Validators.required],
			phone: [""],
		});
		this.filteredCountryCodes = this.countryCodes;
	}

	proceed(): void {
		if (this.inviteForm.valid) this.dialogRef.close(this.inviteForm.value);
	}

	filterCountryCodes(): void {
		if (!this.countryCodeSearchTerm.trim()) { this.filteredCountryCodes = this.countryCodes; return; }
		const term = this.countryCodeSearchTerm.toLowerCase().trim();
		this.filteredCountryCodes = this.countryCodes.filter((c) => c.country.toLowerCase().includes(term) || c.code.toLowerCase().includes(term));
	}

	selectCountryCode(country: any): void {
		this.inviteForm.patchValue({ countryCode: country.code });
		this.countryCodeSearchTerm = `${country.flag} ${country.code}`;
		this.filteredCountryCodes = this.countryCodes;
		this.showCountryDropdown = false;
	}

	onCountryCodeBlur(event: FocusEvent): void {
		const target = event.relatedTarget as HTMLElement;
		if (!target?.closest(".country-code-field")) setTimeout(() => (this.showCountryDropdown = false), 200);
	}
}

@Component({
	selector: "zelf-legacy-lawyers",
	templateUrl: "./lawyers.component.html",
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [
		CommonModule, FormsModule, ReactiveFormsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatButtonModule,
		MatSelectModule, MatOptionModule, MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule, MatDialogModule, MatTabsModule, TranslocoModule,
	],
})
export class LawyersComponent implements OnInit {
	lawyers: any[] = [];
	invitations: any[] = [];
	isLoading = false;
	searchQuery = "";
	searchDomain = "zelf";
	showFilters = false;
	filterCity = "";
	filterCountry = "";
	filterMaxRate: number | null = null;
	activeTab = 0;

	selectedLawyer: any = null;
	selectedLawyerReputation: any = null;

	constructor(
		private _lawyerService: LawyerService,
		private _cdr: ChangeDetectorRef,
		private _snackBar: MatSnackBar,
		private _dialog: MatDialog,
		private _saveConfirmationService: SaveConfirmationService,
		private _router: Router,
	) {}

	ngOnInit(): void {
		this.loadAll();
	}

	async loadAll(): Promise<void> {
		this.isLoading = true;
		this._cdr.markForCheck();

		try {
			const response = await this._lawyerService.getAll({ domain: this.searchDomain, includeInvitations: true });
			const data = response?.data || response;
			this.lawyers = data?.lawyers || [];
			this.invitations = data?.invitations || [];
		} catch (err) {
			console.error("Error loading lawyers:", err);
			this._snackBar.open("Failed to load lawyers", "Close", { duration: 3000 });
		} finally {
			this.isLoading = false;
			this._cdr.markForCheck();
		}
	}

	async performSearch(): Promise<void> {
		this.isLoading = true;
		this._cdr.markForCheck();

		try {
			const params: any = { domain: this.searchDomain };
			if (this.searchQuery) params.q = this.searchQuery;
			if (this.filterCity) params.city = this.filterCity;
			if (this.filterCountry) params.country = this.filterCountry;
			if (this.filterMaxRate) params.maxRate = this.filterMaxRate;

			const response = await this._lawyerService.search(params);
			this.lawyers = response?.data?.data || response?.data || [];
			this.activeTab = 0;
		} catch (err) {
			console.error("Search error:", err);
			this._snackBar.open("Search failed", "Close", { duration: 3000 });
		} finally {
			this.isLoading = false;
			this._cdr.markForCheck();
		}
	}

	async viewLawyer(lawyer: any): Promise<void> {
		this.selectedLawyer = lawyer;
		this.selectedLawyerReputation = null;
		this._cdr.markForCheck();

		const walletAddress = lawyer.publicData?.lawyerWalletAddress;
		if (walletAddress) {
			try {
				const rep = await this._lawyerService.getReputation(walletAddress);
				this.selectedLawyerReputation = rep?.data || rep;
				this._cdr.markForCheck();
			} catch {}
		}
	}

	openInviteDialog(): void {
		const dialogRef = this._dialog.open(InviteLawyerDialogComponent, { width: "600px", maxWidth: "90vw", data: {} });

		dialogRef.afterClosed().subscribe((formData) => {
			if (formData) {
				this._saveConfirmationService.setSaveData({
					domain: null, domainConfig: null,
					redirectUrl: "/zelf-legacy/lawyers",
					operation: { title: "Invite Lawyer", description: "Verify your identity to send the invitation", action: "inviting", itemName: "lawyer" },
					staffData: { staffEmail: formData.email, staffPhone: formData.phone, staffCountryCode: formData.countryCode, staffName: formData.name, role: "lawyer", operation: "inviteLawyer" },
				});
				this._router.navigate(["/save-confirmation"]);
			}
		});
	}

	initiateRemove(lawyer: any): void {
		const email = lawyer.publicData?.lawyerEmail || "";
		const name = lawyer.publicData?.lawyerName || "this lawyer";
		this._saveConfirmationService.setSaveData({
			domain: null, domainConfig: null,
			redirectUrl: "/zelf-legacy/lawyers",
			operation: { title: "Remove Lawyer", description: `Verify your identity to remove ${name}`, action: "removing", itemName: "lawyer" },
			staffData: { staffEmail: email, staffPhone: "", staffName: name, role: "", operation: "removeLawyer" },
		});
		this._router.navigate(["/save-confirmation"]);
	}

	initiateResend(invitation: any): void {
		const email = invitation.publicData?.lawyerEmail || "";
		const name = invitation.publicData?.lawyerName || "this lawyer";
		this._saveConfirmationService.setSaveData({
			domain: null, domainConfig: null,
			redirectUrl: "/zelf-legacy/lawyers",
			operation: { title: "Resend Invitation", description: `Verify your identity to resend the invitation to ${name}`, action: "resending", itemName: "invitation" },
			staffData: { staffEmail: email, staffPhone: "", staffName: name, role: "lawyer", operation: "inviteLawyer", isResend: true },
		});
		this._router.navigate(["/save-confirmation"]);
	}

	trackByFn(index: number, item: any): any {
		return item.id || index;
	}
}
