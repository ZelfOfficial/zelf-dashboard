import { parseDurationParam } from "app/core/pricing/license-pricing.utils";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit, ViewEncapsulation, signal, ElementRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { Router, ActivatedRoute } from "@angular/router";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { TagsService } from "../../../tags/tags.service";
import { LicensePricingService } from "app/core/pricing/license-pricing.service";
import { SessionService } from "app/core/services/session.service";
import { planErrorCodeIncludes, responseHasPlanErrorCode } from "app/core/i18n/plan-error-code";

@Component({
	selector: "portfolio-payment",
	templateUrl: "./payment.component.html",
	styleUrls: ["./payment.component.scss"],
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [CommonModule, MatIconModule, FormsModule, TranslocoModule],
})
export class PortfolioPaymentComponent implements OnInit {
	domains = signal<string[]>([".zelf", ".bdag"]); // Initialize with default domains
	selectedDomain: string = ".zelf"; // Use regular property for two-way binding
	searchTagName = signal<string>("");
	isLoading = signal<boolean>(true);
	paymentOptions = signal<any>(null);
	isSearching = signal<boolean>(false);
	searchError = signal<string | null>(null);
	showNameAvailable = signal<boolean>(false);
	selectedPaymentMethod = signal<string>("ETH");
	selectedDuration = signal<number>(1); // Duration in years, default 1
	/** License plan requested via ?plan=; empty lets the API choose the license default. */
	selectedPlan = signal<string>("");
	isDurationDropdownOpen = signal<boolean>(false);
	/** Plans the license offers for the searched name length (from planPricing via the API). */
	availablePlans = signal<string[]>([]);
	/** Durations the license prices for the selected plan. Lifetime is sent as 999 (the API maps it to "lifetime"). */
	leaseDurationOptions = signal<{ value: number; label: string }[]>([]);

	/**
	 * Return supported domains in canonical format with leading dot and lower-case
	 */
	private getSupportedDomains(): string[] {
		const loaded = this.domains();
		if (!loaded || loaded.length === 0) return [".zelf"]; // sensible default
		return loaded.map((d) => (d?.startsWith(".") ? d.toLowerCase() : `.${d.toLowerCase()}`));
	}

	/**
	 * Validate an incoming domain param (without leading dot expected) and
	 * return a canonical domain with leading dot. Defaults to .zelf if unsupported.
	 */
	private validateIncomingDomain(domainParam: string | null | undefined): string {
		const param = (domainParam || "").toString().trim().toLowerCase().replace(/^\./, "");
		const supported = this.getSupportedDomains();
		const withDot = param ? `.${param}` : ".zelf";
		return supported.includes(withDot) ? withDot : ".zelf";
	}

	getPricingDocsUrl(): string {
		const language = (navigator?.language || "en").toLowerCase();
		const isSpanish = language.startsWith("es");
		return isSpanish ? "https://docs.zelf.world/docs-es/airdrop/precios-por-dominio" : "https://docs.zelf.world/docs/airdrop/pricing-per-domain";
	}

	constructor(
		private tagsService: TagsService,
		private licensePricing: LicensePricingService,
		private cdr: ChangeDetectorRef,
		private router: Router,
		private route: ActivatedRoute,
		private elementRef: ElementRef,
		private translocoService: TranslocoService,
		private sessionService: SessionService
	) {}

	@HostListener("document:click", ["$event"])
	handleClickOutside(event: Event): void {
		const clickedElement = event.target as HTMLElement;
		const dropdownButton = this.elementRef.nativeElement.querySelector("[data-duration-button]");
		const dropdownMenu = this.elementRef.nativeElement.querySelector("[data-duration-menu]");

		if (
			this.isDurationDropdownOpen() &&
			clickedElement !== dropdownButton &&
			!clickedElement.closest("[data-duration-menu]") &&
			!dropdownButton?.contains(clickedElement)
		) {
			this.isDurationDropdownOpen.set(false);
			this.cdr.markForCheck();
		}
	}

	async ngOnInit(): Promise<void> {
		// Initialize session for API access
		await this.sessionService.initializePaymentSession();

		await this.loadDomains();
		await this.checkQueryParams();
	}

