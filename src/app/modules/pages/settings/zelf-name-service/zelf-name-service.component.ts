import { CommonModule } from "@angular/common";
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewEncapsulation } from "@angular/core";
import { FormControl, FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from "@angular/forms";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatIconModule } from "@angular/material/icon";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { Router, ActivatedRoute } from "@angular/router";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";

import { SaveConfirmationService } from "app/core/services/save-confirmation.service";
import { HttpWrapperService } from "app/http-wrapper.service";
import { DomainConfig, License, NetworkConfig } from "../license/license.class";
import { LicenseService } from "../license/license.service";
import { ValidationRulesComponent } from "./components/validation-rules/validation-rules.component";
import { BlockchainNetworksComponent } from "./components/blockchain-networks/blockchain-networks.component";
import { PaymentConfigurationComponent } from "./components/payment-configuration/payment-configuration.component";
import { PricingColumnKey, PricingTableComponent, PricingTableTab } from "./components/pricing-table/pricing-table.component";
import { StorageOptionsComponent } from "./components/storage-options/storage-options.component";
import { AnalyticsOnboardingService } from "app/modules/dashboards/analytics/analytics-onboarding.service";

export interface PricingRow {
	length: string;
	oneYear: number;
	twoYears: number;
	threeYears: number;
	fourYears: number;
	fiveYears: number;
	lifetime: number;
}

export interface WhitelistItem {
	domain: string;
	discount: string | number;
	type: string;
}

@Component({
	selector: "settings-zelf-name-service",
	templateUrl: "./zelf-name-service.component.html",
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		MatIconModule,
		MatSlideToggleModule,
		MatCheckboxModule,
		TranslocoModule,
		ValidationRulesComponent,
		BlockchainNetworksComponent,
		PaymentConfigurationComponent,
		PricingTableComponent,
		StorageOptionsComponent,
	],
})
export class SettingsZelfNameServiceComponent implements OnInit, AfterViewInit {
	accountForm: UntypedFormGroup;
	alertMessage: string = "";
	alertType: "success" | "error" = "success";
	currentLicense: License | null = null;
	isLoading: boolean = false;
	pricingTableRows: PricingRow[] = [];
	premiumPricingRows: PricingRow[] = [];
	unlimitedPricingRows: PricingRow[] = [];
	pricingTableTab: PricingTableTab = "tags";
	pricingDirty = false;
	reservedWords: string[] = ["www", "api", "admin", "support", "help"];
	showAlert: boolean = false;
	whitelistItems: WhitelistItem[] = [];
	newWhitelistItem: WhitelistItem = { domain: "", discount: "", type: "percentage" };

	zelfkeysPlans: any[] = [];

	inappropriateWords = [
		"dick",
		"vagina",
		"porn",
		"sex",
		"fuck",
		"shit",
		"bitch",
		"ass",
		"damn",
		"hell",
		"crap",
		"piss",
		"bastard",
		"whore",
		"slut",
		"fag",
		"nigger",
		"retard",
		"idiot",
		"stupid",
		"moron",
		"dumb",
		"hate",
		"kill",
		"die",
		"death",
		"murder",
		"suicide",
	];

	constructor(
		private _formBuilder: UntypedFormBuilder,
		private _router: Router,
		private _activatedRoute: ActivatedRoute,
		private _saveConfirmationService: SaveConfirmationService,
		private _translocoService: TranslocoService,
		private _cdr: ChangeDetectorRef,
		private _licenseService: LicenseService,
		private _httpWrapper: HttpWrapperService,
		private _analyticsOnboardingService: AnalyticsOnboardingService
	) {}

	get networksFormGroup(): UntypedFormGroup {
		return this.accountForm.get("networks") as UntypedFormGroup;
	}

	get walletNetworksFormGroup(): UntypedFormGroup {
		return this.accountForm.get("walletNetworks") as UntypedFormGroup;
	}

	ngOnInit(): void {
		this._analyticsOnboardingService.markVisited("zelfNameService");
		this.initializeWhitelistItems();
		this.initializePricingTable();
		this.createEmptyForm();
	}

	ngAfterViewInit(): void {
		this.loadLicense().then(() => {
			this.populateFormFromLicense();
		});
	}

