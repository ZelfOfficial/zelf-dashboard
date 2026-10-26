import { planErrorCodeIncludes, responseHasPlanErrorCode } from "app/core/i18n/plan-error-code";
import { parseDurationParam } from "app/core/pricing/license-pricing.utils";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy, ViewEncapsulation, signal, ElementRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { Router, ActivatedRoute } from "@angular/router";
import { TranslocoModule } from "@jsverse/transloco";
import { TagsService } from "../../../../tags/tags.service";
import { SessionService } from "app/core/services/session.service";
import { FuseConfigService } from "@fuse/services/config";
import { Subject, takeUntil } from "rxjs";

@Component({
    selector: "portfolio-payment-checkout",
    templateUrl: "./checkout.component.html",
    styleUrls: ["./checkout.component.scss"],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule, TranslocoModule],
})
export class PortfolioPaymentCheckoutComponent implements OnInit, OnDestroy {
    tagName = signal<string>("");
    domain = signal<string>("");
    duration = signal<number>(1);
    price = signal<number | string>("");
    paymentMethod = signal<string>("ETH");
    ethAddress = signal<string>("");
    amountToPay = signal<string>("");
    plan = signal<string>("");
    quoteError = signal<string | null>(null);
    isQuoting = signal<boolean>(false);
    /** Signed quote token from the API; kept in memory only. */
    private signedDataPrice: string | null = null;
    qrcodeUrl = signal<string>("");
    isCheckingPayment = signal<boolean>(false);
    isPaymentConfirmed = signal<boolean>(false);
    amountReceived = signal<string>("");
    lastCheckTime = signal<Date | null>(null);
    receiptEmail = signal<string>("");
    isSendingReceipt = signal<boolean>(false);
    private isDarkMode = signal<boolean>(false);
    private qrCodeInstance: any | null = null;
    private qrContainerEl: HTMLElement | null = null;
    private paymentCheckInterval: any = null;
    private isCheckInProgress = false; // Flag to prevent overlapping payment checks
    private _unsubscribeAll = new Subject<void>();

    constructor(
        private cdr: ChangeDetectorRef,
        private router: Router,
        private route: ActivatedRoute,
        private elementRef: ElementRef,
        private snackBar: MatSnackBar,
        private tagsService: TagsService,
        private _fuseConfigService: FuseConfigService,
        private sessionService: SessionService,
    ) {}