	async checkQueryParams(): Promise<void> {
		// Check initial query params from snapshot
		const initialParams = this.route.snapshot.queryParams;
		if (initialParams["domain"]) {
			this.selectedDomain = this.validateIncomingDomain(initialParams["domain"]);
		} else {
			// No query param domain, use first available
			const availableDomains = this.domains();
			if (availableDomains.length > 0) {
				this.selectedDomain = availableDomains[0];
			}
		}

		// Check if we should trigger search based on initial params
		if (initialParams["tagname"] && initialParams["domain"]) {
			const tagName = initialParams["tagname"];
			const domain = this.validateIncomingDomain(initialParams["domain"]).replace(".", "");
			const duration = parseDurationParam(initialParams["duration"]);
			this.selectedPlan.set(initialParams["plan"] || "");

			// Set the form values
			this.searchTagName.set(tagName);
			this.selectedDomain = `.${domain}`;
			this.selectedDuration.set(duration);

			// Trigger search automatically with specified duration
			await this.performSearch(tagName, `.${domain}`, duration);
		}

		// Subscribe to future query param changes
		this.route.queryParams.subscribe(async (params) => {
			if (params["tagname"] && params["domain"]) {
				const tagName = params["tagname"];
				const domain = this.validateIncomingDomain(params["domain"]).replace(".", "");
				const duration = parseDurationParam(params["duration"]);
				this.selectedPlan.set(params["plan"] || "");

				// Set the form values
				this.searchTagName.set(tagName);
				this.selectedDomain = `.${domain}`;
				this.selectedDuration.set(duration);

				// Trigger search automatically with specified duration
				await this.performSearch(tagName, `.${domain}`, duration);
			}
		});
	}

	async performSearch(tagName: string, domain: string, duration?: number): Promise<void> {
		const searchDuration = duration ?? this.selectedDuration();
		this.isSearching.set(true);
		this.searchError.set(null);
		this.showNameAvailable.set(false);

		// Plans / durations come from the license; the price always comes from the API quote.
		const duration_ = await this.refreshLicenseOptions(tagName.trim(), domain, searchDuration);

		// Always ask the API for a fresh, license-derived quote (no browser cache of prices).
		await this.fetchPaymentData(tagName, domain, duration_);
		this.isSearching.set(false);
		this.cdr.markForCheck();
	}

	/** Load plans/durations offered by the license for this name; returns the duration to quote. */
	private async refreshLicenseOptions(tagName: string, domain: string, duration: number): Promise<number> {
		try {
			const plans = await this.licensePricing.plansFor(domain, tagName);
			this.availablePlans.set(plans);
			if (this.selectedPlan() && !plans.includes(this.selectedPlan())) this.selectedPlan.set("");

			const durations = await this.licensePricing.durationsFor(domain, tagName, this.selectedPlan() || undefined);
			const options = durations.map((d) =>
				d === "lifetime" ? { value: 999, label: "Lifetime" } : { value: Number(d), label: Number(d) === 1 ? "1 Year" : `${d} Years` },
			).filter((o) => Number.isFinite(o.value));
			this.leaseDurationOptions.set(options);

			if (options.length && !options.some((o) => o.value === duration)) {
				duration = options[0].value;
				this.selectedDuration.set(duration);
			}
		} catch (error) {
			console.error("Error loading license plans:", error);
			this.availablePlans.set([]);
			this.leaseDurationOptions.set([]);
		}
		return duration;
	}

	async onPlanChange(plan: string): Promise<void> {
		this.selectedPlan.set(plan || "");
		const tagName = this.searchTagName();
		if (tagName && tagName.trim()) await this.performSearch(tagName, this.selectedDomain, this.selectedDuration());
	}

	private async fetchPaymentData(tagName: string, domain: string, duration: number): Promise<void> {
		this.paymentOptions.set(null);

		try {
			const response = await this.tagsService.getPaymentOptions({
				tagName: tagName.trim(),
				domain: domain.replace(".", ""),
				duration: duration,
				...(this.selectedPlan() ? { plan: this.selectedPlan() } : {}),
			});

			if ("error" in response.data) {
				this.handleSearchError(response.data.error);
			} else {
				this.processPaymentResponse(response.data, duration);
			}
		} catch (error: any) {
			console.error("Error fetching payment options:", error);

			const apiError: string = error?.error?.validationError || error?.error?.message || error?.validationError || "";
			const status = error?.status;

			if (status === 404 || planErrorCodeIncludes(apiError, "TAG_NOT_FOUND") || responseHasPlanErrorCode(error, "TAG_NOT_FOUND")) {
				this.handleSearchError("tag_not_found");
			} else if (planErrorCodeIncludes(apiError, "PLAN_NOT_OFFERED_FOR_NAME")) {
				this.handleSearchError("This plan is not offered for a name of this length.");
			} else if (planErrorCodeIncludes(apiError, "PLAN_DURATION_NOT_OFFERED_BY_LICENSE")) {
				this.handleSearchError("This duration is not offered for the selected plan.");
			} else {
				// Never report a failed quote as "name available".
				this.handleSearchError(apiError || "Could not get a price for this name right now.");
			}
		}
	}

