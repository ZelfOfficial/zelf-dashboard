import { Component, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, ViewChildren, QueryList } from "@angular/core";
import { CommonModule, KeyValuePipe } from "@angular/common";
import { ActivatedRoute, Router } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatCardModule } from "@angular/material/card";
import { MatChipsModule } from "@angular/material/chips";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { FormsModule } from "@angular/forms";
import { TranslocoModule } from "@jsverse/transloco";
import { TagsService, TagPreviewResponse } from "./tags.service";
import { LicensePricingService } from "app/core/pricing/license-pricing.service";
import { TagsWalletBalancesService, TagWalletBalancesData, WalletBalanceSlot } from "./tags-wallet-balances.service";
import { SaveConfirmationService } from "../../core/services/save-confirmation.service";
import { FuseConfigService } from "@fuse/services/config";
import { TranslocoService } from "@jsverse/transloco";
import { PermissionService } from "../../core/auth/permission.service";
import { Subject, takeUntil } from "rxjs";

export interface TagPreviewData {
    tagName: string;
    domain: string;
    tagType: "hold" | "purchased";
    // From preview.publicData
    ethAddress?: string;
    btcAddress?: string;
    solanaAddress?: string;
    zelfName?: string;
    leaseExpiresAt?: string;
    /** free | premium | unlimited, as stamped by the API (plans come from the license). */
    plan?: string;
    /** Years purchased, or "lifetime". */
    duration?: string;
    evm?: string;
    passwordLayer?: string;
    requireLiveness?: boolean;
    // From tagObject
    id?: string;
    owner?: string;
    url?: string;
    explorerUrl?: string;
    size?: number;
    zelfProof?: string;
    zelfProofQRCode?: string;
    hasPassword?: boolean;
    // Extra public data
    extraPublicData?: Record<string, unknown>;
}

@Component({
    selector: "app-tag-detail",
    standalone: true,
    imports: [
        CommonModule,
        KeyValuePipe,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatChipsModule,
        MatSnackBarModule,
        FormsModule,
        TranslocoModule,
    ],
    templateUrl: "./tag-detail.component.html",
    styleUrls: ["./tag-detail.component.scss"],
})
export class TagDetailComponent implements OnInit, OnDestroy {
    @ViewChildren("qrContainer") qrContainers!: QueryList<ElementRef>;

    tagId: string = "";
    tagName: string = "";
    domain: string = "";
    tagType: "hold" | "purchased" = "purchased";
    previewData: TagPreviewData | null = null;
    isLoading = true;
    isNotFound = false;
    isAvailableForPurchase = false;
    purchasePrice: { price: number; currency: string; reward: number; discount?: number; priceWithoutDiscount?: number } | null = null;
    isDarkMode = false;
    copiedField: string | null = null;

    // License extension
    /** Duration key as in the license planPricing ("1", "2", …, "lifetime"). */
    licenseDuration: string = "";
    /** Durations the license prices for this name (loaded from the API; nothing hardcoded). */
    durationOptions: { value: string; label: string }[] = [];
    paymentOptions: any = null;
    /** Paid plans the license prices for this name length (cheapest first). */
    planOptions: string[] = [];
    selectedPlan: string = "";
    /** API refusal for the selected plan/duration (e.g. plan_downgrade_not_allowed). */
    quoteError: string = "";
    isLoadingPayment = false;
    showTechnical = false;

    walletBalances: TagWalletBalancesData | null = null;
    walletBalancesLoading = false;
    walletBalancesError: string | null = null;

    // Reveal state for addresses
    revealedAddresses: Set<string> = new Set();

    // Owner extension
    isExtendingForOwner = false;
    ownerExtendSuccess = false;

