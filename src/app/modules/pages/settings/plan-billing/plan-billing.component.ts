import { CommonModule, NgClass } from "@angular/common";
import { ActivatedRoute } from "@angular/router";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewEncapsulation } from "@angular/core";
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { TranslocoModule } from "@jsverse/transloco";
import { AuthService } from "app/core/auth/auth.service";
import { SolanaService } from "app/core/services/solana.service";
import {
	Price,
	SubscribeRequest,
	SubscriptionPlan,
	SubscriptionPlansService,
	SubscriptionPricingMeta,
} from "app/core/services/subscription-plans.service";
import { getPlanFeatureRows, isHighlightedPlanTier } from "./plan-billing-plan-features";
import { PlanBillingActiveSubscriptionComponent } from "./plan-billing-active-subscription.component";
import { PlanBillingPlanCardComponent } from "./plan-billing-plan-card.component";
import { PlanBillingPlanGridComponent } from "./plan-billing-plan-grid.component";
import { PlanBillingZnsBalanceComponent } from "./plan-billing-zns-balance.component";
import {
	PlanBillingPricingCreditRow,
	PlanBillingZnsPricingSectionComponent,
} from "./plan-billing-zns-pricing-section.component";

/** Persist auto reconcile attempts per logged-in user + Stripe subscription (not manual Refresh). */
const ZNS_AUTO_RECONCILE_STORAGE_KEY = "planBillingZnsAutoReconcile";
const MAX_AUTO_RECONCILE_ATTEMPTS = 3;

interface ZnsAutoReconcilePersist {
	subscriptionId: string;
	autoAttempts: number;
}

@Component({
    selector: "settings-plan-billing",
    templateUrl: "./plan-billing.component.html",
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        NgClass,
        MatIconModule,
        MatButtonModule,
        TranslocoModule,
        PlanBillingActiveSubscriptionComponent,
        PlanBillingPlanGridComponent,
        PlanBillingPlanCardComponent,
        PlanBillingZnsBalanceComponent,
        PlanBillingZnsPricingSectionComponent,
    ],
})
export class SettingsPlanBillingComponent implements OnInit {
    planBillingForm: UntypedFormGroup;
    plans: SubscriptionPlan[] = [];
    pricingMeta: SubscriptionPricingMeta | null = null;
    loading: boolean = false;
    znsBalance: number | null = null;
    znsBalanceLoading: boolean = false;
    solanaAddress: string | null = null;
    subscribing: boolean = false;
    error: string | null = null;
    hasSubscription: boolean = false;
    mySubscription: any = null;
    showPlanComparison: boolean = false;
    selectedUpgradePlan: SubscriptionPlan | null = null;
    /** Invoices are not exposed by the v4 API; they are shown in the Stripe customer portal. */
    billingHistory: any[] = [];
    initialLoading: boolean = true;
    subscribingPlanId: string | null = null;

    readonly featureRowsForPlan = getPlanFeatureRows;
    readonly isHighlightedTier = isHighlightedPlanTier;

    constructor(
        private _formBuilder: UntypedFormBuilder,
        private _subscriptionPlansService: SubscriptionPlansService,
        private _cdr: ChangeDetectorRef,
        private _activatedRoute: ActivatedRoute,
        private _authService: AuthService,
        private _solanaService: SolanaService,
    ) {}

    get plansToShow(): SubscriptionPlan[] {
        return this.hasSubscription ? this.getUpgradePlans() : this.plans;
    }

    async ngOnInit(): Promise<void> {
        this.checkSubscriptionStatus();

        this.planBillingForm = this._formBuilder.group({
            plan: [""],
            cardHolder: ["Brian Hughes"],
            cardNumber: [""],
            cardExpiration: [""],
            cardCVC: [""],
            country: ["usa"],
            zip: [""],
        });

        try {
            const sessionId = this._activatedRoute.snapshot.queryParamMap.get("session_id");

            if (sessionId) await this.handleSessionVerification(sessionId);

            await this.loadMyPlan();

            await this.loadSubscriptionPlans();

            await this.reconcileZnsGrant({ force: false });

            this.refreshZnsBalance();
        } catch (err) {
            console.error("Error initializing plan billing:", err);
        } finally {
            this.initialLoading = false;
            this._cdr.detectChanges();
        }
    }