    async ngOnInit(): Promise<void> {
        // Initialize session for API access
        await this.sessionService.initializePaymentSession();

        this.loadQueryParams();

        // Subscribe to theme changes from Fuse config
        this._fuseConfigService.config$.pipe(takeUntil(this._unsubscribeAll)).subscribe((config) => {
            const isDark = config.scheme === "dark" || (config.scheme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
            this.isDarkMode.set(isDark);

            // Regenerate QR code when theme changes
            void this.generateQRCode();
        });
    }

    /** Human-readable text for a quote failure (never the raw HTTP error). */
    quoteErrorText(): string {
        const code = this.quoteError() || "";
        if (code === "missing_selection") return "No name selected. Go back and search for a name first.";
        if (planErrorCodeIncludes(code, "TAG_NOT_FOUND")) return "This name hasn't been created yet. Create it in the Zelf app or extension first, then come back to pay.";
        if (planErrorCodeIncludes(code, "PLAN_DURATION_NOT_OFFERED_BY_LICENSE")) return "This plan and duration are not offered for this name. Go back and pick another option.";
        if (code === "payment_method_not_available") return "This payment method isn't available for this name. Go back and pick another one.";
        return "This name / plan / duration can't be quoted right now. Go back and pick another option.";
    }

    private loadQueryParams(): void {
        this.route.queryParams.pipe(takeUntil(this._unsubscribeAll)).subscribe((params) => {
            // Only the selection is read from the URL. Price, amount and payment address
            // are always re-quoted from the API (license-derived, signed server-side),
            // so a tampered URL cannot change what is shown or paid.
            this.tagName.set(params["tagname"] || "");
            this.domain.set(params["domain"] || "");
            this.duration.set(parseDurationParam(params["duration"]));
            this.plan.set(params["plan"] || "");
            this.paymentMethod.set(params["paymentMethod"] || "ETH");

            void this.loadServerQuote();
        });
    }

    /** Fetch the server quote for name + plan + duration and populate the checkout from it. */
    private async loadServerQuote(): Promise<void> {
        if (!this.tagName() || !this.domain()) {
            this.quoteError.set("missing_selection");
            this.isQuoting.set(false);
            this.cdr.markForCheck();
            return;
        }
        this.isQuoting.set(true);
        this.quoteError.set(null);
        this.price.set("");
        this.amountToPay.set("");
        this.ethAddress.set("");
        this.signedDataPrice = null;
        this.cdr.markForCheck();

        try {
            const response: any = await this.tagsService.getPaymentOptions({
                tagName: this.tagName(),
                domain: this.domain(),
                duration: this.duration(),
                ...(this.plan() ? { plan: this.plan() } : {}),
            });
            const data = response?.data;

            if (!data || "error" in data || !data.prices) {
                const raw = data?.error || response?.validationError || "";
                this.quoteError.set(responseHasPlanErrorCode(raw, "TAG_NOT_FOUND") ? "TAG_NOT_FOUND" : raw || "quote_unavailable");
                return;
            }

            const method = this.paymentMethod();
            const quote = data.prices?.[method];
            if (!quote) {
                this.quoteError.set("payment_method_not_available");
                return;
            }

            // Use the per-request quote only. (publicData is the stored pay record and can carry a stale price.)
            this.price.set(quote.price ?? "");
            this.amountToPay.set(quote.amountToSend != null ? String(quote.amountToSend) : "");
            // v4 returns BTC/SOL under paymentAddress and EVM addresses under publicData.
            this.ethAddress.set(this.getAddressForMethod({ ...(data.publicData || {}), ...(data.paymentAddress || {}) }, method));
            this.signedDataPrice = data.signedDataPrice || null;

            void this.generateQRCode();
            this.startPaymentChecking();
        } catch (error: any) {
            console.error("Error loading checkout quote:", error);
            const raw = error?.error?.message || error?.error?.validationError || "";
            this.quoteError.set(responseHasPlanErrorCode(error, "TAG_NOT_FOUND") ? "TAG_NOT_FOUND" : raw || "quote_unavailable");
        } finally {
            this.isQuoting.set(false);
            this.cdr.markForCheck();
        }
    }

    private getAddressForMethod(addresses: any, method: string): string {
        if (!addresses) return "";
        switch (method) {
            case "BTC":
                return addresses.btcAddress || "";
            case "SOL":
                return addresses.solanaAddress || "";
            case "AVAX":
                return addresses.avalancheAddress || addresses.ethAddress || "";
            default:
                return addresses.ethAddress || "";
        }
    }

    startPaymentChecking(): void {
        // Clear any existing interval
        if (this.paymentCheckInterval) {
            clearInterval(this.paymentCheckInterval);
        }

        // Start checking every 10 seconds
        this.paymentCheckInterval = setInterval(() => {
            void this.checkPaymentStatus();
        }, 10000);

        // Do an initial check immediately
        void this.checkPaymentStatus();
    }

    async checkPaymentStatus(): Promise<void> {
        // Prevent overlapping calls - if a check is already in progress, skip this one
        if (this.isCheckInProgress) {
            return;
        }

        const signedDataPrice = this.signedDataPrice;

        if (!signedDataPrice) {
            return;
        }

        // Set flag to indicate check is in progress
        this.isCheckInProgress = true;
        this.isCheckingPayment.set(true);
        this.lastCheckTime.set(new Date());

        try {
            // Determine network based on payment method
            const network = this.getNetworkFromPaymentMethod();

            const response = await this.tagsService.checkPaymentConfirmation({
                tagName: this.tagName(),
                domain: this.domain(),
                token: signedDataPrice,
                network: network,
            });

            // Check if payment is confirmed
            if (response && response.data && response.data.confirmed === true) {
                // Stop checking
                if (this.paymentCheckInterval) {
                    clearInterval(this.paymentCheckInterval);
                    this.paymentCheckInterval = null;
                }

                // Update UI to show payment confirmed
                this.isPaymentConfirmed.set(true);

                // Store the amount received
                const receivedAmount = response.data.amountReceived || response.data.paymentConfirmation?.amountReceived || "0";
                this.amountReceived.set(receivedAmount);

                // Show success message
                this.snackBar.open("Payment confirmed successfully!", "Close", { duration: 5000 });

                // You can add redirect logic here
                // this.router.navigate(['/success-page']);
            }
        } catch (error) {
            console.error("Error checking payment status:", error);
        } finally {
            // Reset flag when check completes
            this.isCheckInProgress = false;
            this.isCheckingPayment.set(false);
            this.cdr.markForCheck();
        }
    }

    getNetworkFromPaymentMethod(): string {
        const method = this.paymentMethod();
        return method || "ETH"; // Return method as-is, default to ETH
    }

    ngOnDestroy(): void {
        if (this.paymentCheckInterval) {
            clearInterval(this.paymentCheckInterval);
        }
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private async generateQRCode(): Promise<void> {
        const dataToEncode = this.ethAddress();

        if (!dataToEncode) return;

        // Locate the container once
        if (!this.qrContainerEl) {
            this.qrContainerEl = this.elementRef.nativeElement.querySelector("#qrContainer");
        }

        if (!this.qrContainerEl) {
            return;
        }

        // Lazy import to avoid type issues and reduce bundle size
        const { default: QRCodeStyling } = await import("qr-code-styling");

        // Clear the container before regenerating
        if (this.qrContainerEl) {
            this.qrContainerEl.innerHTML = "";
        }

        // Create QR code with theme-appropriate colors
        this.qrCodeInstance = new QRCodeStyling({
            width: 256,
            height: 256,
            type: "svg",
            data: dataToEncode,
            qrOptions: {
                errorCorrectionLevel: "M",
            },
            dotsOptions: {
                type: "dots",
                color: this.isDarkMode() ? "#ffffff" : "#111827", // white in dark mode, gray-900 in light
            },
            cornersSquareOptions: {
                type: "extra-rounded",
                color: this.isDarkMode() ? "#ffffff" : "#111827",
            },
            cornersDotOptions: {
                type: "dot",
                color: this.isDarkMode() ? "#ffffff" : "#111827",
            },
            backgroundOptions: {
                color: "transparent",
            },
        });
        this.qrCodeInstance.append(this.qrContainerEl);
    }

    getFullTagName(): string {
        return `${this.tagName()}.${this.domain()}`.toUpperCase();
    }

    getDurationLabel(): string {
        const dur = this.duration();
        if (dur === 999) return "Lifetime";
        return dur === 1 ? "1 Year" : `${dur} Years`;
    }

    getPriceInUSD(): string {
        const price = this.price();
        if (price === "" || price === null || price === undefined) return "—";
        return `$${price} USD`;
    }

    getPricingDocsUrl(): string {
        const language = (navigator?.language || "en").toLowerCase();
        const isSpanish = language.startsWith("es");
        return isSpanish ? "https://docs.zelf.world/docs-es/airdrop/precios-por-dominio" : "https://docs.zelf.world/docs/airdrop/pricing-per-domain";
    }

    copyAddress(): void {
        navigator.clipboard.writeText(this.ethAddress()).then(() => {
            this.snackBar.open("Address copied to clipboard", "Close", { duration: 2500 });
        });
    }

    getAddressToDisplay(): string {
        return this.ethAddress();
    }

    getExpirationDate(): string {
        return "30 minutes";
    }

    copyAmount(): void {
        navigator.clipboard.writeText(this.amountToPay()).then(() => {
            this.snackBar.open("Amount copied to clipboard", "Close", { duration: 2500 });
        });
    }

    goBack(): void {
        // If payment is confirmed, clear the localStorage cache and go back without queryParams
        if (this.isPaymentConfirmed()) {
            this.signedDataPrice = null;

            // Navigate back to payment options without any queryParams (fresh state)
            this.router.navigate(["/portfolio/payment"]);
        } else {
            // If payment is not confirmed, go back with queryParams to preserve the state
            this.router.navigate(["/portfolio/payment"], {
                queryParams: {
                    tagname: this.tagName(),
                    domain: this.domain(),
                    duration: this.duration(),
                    ...(this.plan() ? { plan: this.plan() } : {}),
                },
            });
        }
    }

    async sendReceipt(): Promise<void> {
        const email = this.receiptEmail().trim();
        if (!email) {
            this.snackBar.open("Please enter your email address", "Close", { duration: 3000 });
            return;
        }

        // Basic email validation
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            this.snackBar.open("Please enter a valid email address", "Close", { duration: 3000 });
            return;
        }

        const signedDataPrice = this.signedDataPrice;
        if (!signedDataPrice) {
            this.snackBar.open("Payment data not found", "Close", { duration: 3000 });
            return;
        }

        this.isSendingReceipt.set(true);

        try {
            const network = this.getNetworkFromPaymentMethod();

            const response = await this.tagsService.emailReceipt({
                tagName: this.tagName(),
                domain: this.domain(),
                email: email,
                token: signedDataPrice,
                network: network,
            });

            if (response && response.data) {
                this.snackBar.open("Receipt sent successfully to your email!", "Close", { duration: 5000 });
                this.receiptEmail.set("");
            }
        } catch (error) {
            console.error("Error sending receipt:", error);
            this.snackBar.open("Failed to send receipt. Please try again later.", "Close", { duration: 5000 });
        } finally {
            this.isSendingReceipt.set(false);
            this.cdr.markForCheck();
        }
    }
}