    private destroy$ = new Subject<void>();
    private darkModeObserver?: MutationObserver;
    private qrCodes: Map<string, any> = new Map();

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private tagsService: TagsService,
        private licensePricing: LicensePricingService,
        private tagsWalletBalancesService: TagsWalletBalancesService,
        private cdr: ChangeDetectorRef,
        private snackBar: MatSnackBar,
        private _fuseConfigService: FuseConfigService,
        private saveConfirmationService: SaveConfirmationService,
        private translocoService: TranslocoService,
        public permissionService: PermissionService,
    ) {}

    ngOnInit(): void {
        this.mergeWalletBalanceTranslations();

        this._fuseConfigService.config$.pipe(takeUntil(this.destroy$)).subscribe((config) => {
            this.isDarkMode = config.scheme === "dark" || (config.scheme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);

            // Regenerate QR codes when theme changes
            if (this.qrCodes.size > 0) {
                this.generateAllQRCodes();
            }
            this.cdr.markForCheck();
        });

        this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
            this.tagId = params.get("tagId") || "";
            if (!this.tagId) {
                this.isNotFound = true;
                this.isLoading = false;
                this.cdr.markForCheck();
                return;
            }
            this._parseTagId();
            this._loadTag();
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.darkModeObserver?.disconnect();
        this.qrCodes.clear();
    }

    private _parseTagId(): void {
        let id = this.tagId;
        const hasHold = id.includes(".hold");
        this.tagType = hasHold ? "hold" : "purchased";

        if (hasHold) {
            id = id.replace(".hold", "");
        }

        const lastDot = id.lastIndexOf(".");
        if (lastDot > 0) {
            this.tagName = id.slice(0, lastDot);
            this.domain = id.slice(lastDot + 1);
        } else {
            this.tagName = id;
            this.domain = "";
        }
    }

    private _loadTag(): void {
        void this.loadDurationOptions();
        this.isLoading = true;
        this.isNotFound = false;
        this.isAvailableForPurchase = false;
        this.previewData = null;
        this.purchasePrice = null;
        this.walletBalances = null;
        this.walletBalancesError = null;
        this.walletBalancesLoading = false;

        const domain = this.domain || undefined;
        this.tagsService
            .previewTag({ tagName: this.tagName, domain, os: "DESKTOP" })
            .then((res: TagPreviewResponse) => {
                const d = res?.data;
                if (!d) {
                    this.isNotFound = true;
                    return;
                }

                if (d.available === true) {
                    this.isAvailableForPurchase = true;
                    this.purchasePrice = d.price
                        ? {
                              price: d.price.price,
                              currency: d.price.currency,
                              reward: d.price.reward,
                              discount: d.price.discount,
                              priceWithoutDiscount: d.price.priceWithoutDiscount,
                          }
                        : null;
                    return;
                }

                const preview = d.preview;
                const tagObj = d.tagObject;
                const previewPub = preview?.publicData || {};
                const tagObjPub = tagObj?.publicData || {};

                const knownKeys = new Set([
                    "ethAddress",
                    "btcAddress",
                    "solanaAddress",
                    "zelfName",
                    "leaseExpiresAt",
                    "evm",
                    "zelfProof",
                    "zelfProofQRCode",
                    "hasPassword",
                    "Content-Type",
                    "domain",
                    "avaxName",
                    "extraParams",
                    "expiresAt",
                ]);

                const extra: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(tagObjPub)) {
                    if (!knownKeys.has(k) && v) extra[k] = v;
                }
                for (const [k, v] of Object.entries(previewPub)) {
                    if (!knownKeys.has(k) && v && !(k in extra)) extra[k] = v;
                }

                this.previewData = {
                    tagName: this.tagName,
                    domain: this.domain,
                    tagType: this.tagType,
                    ethAddress: previewPub.ethAddress || tagObjPub.ethAddress || "",
                    btcAddress: previewPub.btcAddress || tagObjPub.btcAddress || "",
                    solanaAddress: previewPub.solanaAddress || tagObjPub.solanaAddress || "",
                    zelfName: previewPub.zelfName || tagObjPub.zelfName || this.tagId,
                    plan: String(tagObjPub.plan || previewPub.plan || "").toLowerCase(),
                    duration: String(tagObjPub.duration ?? previewPub.duration ?? ""),
                    leaseExpiresAt: previewPub.leaseExpiresAt || tagObjPub.leaseExpiresAt || previewPub.expiresAt || tagObjPub.expiresAt || "",
                    evm: previewPub.evm || tagObjPub.evm || "",
                    passwordLayer: preview?.passwordLayer || "",
                    requireLiveness: preview?.requireLiveness || false,
                    id: tagObj?.id || "",
                    owner: tagObj?.owner || "",
                    url: tagObj?.url || "",
                    explorerUrl: tagObj?.explorerUrl || "",
                    size: typeof tagObj?.size === "string" ? parseInt(tagObj.size, 10) : (tagObj?.size as number) || 0,
                    zelfProof: tagObj?.zelfProof || tagObjPub.zelfProof || "",
                    zelfProofQRCode: tagObj?.zelfProofQRCode || tagObjPub.zelfProofQRCode || "",
                    hasPassword: tagObjPub.hasPassword === "true",
                    extraPublicData: Object.keys(extra).length > 0 ? extra : undefined,
                };
                if (this.planOptions.length) void this.loadDurationOptions();

                // Trigger payment options fetch automatically on load
                this.extendLicense();
                this.loadWalletBalances();
            })
            .catch(() => {
                this.isNotFound = true;
            })
            .finally(() => {
                this.isLoading = false;
                this.cdr.markForCheck();
            });
    }

    formatDate(s: string): string {
        if (!s) return "—";
        return new Date(s).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    formatFullDate(s: string): string {
        if (!s) return "—";
        return new Date(s).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    formatFileSize(bytes: number): string {
        if (!bytes || bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    daysUntilExpiry(): number | null {
        if (!this.previewData?.leaseExpiresAt) return null;
        const diff = new Date(this.previewData.leaseExpiresAt).getTime() - Date.now();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    isExpiringSoon(): boolean {
        const days = this.daysUntilExpiry();
        return days !== null && days <= 30;
    }

    isExpired(): boolean {
        const days = this.daysUntilExpiry();
        return days !== null && days <= 0;
    }

    async copyToClipboard(text: string, field: string, showToast = true): Promise<void> {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            this.copiedField = field;
            if (showToast) {
                this.snackBar.open("Copied to clipboard!", "Close", { duration: 2000, horizontalPosition: "center", verticalPosition: "bottom" });
            }
            setTimeout(() => {
                this.copiedField = null;
                this.cdr.markForCheck();
            }, 2000);
            this.cdr.markForCheck();
        } catch (e) {
            console.error("Copy failed", e);
        }
    }

    toggleAddressReveal(currency: string, address: string): void {
        if (this.revealedAddresses.has(currency)) {
            this.revealedAddresses.delete(currency);
        } else {
            this.revealedAddresses.add(currency);
            this.copyToClipboard(address, "pay" + currency);
        }
        this.cdr.markForCheck();
    }

    isAddressRevealed(currency: string): boolean {
        return this.revealedAddresses.has(currency);
    }

    async copyAllData(): Promise<void> {
        if (!this.previewData) return;
        await this.copyToClipboard(JSON.stringify(this.previewData, null, 2), "all");
    }

    openUrl(url: string): void {
        if (url) window.open(url, "_blank");
    }

    truncateAddress(addr: string): string {
        if (!addr || addr.length <= 16) return addr || "";
        return addr.slice(0, 8) + "..." + addr.slice(-6);
    }

    async selectDuration(duration: number | string): Promise<void> {
        this.licenseDuration = String(duration);
        await this.extendLicense();
    }

    /** Load the durations the license offers for this name length (any plan offered at that length). */
    private async loadDurationOptions(): Promise<void> {
        if (!this.tagName || !this.domain) return;
        try {
            if (!this.planOptions.length) {
                this.planOptions = await this.licensePricing.plansFor(this.domain, this.tagName);
            }
            this.syncSelectedPlan();
            const durations = await this.licensePricing.durationsFor(this.domain, this.tagName, this.selectedPlan || undefined);
            this.durationOptions = durations.map((d) => ({ value: d, label: d }));
            if (!durations.includes(this.licenseDuration)) this.licenseDuration = durations[0] || "";
        } catch (e) {
            console.error("License durations error", e);
            this.durationOptions = [];
        }
        this.cdr.markForCheck();
    }

    getPaymentAddress(currency: string): string {
        if (!this.paymentOptions?.paymentAddress) return "";
        const addr = this.paymentOptions.paymentAddress;
        switch (currency) {
            case "ETH":
                return addr.ethAddress;
            case "BTC":
                return addr.btcAddress;
            case "SOL":
                return addr.solanaAddress;
            case "AVAX":
                return addr.avalancheAddress;
            default:
                return "";
        }
    }

    getEvmChains(): string[] {
        if (!this.previewData?.evm) return [];
        return this.previewData.evm
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);
    }

    hasAnyPublicAddress(): boolean {
        const p = this.previewData;
        if (!p) return false;
        return Boolean(p.ethAddress || p.btcAddress || p.solanaAddress);
    }

    loadWalletBalances(): void {
        if (!this.previewData || this.isAvailableForPurchase) return;
        const eth = this.previewData.ethAddress?.trim();
        const btc = this.previewData.btcAddress?.trim();
        const sol = this.previewData.solanaAddress?.trim();
        if (!eth && !btc && !sol) return;

        this.walletBalancesLoading = true;
        this.walletBalancesError = null;
        this.cdr.markForCheck();

        this.tagsWalletBalancesService
            .getWalletBalances({
                ...(eth ? { ethAddress: eth } : {}),
                ...(btc ? { btcAddress: btc } : {}),
                ...(sol ? { solanaAddress: sol } : {}),
            })
            .then((res) => {
                this.walletBalances = res?.data ?? null;
            })
            .catch(() => {
                this.walletBalances = null;
                this.walletBalancesError = "tags.detail.walletBalancesError";
            })
            .finally(() => {
                this.walletBalancesLoading = false;
                this.cdr.markForCheck();
            });
    }

    refreshWalletBalances(): void {
        this.loadWalletBalances();
    }

    formatWalletBalanceLine(slot: WalletBalanceSlot | undefined): string {
        if (!slot) return "—";
        if (slot.error) {
            return this.translocoService.translate("tags.detail.walletBalanceUnavailable");
        }
        if (slot.value === null || slot.value === undefined || slot.value === "") {
            return "—";
        }
        return `${slot.value} ${slot.unit}`;
    }

    /** Merges tag-detail wallet strings when host `public/i18n/*.json` cannot be patched in this environment. */
    private mergeWalletBalanceTranslations(): void {
        const payload = {
            tags: {
                detail: {
                    balance: "Balance",
                    refreshBalances: "Refresh balances",
                    sameEvmAddress: "Same address as Ethereum (C-chain / BlockDAG)",
                    walletBalancesError: "Could not load balances. Try refresh.",
                    walletBalanceUnavailable: "Unavailable",
                },
            },
        };
        const active = this.translocoService.getActiveLang();
        for (const lang of [...new Set(["en", active])]) {
            this.translocoService.setTranslation(payload, lang, { merge: true });
        }
    }

    /** Plan the Zelf ID has now; expired paid plans read as free. */
    currentPlan(): string {
        if (this.previewData?.tagType === "hold") return "hold";
        if (this.isExpired()) return "free";
        return this.previewData?.plan || "unknown";
    }

    /**
     * Default the plan picker to the current plan, and never leave a disabled (lower) plan selected.
     * Runs again once the Zelf ID data arrives, since the license plans may load first.
     */
    private syncSelectedPlan(): void {
        const current = this.currentPlan();
        if (!this.selectedPlan || this.isDowngrade(this.selectedPlan) || !this.planOptions.includes(this.selectedPlan)) {
            this.selectedPlan = this.planOptions.includes(current) ? current : this.planOptions[0] || "";
        }
    }

    /** Active lifetime lease on the selected (same or lower) plan: there is nothing to buy. */
    nothingToExtend(): boolean {
        if (!this.isLifetimeLease() || this.isExpired()) return false;
        const cur = this.planOptions.indexOf(this.currentPlan());
        const sel = this.planOptions.indexOf(this.selectedPlan);
        return cur >= 0 && sel >= 0 && sel <= cur;
    }

    isLifetimeLease(): boolean {
        return String(this.previewData?.duration || "").toLowerCase() === "lifetime";
    }

    /** Plans ranked like the license (cheapest first); a lower rank than the current plan is a downgrade. */
    isDowngrade(plan: string): boolean {
        const cur = this.planOptions.indexOf(this.currentPlan());
        const idx = this.planOptions.indexOf(plan);
        return cur >= 0 && idx >= 0 && idx < cur;
    }

    async selectPlan(plan: string): Promise<void> {
        if (this.selectedPlan === plan) return;
        this.selectedPlan = plan;
        this.paymentOptions = null;
        this.quoteError = "";
        await this.loadDurationOptions();
    }

    /** USD list price of the quote (same for every network). */
    quoteUsd(): number | null {
        const prices = this.paymentOptions?.prices || {};
        const hit = Object.values(prices).find((p: any) => p && typeof p.price === "number") as any;
        return hit ? hit.price : null;
    }

    async extendLicense(): Promise<void> {
        if (!this.tagName || !this.domain || !this.licenseDuration) return;
        this.syncSelectedPlan();
        if (this.nothingToExtend()) {
            this.paymentOptions = null;
            this.quoteError = "";
            this.cdr.markForCheck();
            return;
        }
        this.isLoadingPayment = true;
        this.cdr.markForCheck();
        try {
            const res = await this.tagsService.getPaymentOptions({
                tagName: this.tagName,
                domain: this.domain,
                duration: this.licenseDuration,
                ...(this.selectedPlan ? { plan: this.selectedPlan } : {}),
            });
            this.quoteError = "";
            this.paymentOptions = res?.data;
            this.revealedAddresses.clear();

            // Wait a bit longer for DOM to update then generate QR codes
            setTimeout(() => this.generateAllQRCodes(), 300);
        } catch (e: any) {
            console.error("Payment options error", e);
            this.paymentOptions = null;
            const code = String(e?.error?.message || e?.error?.validationError || "").trim();
            const known = ["plan_downgrade_not_allowed", "lifetime_already_owned", "plan_not_offered_for_name", "plan_duration_not_offered_by_license"];
            this.quoteError = known.includes(code) ? code : "quote_failed";
        } finally {
            this.isLoadingPayment = false;
            this.cdr.markForCheck();
        }
    }

    private async generateAllQRCodes(): Promise<void> {
        const currencies = ["ETH", "SOL", "AVAX"];
        for (const cur of currencies) {
            const addr = this.getPaymentAddress(cur);
            if (addr) {
                await this.generateQRCode(cur, addr);
            }
        }
    }

    private async generateQRCode(currency: string, data: string): Promise<void> {
        const { default: QRCodeStyling } = await import("qr-code-styling");

        const container = this.qrContainers.find((c) => c.nativeElement.id === `qr-${currency}`);
        if (!container) {
            console.warn(`QR container for ${currency} not found`);
            return;
        }

        container.nativeElement.innerHTML = "";

        const qrCode = new QRCodeStyling({
            width: 140,
            height: 140,
            type: "svg",
            data: data,
            qrOptions: { errorCorrectionLevel: "H" },
            dotsOptions: {
                type: "dots",
                color: this.isDarkMode ? "#ffffff" : "#111827",
            },
            cornersSquareOptions: {
                type: "extra-rounded",
                color: this.isDarkMode ? "#ffffff" : "#111827",
            },
            backgroundOptions: { color: "transparent" },
        });

        qrCode.append(container.nativeElement);
        this.qrCodes.set(currency, qrCode);
    }

    ownerExtendLicense(): void {
        if (!this.tagName || !this.domain) return;

        this.saveConfirmationService.setSaveData({
            domain: this.domain,
            domainConfig: null,
            redirectUrl: `/tags/${this.tagId}`,
            operation: {
                title: this.translocoService.translate("tags.detail.extendLicense"),
                description: this.translocoService.translate("tags.detail.extend_license_summary", {
                    tagName: this.tagName,
                    domain: this.domain,
                    duration:
                        String(this.licenseDuration) === "lifetime"
                            ? this.translocoService.translate("tags.detail.lifetime")
                            : this.licenseDuration +
                              " " +
                              this.translocoService.translate(String(this.licenseDuration) === "1" ? "tags.detail.year" : "tags.detail.years"),
                }),
                action: "extending",
                itemName: this.translocoService.translate("saving_operations.tag_license"),
            },
            tagExtensionData: {
                tagName: this.tagName,
                domain: this.domain,
                duration: this.licenseDuration,
            },
        });

        this.router.navigate(["/save-confirmation"], {
            queryParams: { redirect: `/tags/${this.tagId}` },
        });
    }

    backToList(): void {
        this.router.navigate(["/tags"]);
    }
}