	private handleSearchError(error: string): void {
		if (planErrorCodeIncludes(error, "TAG_NOT_FOUND")) {
			// Tag not found means the name is available!
			this.showNameAvailable.set(true);
			this.searchError.set(null);
		} else {
			this.showNameAvailable.set(false);
			const errorMessage = error || "Unknown error occurred";
			this.searchError.set(errorMessage);
		}
	}

	private processPaymentResponse(data: any, duration: number): void {
		this.paymentOptions.set(data);
		this.selectedPaymentMethod.set("ETH");
		this.selectedDuration.set(duration);
	}

	async loadDomains(): Promise<void> {
		this.isLoading.set(true);

		try {
			const response = await this.tagsService.getDomains();

			if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
				this.domains.set(response.data);
			}
		} catch (error) {
			console.error("Error loading domains:", error);
			// Keep default domains that are already set
		} finally {
			this.isLoading.set(false);

			this.cdr.markForCheck();
		}
	}

	async onDomainChange(): Promise<void> {
		const tagName = this.searchTagName();

		// Only trigger search if there's a search term
		if (tagName && tagName.trim() !== "") {
			await this.onSearch();
		}
	}

	async onSearch(): Promise<void> {
		const tagName = this.searchTagName();
		const domain = this.selectedDomain;
		const duration = this.selectedDuration();

		if (!tagName || tagName.trim() === "") {
			this.searchError.set(this.translocoService.translate("payment.pleaseEnterTagName"));

			return;
		}

		await this.performSearch(tagName, domain, duration);

		// Update URL with query parameters after successful search
		this.router.navigate([], {
			relativeTo: this.route,
			queryParams: {
				tagname: tagName.trim(),
				domain: domain.replace(".", ""),
				duration: duration,
			},
			replaceUrl: true,
		});
	}

	getPrice(): string | number {
		const options = this.paymentOptions();
		if (!options?.prices) return "N/A";

		// Return the price from the first available currency
		return (
			options.prices.ETH?.price ||
			options.prices.BTC?.price ||
			options.prices.AVAX?.price ||
			options.prices.SOL?.price ||
			options.publicData.price
		);
	}

	async onDurationChange(newDuration: number): Promise<void> {
		this.selectedDuration.set(newDuration);

		const tagName = this.searchTagName();
		const domain = this.selectedDomain;

		if (!tagName || tagName.trim() === "") {
			return;
		}

		// Re-fetch payment options with new duration
		await this.performSearch(tagName, domain, newDuration);

		// Update URL with new duration parameter
		this.router.navigate([], {
			relativeTo: this.route,
			queryParams: {
				tagname: tagName.trim(),
				domain: domain.replace(".", ""),
				duration: newDuration,
			},
			replaceUrl: true,
		});
	}

	getDurationLabel(duration: number): string {
		if (duration === 999) return "Lifetime";
		return duration === 1 ? "1 Year" : `${duration} Years`;
	}

	toggleDurationDropdown(): void {
		this.isDurationDropdownOpen.update((value) => !value);
	}

	selectDuration(duration: number): void {
		this.isDurationDropdownOpen.set(false);
		this.onDurationChange(duration);
	}

	onPurchaseNow(): void {
		const options = this.paymentOptions();
		const tagName = this.searchTagName();
		const domain = this.selectedDomain;
		const duration = this.selectedDuration();
		const paymentMethod = this.selectedPaymentMethod();

		if (!options) return;

		// Only the selection goes in the URL. Checkout re-quotes price, amount and
		// payment address from the API; nothing client-computed is passed along.
		const queryParams: any = {
			tagname: tagName,
			domain: domain.replace(".", ""),
			duration: duration,
			paymentMethod: paymentMethod,
			...(this.selectedPlan() ? { plan: this.selectedPlan() } : {}),
		};

		// Navigate to checkout with all the details
		this.router.navigate(["/portfolio/payment-checkout"], {
			queryParams: queryParams,
		});
	}
}