    /**
     * Ask the backend to reconcile monthly ZNS grants for the active subscription.
     * Automatic calls (page load) are capped per subscription via localStorage — manual
     * Refresh passes `force: true` and always POSTs.
     */
    async reconcileZnsGrant(options?: { force?: boolean }): Promise<void> {
        const force = options?.force === true;

        if (!this.hasSubscription) {
            console.info("[plan-billing] reconcileZnsGrant skipped", {
                reason: "hasSubscription_false",
                stripeStatus: this.mySubscription?.subscription?.status ?? null,
                hint: "Dashboard only reconciles when GET my-subscription reports status active",
            });
            return;
        }

        const subscriptionId = this.mySubscription?.subscription?.id ?? null;

        if (!force && subscriptionId) {
            const attempts = this.getZnsAutoReconcileAttempts(subscriptionId);
            if (attempts >= MAX_AUTO_RECONCILE_ATTEMPTS) {
                console.info("[plan-billing] reconcileZnsGrant skipped (auto attempts exhausted)", {
                    subscriptionId,
                    attempts,
                    max: MAX_AUTO_RECONCILE_ATTEMPTS,
                    hint: "Use Refresh on the ZNS card to reconcile again, or clear localStorage planBillingZnsAutoReconcile",
                });
                return;
            }
        }

        console.info("[plan-billing] reconcileZnsGrant calling POST …/subscription-plans/reconcile-zns", {
            force,
            subscriptionId,
        });

        try {
            const payload = await this._subscriptionPlansService.reconcileZnsGrant();
            console.info("[plan-billing] reconcileZnsGrant response", payload);
        } catch (err) {
            console.warn("[plan-billing] reconcileZnsGrant request threw", err);
        } finally {
            if (!force && subscriptionId) {
                this.bumpZnsAutoReconcileAttempts(subscriptionId);
            }
        }
    }

    private znsReconcileStorageEmailKey(): string | null {
        const email = this._authService.ownerEmail?.trim().toLowerCase();
        return email && email.length > 0 ? email : null;
    }

    private readZnsReconcileBucket(): Record<string, ZnsAutoReconcilePersist> {
        try {
            const raw = localStorage.getItem(ZNS_AUTO_RECONCILE_STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw) as Record<string, ZnsAutoReconcilePersist>;
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
            return {};
        }
    }

    private writeZnsReconcileBucket(bucket: Record<string, ZnsAutoReconcilePersist>): void {
        try {
            localStorage.setItem(ZNS_AUTO_RECONCILE_STORAGE_KEY, JSON.stringify(bucket));
        } catch {
            /* ignore quota / private mode */
        }
    }

    /** Attempt count for this Stripe subscription only; resets when subscriptionId changes. */
    private getZnsAutoReconcileAttempts(subscriptionId: string): number {
        const emailKey = this.znsReconcileStorageEmailKey();
        if (!emailKey) return 0;
        const row = this.readZnsReconcileBucket()[emailKey];
        if (!row || row.subscriptionId !== subscriptionId) return 0;
        return typeof row.autoAttempts === "number" && row.autoAttempts >= 0 ? row.autoAttempts : 0;
    }

    private bumpZnsAutoReconcileAttempts(subscriptionId: string): void {
        const emailKey = this.znsReconcileStorageEmailKey();
        if (!emailKey) return;
        const bucket = this.readZnsReconcileBucket();
        const prev = bucket[emailKey];
        const base =
            prev && prev.subscriptionId === subscriptionId && typeof prev.autoAttempts === "number"
                ? prev.autoAttempts
                : 0;
        bucket[emailKey] = { subscriptionId, autoAttempts: base + 1 };
        this.writeZnsReconcileBucket(bucket);
    }

    async handleSessionVerification(sessionId: string): Promise<void> {
        this.initialLoading = true;
        this._cdr.detectChanges();

        await new Promise((resolve) => setTimeout(resolve, 3000));

        try {
            await this._subscriptionPlansService.verifySession(sessionId);
        } catch (err) {
            console.error("Session verification failed", err);
            this.error = "Failed to verify subscription. Please contact support.";
        }
    }

    async loadMyPlan(): Promise<void> {
        try {
            this.mySubscription = await this._subscriptionPlansService.getMySubscription();
            this.hasSubscription = this.mySubscription && this.mySubscription.subscription && this.mySubscription.subscription.status === "active";
            this._cdr.detectChanges();
        } catch (error) {
            console.error("Failed to load subscription:", error);
            this.hasSubscription = false;
        }
    }

    async loadSubscriptionPlans(): Promise<void> {
        this.loading = true;
        this.error = null;

        try {
            const { plans, pricingMeta } = await this._subscriptionPlansService.getSubscriptionPlans();

            this.pricingMeta = pricingMeta;
            this.plans = plans.sort((a, b) => {
                const priceA = this.getCheapestPrice(a)?.unit_amount || 0;
                const priceB = this.getCheapestPrice(b)?.unit_amount || 0;
                return priceA - priceB;
            });

            if (plans.length > 0) {
                this.planBillingForm.patchValue({ plan: plans[0].id });
            }

            this._cdr.detectChanges();
        } catch (error: any) {
            this.error = `Failed to load subscription plans: ${error.message || "Unknown error"}`;
        } finally {
            this.loading = false;
            this._cdr.detectChanges();
        }
    }