	private createEmptyForm(): void {
		this.accountForm = this._formBuilder.group({
			// Basic Information
			domain: ["", [Validators.required, Validators.pattern(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/)]],
			status: [{ value: "active", disabled: true }],
			owner: ["zelf-team", Validators.required],
			description: ["Official Zelf domain", Validators.required],

			// Features
			znsEnabled: [true],
			zelfkeysEnabled: [true],

			// Validation Rules
			minLength: [3, [Validators.required, Validators.min(1)]],
			maxLength: [27, [Validators.required, Validators.min(1), Validators.max(27)]],
			holdSuffix: [".hold", Validators.required],
			contentFilterEnabled: [true],

			// Storage Options (ZNS)
			ipfsEnabled: [true],
			arweaveEnabled: [true],
			walrusEnabled: [true],
			keyPrefix: ["tagName", Validators.required],

			// Storage Options (ZelfKeys)
			zelfkeysIpfsEnabled: [true],
			zelfkeysArweaveEnabled: [true],
			zelfkeysWalrusEnabled: [true],
			zelfkeysKeyPrefix: ["tagName", Validators.required],

			// Payment Settings
			cryptoEnabled: [true],
			stripeEnabled: [true],
			networks: this.createNetworksFormGroup(),
			walletNetworks: this.createNetworksFormGroup(null, true),

			// Dates
			startDate: [{ value: "", disabled: true }],
			endDate: [{ value: "", disabled: true }],

			// Metadata
			launchDate: ["2023-01-01"],
			version: ["1.0.0", Validators.required],
			documentation: ["https://docs.zelf.world"],
			community: [""],
			enterprise: [""],
			support: ["standard"],
		});

		this.addWhitelistFormControls();
	}

	get networkKeys(): string[] {
		if (!this.networksFormGroup) return [];
		return Object.keys(this.networksFormGroup.controls);
	}

	getNetworkGroup(key: string): UntypedFormGroup {
		return this.networksFormGroup.get(key) as UntypedFormGroup;
	}

	getNetworkLabel(key: string): string {
		const labels: { [key: string]: string } = {
			ethereum: "Ethereum",
			solana: "Solana",
			bitcoin: "Bitcoin",
			blockdag: "BlockDAG",
			avalanche: "Avalanche",
			bsc: "BSC",
			polygon: "Polygon",
			sui: "Sui",
		};
		return labels[key] || key;
	}

	getNetworkStyle(key: string): { colorClass: string; initials: string; icon?: string } {
		const styles: { [key: string]: { colorClass: string; initials: string; icon?: string } } = {
			ethereum: { colorClass: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300", initials: "ETH" },
			solana: { colorClass: "text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300", initials: "SOL" },
			bitcoin: { colorClass: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300", initials: "BTC" },
			blockdag: { colorClass: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300", initials: "BDAG" },
			avalanche: { colorClass: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300", initials: "AVAX" },
			bsc: { colorClass: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300", initials: "BSC" },
			polygon: { colorClass: "text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300", initials: "POL" },
			sui: { colorClass: "text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-300", initials: "SUI" },
		};
		return styles[key] || { colorClass: "text-gray-600 bg-gray-100", initials: key.substring(0, 2).toUpperCase() };
	}

	toggleNetwork(key: string): void {
		const group = this.getNetworkGroup(key);
		const enabled = group.get("enabled")?.value;
		group.get("nativeCurrency")?.get("enabled")?.setValue(enabled);
		if (group.get("altCoins")) {
			group.get("altCoins")?.get("enabled")?.setValue(enabled);
		}
	}

	getWalletNetworkGroup(key: string): UntypedFormGroup {
		return this.walletNetworksFormGroup.get(key) as UntypedFormGroup;
	}

	toggleWalletNetwork(key: string): void {
		// Wallet networks only have 'enabled' flag relevant for display
		// Native currency and alt coins are not managed in this view anymore
		const group = this.getWalletNetworkGroup(key);
		const enabled = group.get("enabled")?.value;
		// We can still sync internal state if needed, but primarily we just care about the network enabled state.
	}

	private createNetworksFormGroup(networks: any = null, simple: boolean = false): UntypedFormGroup {
		const group = this._formBuilder.group({});
		const defaultLicense = License.createEmpty("temp");
		const defaultNetworks = networks || defaultLicense.getNetworks();

		Object.keys(defaultNetworks).forEach((key) => {
			const net = defaultNetworks[key];
			if (!key.startsWith("other_")) {
				if (simple) {
					group.addControl(
						key,
						this._formBuilder.group({
							enabled: [net.enabled],
						}),
					);
				} else {
					group.addControl(
						key,
						this._formBuilder.group({
							enabled: [net.enabled],
							nativeCurrency: this._formBuilder.group({
								enabled: [net.nativeCurrency.enabled],
								code: [net.nativeCurrency.code],
							}),
							altCoins: net.altCoins
								? this._formBuilder.group({
										enabled: [net.altCoins.enabled],
										standard: [net.altCoins.standard],
										showAll: [true],
										specificTokens: [[]],
									})
								: null,
						}),
					);
				}
			}
		});
		return group;
	}

	initializeWhitelistItems(): void {
		this.whitelistItems = [{ domain: "", discount: "", type: "percentage" }];
	}

	addWhitelistFormControls(): void {
		this.whitelistItems.forEach((item, index) => {
			if (!this.accountForm.get(`whitelistDomain_${index}`)) {
				this.accountForm.addControl(`whitelistDomain_${index}`, new FormControl(item.domain));
			}
			if (!this.accountForm.get(`whitelistDiscount_${index}`)) {
				this.accountForm.addControl(`whitelistDiscount_${index}`, new FormControl(item.discount));
			}
			if (!this.accountForm.get(`whitelistType_${index}`)) {
				this.accountForm.addControl(`whitelistType_${index}`, new FormControl(item.type));
			}
		});
	}

	removeWhitelistFormControls(): void {
		this.whitelistItems.forEach((_, index) => {
			this.accountForm.removeControl(`whitelistDomain_${index}`);
			this.accountForm.removeControl(`whitelistDiscount_${index}`);
			this.accountForm.removeControl(`whitelistType_${index}`);
		});
	}

	addReservedWord(word: string): void {
		if (word && word.trim() && !this.reservedWords.includes(word.trim())) {
			this.reservedWords.push(word.trim());
		}
	}

	removeReservedWord(word: string): void {
		const index = this.reservedWords.indexOf(word);
		if (index > -1) {
			this.reservedWords.splice(index, 1);
		}
	}

	togglePaymentMethod(method: string): void {
		const currentMethods = this.getPaymentMethods();
		if (currentMethods.includes(method)) {
			if (method === "crypto") this.accountForm.get("cryptoEnabled")?.setValue(false);
			else if (method === "stripe") this.accountForm.get("stripeEnabled")?.setValue(false);
		} else {
			if (method === "crypto") this.accountForm.get("cryptoEnabled")?.setValue(true);
			else if (method === "stripe") this.accountForm.get("stripeEnabled")?.setValue(true);
		}
	}

	isPaymentMethodEnabled(method: string): boolean {
		return this.getPaymentMethods().includes(method);
	}

	getWhitelistTypeLabel(type: string): string {
		return type === "percentage" ? "%" : "$";
	}

	addWhitelistItem(): void {
		if (!this.newWhitelistItem.domain || !this.newWhitelistItem.discount) return;

		const newItem = { ...this.newWhitelistItem };
		this.whitelistItems.push(newItem);

		// Reset new item
		this.newWhitelistItem = { domain: "", discount: "", type: "percentage" };

		// Note: We don't strictly need to add controls to the form if we aren't using FormArray for this anymore
		// But let's keep consistency if other parts rely on it
		const newIndex = this.whitelistItems.length - 1;
		this.accountForm.addControl(`whitelistDomain_${newIndex}`, new FormControl(newItem.domain));
		this.accountForm.addControl(`whitelistDiscount_${newIndex}`, new FormControl(newItem.discount));
		this.accountForm.addControl(`whitelistType_${newIndex}`, new FormControl(newItem.type));
	}

	removeWhitelistItem(index: number): void {
		if (this.whitelistItems.length > 1) {
			this.accountForm.removeControl(`whitelistDomain_${index}`);
			this.accountForm.removeControl(`whitelistDiscount_${index}`);
			this.accountForm.removeControl(`whitelistType_${index}`);
			this.whitelistItems.splice(index, 1);
			this.removeWhitelistFormControls();
			this.addWhitelistFormControls();
		}
	}

	validateDomainName(name: string): boolean {
		if (!this.accountForm.get("contentFilterEnabled")?.value) return true;
		const lowerName = name.toLowerCase();
		return !this.inappropriateWords.some((word) => lowerName.includes(word));
	}

	getPaymentMethods(): string[] {
		const methods: string[] = [];
		if (this.accountForm.get("cryptoEnabled")?.value) methods.push("crypto");
		if (this.accountForm.get("stripeEnabled")?.value) methods.push("stripe");
		return methods;
	}

	private cleanupInvalidData(): void {
		const paymentMethods = this.getPaymentMethods();
		const validMethods = paymentMethods.filter((method) => ["crypto", "stripe"].includes(method));
		if (validMethods.length !== paymentMethods.length) {
			this.accountForm.get("cryptoEnabled")?.setValue(validMethods.includes("crypto"));
			this.accountForm.get("stripeEnabled")?.setValue(validMethods.includes("stripe"));
		}
	}

	private validateDataBeforeSend(): { valid: boolean; errors: string[] } {
		const errors: string[] = [];
		const paymentMethods = this.getPaymentMethods();
		const invalidMethods = paymentMethods.filter((method) => !["crypto", "stripe"].includes(method));
		if (invalidMethods.length > 0) {
			errors.push(`Invalid payment methods: ${invalidMethods.join(", ")}. Allowed: crypto, stripe`);
		}
		return { valid: errors.length === 0, errors };
	}

	buildDomainConfig(): DomainConfig {
		const formValue = this.accountForm.value;
		const validation = this.validateDataBeforeSend();

		if (!validation.valid) {
			this.showError(`Validation failed: ${validation.errors.join(", ")}`);
			throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
		}

		const whitelist = this.buildWhitelistFromForm();

		return {
			name: formValue.domain,
			holdSuffix: formValue.holdSuffix,
			status: this.accountForm.get("status")?.value || "active",
			owner: formValue.owner,
			description: formValue.description,
			tags: {
				minLength: formValue.minLength,
				maxLength: formValue.maxLength,
				allowedChars: /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/,
				reserved: this.reservedWords,
				customRules: [],
				payment: {
					methods: this.getPaymentMethods(),
					networks: formValue.networks,
					// Preserve license values; never inject client-side defaults.
					discounts: this.currentLicense?.domainConfig?.tags?.payment?.discounts,
					rewardPrice: this.currentLicense?.domainConfig?.tags?.payment?.rewardPrice,
					whitelist: whitelist,
					pricingTable: this.getPricingTableFromRows(this.pricingTableRows),
					planPricing: {
						premium: this.getPricingTableFromRows(this.premiumPricingRows),
						unlimited: this.getPricingTableFromRows(this.unlimitedPricingRows),
					},
				},
				storage: {
					keyPrefix: formValue.keyPrefix,
					ipfsEnabled: formValue.ipfsEnabled,
					arweaveEnabled: formValue.arweaveEnabled,
					walrusEnabled: formValue.walrusEnabled,
				},
				wallet: {
					networks: formValue.walletNetworks,
				},
			},
			zelfkeys: {
				plans: this.zelfkeysPlans,
				payment: { whitelist: {}, pricingTable: {} },
				storage: {
					keyPrefix: formValue.zelfkeysKeyPrefix,
					ipfsEnabled: formValue.zelfkeysIpfsEnabled,
					arweaveEnabled: formValue.zelfkeysArweaveEnabled,
					walrusEnabled: formValue.zelfkeysWalrusEnabled,
				},
			},
			metadata: {
				launchDate: formValue.launchDate,
				version: formValue.version,
				documentation: formValue.documentation,
				community: formValue.community || undefined,
				enterprise: formValue.enterprise || undefined,
				support: formValue.support,
			},
		};
	}

	private loadCurrentLicenseFromStorage(): void {
		const storedLicense = localStorage.getItem("license");
		if (!storedLicense) return;
		try {
			this.currentLicense = License.fromJSON(JSON.parse(storedLicense));
		} catch (error) {
			console.error("Error parsing stored license:", error);
		}
	}

	async fetchLicenseFromBackend(): Promise<void> {
		try {
			this.isLoading = true;
			this._cdr.detectChanges();
			const response = await this._licenseService.getMyLicense(true);

			if (!response || !response.data || !response.data.myLicense) {
				return;
			}

			const remoteLicense = License.fromAPIResponseWithWrapper(response.data.myLicense.domainConfig);
			if (License.isRemoteLicenseStale(this.currentLicense?.domainConfig, remoteLicense.domainConfig)) {
				return;
			}
			this.currentLicense = remoteLicense;
			localStorage.setItem("license", JSON.stringify(this.currentLicense.toJSON()));
		} catch (error) {
			console.error("Error fetching license from backend:", error);
			this.showAlert = true;
			this.alertMessage = "Failed to fetch license from server";
			this.alertType = "error";
		} finally {
			this.isLoading = false;
			this._cdr.detectChanges();
		}
	}

	async loadLicense(): Promise<void> {
		this.loadCurrentLicenseFromStorage();
		await this.fetchLicenseFromBackend();
	}

	populateFormFromLicense(): void {
		const config = this.currentLicense?.domainConfig;
		if (config) {
			this.accountForm.get("domain")?.setValue(config.name || "");
			this.accountForm.get("status")?.setValue(config.status || "active");
			this.accountForm.get("owner")?.setValue(config.owner || "zelf-team");
			this.accountForm.get("description")?.setValue(config.description || "Official Zelf domain");

			// Features
			this.accountForm.get("znsEnabled")?.setValue(true);
			this.accountForm.get("zelfkeysEnabled")?.setValue(true);

			// Validation
			this.accountForm.get("minLength")?.setValue(config.tags?.minLength || 3);
			this.accountForm.get("maxLength")?.setValue(config.tags?.maxLength || 50);
			this.accountForm.get("holdSuffix")?.setValue(config.holdSuffix || ".hold");
			if (config.tags?.reserved) {
				this.reservedWords = [...config.tags.reserved];
			}

			// Storage
			this.accountForm.get("ipfsEnabled")?.setValue(config.tags?.storage?.ipfsEnabled ?? true);
			this.accountForm.get("arweaveEnabled")?.setValue(config.tags?.storage?.arweaveEnabled ?? true);
			this.accountForm.get("walrusEnabled")?.setValue(config.tags?.storage?.walrusEnabled ?? true);
			this.accountForm.get("keyPrefix")?.setValue(config.tags?.storage?.keyPrefix || "tagName");

			this.accountForm.get("zelfkeysIpfsEnabled")?.setValue(config.zelfkeys?.storage?.ipfsEnabled ?? true);
			this.accountForm.get("zelfkeysArweaveEnabled")?.setValue(config.zelfkeys?.storage?.arweaveEnabled ?? true);
			this.accountForm.get("zelfkeysWalrusEnabled")?.setValue(config.zelfkeys?.storage?.walrusEnabled ?? true);
			this.accountForm.get("zelfkeysKeyPrefix")?.setValue(config.zelfkeys?.storage?.keyPrefix || "tagName");

			// Payment
			this.accountForm.get("cryptoEnabled")?.setValue(config.tags?.payment?.methods?.includes("crypto") ?? true);
			this.accountForm.get("stripeEnabled")?.setValue(config.tags?.payment?.methods?.includes("stripe") ?? true);

			if (this.currentLicense) {
				const networks = this.currentLicense.getNetworks();
				this.accountForm.setControl("networks", this.createNetworksFormGroup(networks));

				// Support both locations for migration (checking tags.wallet first)
				const walletNetworks = config.tags?.wallet?.networks || (config as any).wallet?.networks;
				this.accountForm.setControl("walletNetworks", this.createNetworksFormGroup(walletNetworks, true));
			}

			if (config.tags?.payment?.pricingTable) {
				this.loadPricingTableFromConfig(config.tags.payment.pricingTable);
			}
			this.loadPlanPricingFromConfig(config.tags?.payment?.planPricing, config.tags?.payment?.pricingTable);

			this.populateWhitelist(config);

			if (config.zelfkeys?.plans) {
				this.zelfkeysPlans = [...config.zelfkeys.plans];
			}

			// Metadata
			this.accountForm.get("launchDate")?.setValue(config.metadata?.launchDate || "2023-01-01");
			this.accountForm.get("version")?.setValue(config.metadata?.version || "1.0.0");
			this.accountForm.get("documentation")?.setValue(config.metadata?.documentation || "https://docs.zelf.world");
			this.accountForm.get("community")?.setValue(config.metadata?.community || "");
			this.accountForm.get("enterprise")?.setValue(config.metadata?.enterprise || "");
			this.accountForm.get("support")?.setValue(config.metadata?.support || "standard");
		}
		this.cleanupInvalidData();
		this._cdr.detectChanges();
	}

	private populateWhitelist(config: DomainConfig): void {
		if (config.tags?.payment?.whitelist) {
			this.whitelistItems = Object.entries(config.tags.payment.whitelist).map(([domain, price]) => {
				const priceStr = price as string;
				const match = priceStr.match(/^(\d+(?:\.\d+)?)([%$])$/);
				if (match) {
					const typeSymbol = match[2];
					const typeValue = typeSymbol === "%" ? "percentage" : typeSymbol === "$" ? "fixed" : typeSymbol;
					return { domain, discount: match[1], type: typeValue };
				}
				return { domain, discount: priceStr, type: "percentage" };
			});
		}
		this.whitelistItems.forEach((item, index) => {
			this.accountForm.get(`whitelistDomain_${index}`)?.setValue(item.domain);
			this.accountForm.get(`whitelistDiscount_${index}`)?.setValue(item.discount);
			this.accountForm.get(`whitelistType_${index}`)?.setValue(item.type);
		});
	}

	saveLicense(): void {
		if (this.accountForm.invalid) {
			this.showError("Please fill in all required fields correctly");
			return;
		}
		const domain = this.accountForm.get("domain")?.value;
		const domainConfig = this.buildDomainConfig();

		this._saveConfirmationService.setSaveData({
			domain: domainConfig.name,
			domainConfig,
			redirectUrl: "/settings/zelf-name-service",
			operation: {
				title: this._translocoService.translate("saving_operations.license_configuration.title"),
				description: this._translocoService.translate("saving_operations.license_configuration.description"),
				action: this._translocoService.translate("saving_operations.license_configuration.action"),
				itemName: this._translocoService.translate("saving_operations.license_configuration.itemName"),
			},
		});
		this._router.navigate(["/save-confirmation"], { queryParams: { redirect: "/settings/zelf-name-service" } });
	}

	private showSuccess(message: string): void {
		this.alertMessage = message;
		this.alertType = "success";
		this.showAlert = true;
		setTimeout(() => {
			this.showAlert = false;
		}, 5000);
	}

	private showError(message: string): void {
		this.alertMessage = message;
		this.alertType = "error";
		this.showAlert = true;
		setTimeout(() => {
			this.showAlert = false;
		}, 5000);
	}

	cancel(): void {
		this.loadLicense();
	}

	private buildWhitelistFromForm(): any {
		const whitelist: any = {};
		this.whitelistItems.forEach((item) => {
			const domain = item.domain?.trim();
			const discount = item.discount?.toString().trim();
			const type = item.type?.trim();
			if (domain && discount && type) {
				const typeSymbol = type === "percentage" ? "%" : type === "fixed" ? "$" : type;
				whitelist[domain] = `${discount}${typeSymbol}`;
			}
		});
		return whitelist;
	}

	get activePricingRows(): PricingRow[] {
		if (this.pricingTableTab === "premium") return this.premiumPricingRows;
		if (this.pricingTableTab === "unlimited") return this.unlimitedPricingRows;
		return this.pricingTableRows;
	}

	onPricingTableTabChange(tab: PricingTableTab): void {
		this.pricingTableTab = tab;
		this._cdr.markForCheck();
	}

	onPricingCellChange(change: { length: string; column: PricingColumnKey; value: number }): void {
		const rows = this.activePricingRows;
		const row = rows.find((item) => item.length === change.length);
		if (!row) return;
		row[change.column] = Number.isFinite(change.value) ? change.value : 0;
		this.pricingDirty = true;
		this.accountForm.markAsDirty();
		this._cdr.markForCheck();
	}

	initializePricingTable(): void {
		// Start empty: prices only ever come from the loaded license.
		this.pricingTableRows = this.rowsFromPricingTable({});
		this.premiumPricingRows = this.clonePricingRows(this.pricingTableRows);
		this.unlimitedPricingRows = this.clonePricingRows(this.pricingTableRows);
		this.pricingDirty = false;
	}

	resetPricingTable(): void {
		// "Reset" discards local edits and reloads the prices saved in the license (IPFS).
		// It never seeds made-up default prices.
		const payment: any = this.currentLicense?.domainConfig?.tags?.payment || {};
		this.pricingTableRows = this.rowsFromPricingTable(payment.pricingTable || {});
		this.loadPlanPricingFromConfig(payment.planPricing, payment.pricingTable);
		this.accountForm?.markAsPristine?.();
		(this as any)._cdr?.markForCheck?.();
	}

	getPricingTableFromRows(rows: PricingRow[] = this.pricingTableRows): { [key: string]: { [key: string]: number } } {
		const pricingTable: { [key: string]: { [key: string]: number } } = {};
		rows.forEach((row) => {
			pricingTable[row.length] = {
				1: Number(row.oneYear) || 0,
				2: Number(row.twoYears) || 0,
				3: Number(row.threeYears) || 0,
				4: Number(row.fourYears) || 0,
				5: Number(row.fiveYears) || 0,
				lifetime: Number(row.lifetime) || 0,
			};
		});
		return pricingTable;
	}

	loadPricingTableFromConfig(pricingTable: { [key: string]: { [key: string]: number } }): void {
		if (!pricingTable) {
			this.initializePricingTable();
			return;
		}
		this.pricingTableRows = this.rowsFromPricingTable(pricingTable);
	}

	loadPlanPricingFromConfig(
		planPricing?: {
			premium?: { [key: string]: { [key: string]: number } };
			unlimited?: { [key: string]: { [key: string]: number } };
		},
		fallback?: { [key: string]: { [key: string]: number } },
	): void {
		// No fallback to the legacy pricingTable: a plan with no prices in the license is shown empty (not offered).
		this.premiumPricingRows = this.rowsFromPricingTable(planPricing?.premium || {});
		this.unlimitedPricingRows = this.rowsFromPricingTable(planPricing?.unlimited || {});
		this.pricingDirty = false;
	}

	private isEmptyPricingTable(pricingTable?: { [key: string]: { [key: string]: number } }): boolean {
		return !pricingTable || Object.keys(pricingTable).length === 0;
	}

	private clonePricingRows(rows: PricingRow[]): PricingRow[] {
		return rows.map((row) => ({ ...row }));
	}

	private rowsFromPricingTable(pricingTable: { [key: string]: { [key: string]: number } }): PricingRow[] {
		const rows: PricingRow[] = [];
		for (let i = 1; i <= 5; i++) {
			const prices = pricingTable[i] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, lifetime: 0 };
			rows.push({
				length: i.toString(),
				oneYear: prices[1] || 0,
				twoYears: prices[2] || 0,
				threeYears: prices[3] || 0,
				fourYears: prices[4] || 0,
				fiveYears: prices[5] || 0,
				lifetime: prices.lifetime || 0,
			});
		}
		const rangePrices = pricingTable["6-15"] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, lifetime: 0 };
		rows.push({
			length: "6-15",
			oneYear: rangePrices[1] || 0,
			twoYears: rangePrices[2] || 0,
			threeYears: rangePrices[3] || 0,
			fourYears: rangePrices[4] || 0,
			fiveYears: rangePrices[5] || 0,
			lifetime: rangePrices.lifetime || 0,
		});
		for (let i = 16; i <= 27; i++) {
			const prices = pricingTable[i] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, lifetime: 0 };
			rows.push({
				length: i.toString(),
				oneYear: prices[1] || 0,
				twoYears: prices[2] || 0,
				threeYears: prices[3] || 0,
				fourYears: prices[4] || 0,
				fiveYears: prices[5] || 0,
				lifetime: prices.lifetime || 0,
			});
		}
		return rows;
	}
}