    checkSubscriptionStatus(): void {
        try {
            const subscription = localStorage.getItem("subscription");
            this.hasSubscription = subscription !== null && subscription !== "null" && subscription !== "";
        } catch (error) {
            this.hasSubscription = false;
        }
    }

    trackByFn(index: number, item: SubscriptionPlan): any {
        return item.id || index;
    }

    formatPrice(unitAmount: number, currency: string): string {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency.toUpperCase(),
        }).format(unitAmount / 100);
    }

    /**
     * Resolve the current logged-in client's Solana address.
     * The dashboard header reads `localStorage.wallet`, while the auth payload stores
     * the address under `publicData`/`keyvalues`. Try both so the balance card mirrors
     * whatever the user already sees in the header.
     */
    private resolveSolanaAddress(): string | null {
        const account = this._authService.zelfAccount;
        const pub = account?.publicData ?? account?.keyvalues ?? {};
        const fromAuth = pub?.solanaAddress;
        if (typeof fromAuth === "string" && fromAuth.length > 0) return fromAuth;

        try {
            const raw = localStorage.getItem("wallet");
            if (!raw) return null;
            const wallet = JSON.parse(raw) ?? {};
            const fromWallet = wallet?.solanaAddress;
            return typeof fromWallet === "string" && fromWallet.length > 0 ? fromWallet : null;
        } catch {
            return null;
        }
    }

    /** Public refresh: reconcile grants (if subscribed), then re-fetch ZNS balance from the indexer-backed API. */
    async refreshZnsBalance(): Promise<void> {
        console.info("[plan-billing] refreshZnsBalance start", {
            hasSubscription: this.hasSubscription,
            stripeStatus: this.mySubscription?.subscription?.status ?? null,
        });

        if (this.hasSubscription) {
            await this.reconcileZnsGrant({ force: true });
        }

        const address = this.resolveSolanaAddress();
        this.solanaAddress = address;

        if (!address) {
            console.info("[plan-billing] refreshZnsBalance stop: no Solana address (checked zelfAccount + localStorage.wallet)");
            this.znsBalance = null;
            this.znsBalanceLoading = false;
            this._cdr.detectChanges();
            return;
        }

        console.info("[plan-billing] refreshZnsBalance fetching indexer balance", {
            solanaPreview: `${address.slice(0, 4)}…${address.slice(-4)}`,
        });

        this.znsBalanceLoading = true;
        this._cdr.detectChanges();

        try {
            this.znsBalance = await this._solanaService.getZnsBalance(address);
            console.info("[plan-billing] refreshZnsBalance balance result", { znsBalance: this.znsBalance });
        } catch (err) {
            console.error("Failed to load ZNS balance:", err);
            this.znsBalance = 0;
        } finally {
            this.znsBalanceLoading = false;
            this._cdr.detectChanges();
        }
    }

    /** Monthly ZNS credited ≈ ceil(subscription USD / rewardPrice); uses Stripe list price. */
    getEstimatedMonthlyZns(price: Price | null): number | null {
        if (!price?.unit_amount || !this.pricingMeta?.rewardPrice) return null;
        const rp = this.pricingMeta.rewardPrice;
        if (!(rp > 0)) return null;
        return Math.ceil(price.unit_amount / 100 / rp);
    }

    /** Per-tier estimated monthly ZNS rows for the pricing section's credit table. */
    getCreditRows(): PlanBillingPricingCreditRow[] {
        if (!this.pricingMeta) return [];

        return this.plansToShow
            .map((plan) => {
                const price = this.getCheapestPrice(plan);
                if (!price) return null;

                return {
                    planLabel: this.getPlanDisplayName(plan.metadata.zelfPlan),
                    priceLabel: this.formatPrice(price.unit_amount, price.currency),
                    estimatedZns: this.getEstimatedMonthlyZns(price),
                };
            })
            .filter((row): row is PlanBillingPricingCreditRow => row !== null);
    }

    getCheapestPrice(plan: SubscriptionPlan): Price | null {
        if (!plan.prices || plan.prices.length === 0) return null;

        const validPrices = plan.prices.filter((price) => price.active && price.unit_amount > 0).sort((a, b) => a.unit_amount - b.unit_amount);

        return validPrices.length > 0 ? validPrices[0] : null;
    }

    getPlanDisplayName(zelfPlan: string): string {
        const planNames: { [key: string]: string } = {
            zelfBasic: "BASIC",
            ZelfGold: "GOLD",
            zelfGold: "GOLD",
            zelfBusiness: "BUSINESS",
            zelfStartUp: "STARTUP",
            zelfEnterprise: "ENTERPRISE",
        };
        return planNames[zelfPlan] || zelfPlan.toUpperCase();
    }

    selectPlan(planId: string): void {
        this.planBillingForm.patchValue({ plan: planId });
        this._cdr.detectChanges();
    }

    isPlanSelected(planId: string): boolean {
        return this.planBillingForm.get("plan")?.value === planId;
    }

    async onSubscribe(planId: string): Promise<void> {
        if (!planId) return;

        const selectedPlan = this.plans.find((plan) => plan.id === planId);

        if (!selectedPlan) return;

        const cheapestPrice = this.getCheapestPrice(selectedPlan);

        if (!cheapestPrice) return;

        this.subscribing = true;
        this.subscribingPlanId = planId;

        this.error = null;

        this._cdr.detectChanges();

        try {
            const subscribeRequest: SubscribeRequest = {
                productId: selectedPlan.id,
                priceId: cheapestPrice.id,
                customerEmail: null,
            };

            const response = await this._subscriptionPlansService.subscribe(subscribeRequest);

            if (response && response.success && response.url) {
                window.location.href = response.url;

                return;
            }

            throw new Error("Failed to create checkout session");
        } catch (error: any) {
            this.error = `Failed to create checkout session: ${error.message || "Unknown error"}`;
        } finally {
            this.subscribing = false;
            this.subscribingPlanId = null;
            this._cdr.detectChanges();
        }
    }

    getCurrentPlan(): any {
        if (!this.mySubscription || !this.mySubscription.product) return null;
        return this.mySubscription.product;
    }

    getCurrentSubscription(): any {
        if (!this.mySubscription || !this.mySubscription.subscription) return null;
        return this.mySubscription.subscription;
    }

    formatDate(timestamp: number): string {
        return new Date(timestamp * 1000).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }

    getStatusBadgeColor(status: string): string {
        switch (status) {
            case "active":
                return "bg-green-100 text-green-800";
            case "canceled":
                return "bg-red-100 text-red-800";
            case "past_due":
                return "bg-yellow-100 text-yellow-800";
            case "unpaid":
                return "bg-red-100 text-red-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    }

    showUpgradeComparison(plan: SubscriptionPlan): void {
        this.selectedUpgradePlan = plan;
        this.showPlanComparison = true;
        this._cdr.detectChanges();
    }

    hidePlanComparison(): void {
        this.showPlanComparison = false;
        this.selectedUpgradePlan = null;
        this._cdr.detectChanges();
    }

    getUpgradePlans(): SubscriptionPlan[] {
        if (!this.mySubscription || !this.mySubscription.subscription) return this.plans;

        const currentPrice = this.mySubscription.subscription.plan.amount;
        return this.plans.filter((plan) => {
            const cheapestPrice = this.getCheapestPrice(plan);
            return cheapestPrice && cheapestPrice.unit_amount > currentPrice;
        });
    }

    async openStripePortal(): Promise<void> {
        try {
            const response = await this._subscriptionPlansService.createStripePortalSession();

            if (response && response.success && response.url) {
                window.location.href = response.url;
                return;
            }

            throw new Error("Failed to create portal session");
        } catch (error: any) {
            this.error = `Failed to open billing portal: ${error.message || "Unknown error"}`;
            this._cdr.detectChanges();
        }
    }





    getPlanUsage(): any {
        if (!this.mySubscription || !this.mySubscription.domainConfig) return null;

        const config = this.mySubscription.domainConfig;
        return {
            activeUsers: this.getActiveUserLimit(),
            encryptions: this.getEncryptionLimit(),
            storage: config.storage || {},
            features: config.features || [],
        };
    }

    getActiveUserLimit(): number {
        const plan = this.getCurrentPlan();
        if (!plan) return 0;

        switch (plan.metadata.zelfPlan) {
            case "zelfBasic":
                return 50;
            case "zelfStartUp":
                return 500;
            case "zelfBusiness":
                return 1250;
            case "zelfGold":
            case "ZelfGold":
                return 3000;
            case "zelfEnterprise":
                return 10000;
            default:
                return 0;
        }
    }

    getEncryptionLimit(): number | string {
        const plan = this.getCurrentPlan();
        if (!plan) return 0;

        return plan.metadata.zelfPlan === "zelfBasic" ? 50 : "Unlimited";
    }

    /**
     * Cancel: v4 has no cancel-subscription endpoint, so cancellation goes through the
     * Stripe customer portal (POST /api/subscription-plans/create-portal-session).
     */
    async cancelSubscription(): Promise<void> {
        await this.openStripePortal();
    }

    /**
     * Upgrade: v4 has no upgrade-subscription endpoint; plan changes are done in the
     * Stripe customer portal so Stripe handles proration.
     */
    async upgradeToPlan(_plan: SubscriptionPlan): Promise<void> {
        await this.openStripePortal();
    }
}
