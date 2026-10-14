import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { HttpWrapperService } from "app/http-wrapper.service";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

export interface SubscriptionPlan {
	id: string;
	object: string;
	active: boolean;
	attributes: any[];
	created: number;
	default_price: string;
	description: string;
	images: string[];
	livemode: boolean;
	marketing_features: any[];
	metadata: {
		planType: string;
		zelfPlan: string;
	};
	name: string;
	package_dimensions: any;
	shippable: any;
	statement_descriptor: any;
	tax_code: string;
	type: string;
	unit_label: any;
	updated: number;
	url: any;
	prices: Price[];
}

/** Mirrors `pricingMeta` from GET /api/subscription-plans (backend Core/buildSubscriptionPricingMeta). */
export interface SubscriptionPricingMeta {
	rewardPrice: number;
	rewardPriceFormatted: string;
	encryptUsd: number;
	encryptUsdFormatted: string;
	activeUserMonthlyUsd: number;
	activeUserMonthlyUsdFormatted: string;
	decryptWithLivenessUsd: number;
	decryptWithLivenessUsdFormatted: string;
	decryptNoLivenessUsd: number;
	decryptNoLivenessUsdFormatted: string;
	decryptIncludedPerMonth: number;
	encryptTokens: number;
	activeUserMonthlyTokens: number;
	decryptWithLivenessTokens: number;
	decryptNoLivenessTokens: number;
}

export interface Price {
	id: string;
	object: string;
	active: boolean;
	billing_scheme: string;
	created: number;
	currency: string;
	custom_unit_amount: any;
	livemode: boolean;
	lookup_key: any;
	metadata: any;
	nickname: any;
	product: string;
	recurring: {
		aggregate_usage: any;
		interval: string;
		interval_count: number;
		meter: any;
		trial_period_days: any;
		usage_type: string;
	};
	tax_behavior: string;
	tiers_mode: any;
	transform_quantity: any;
	type: string;
	unit_amount: number;
	unit_amount_decimal: string;
}

export interface SubscribeRequest {
	productId: string;
	priceId: string;
	customerEmail?: string;
}

export interface SubscribeResponse {
	sessionId: string;
	url: string;
	success: boolean;
}

export interface StripePortalResponse {
	url: string;
	success: boolean;
}

export interface CancelSubscriptionResponse {
	success: boolean;
	message: string;
}

const MY_SUBSCRIPTION_TTL_MS = 5 * 60 * 1000;

@Injectable({
	providedIn: "root",
})
export class SubscriptionPlansService {
	private _httpWrapper = inject(HttpWrapperService);
	private _mySubscriptionCache: { expiresAt: number; value: any } | null = null;
	private _mySubscriptionInflight: Promise<any> | null = null;

	/**
	 * Get all subscription plans (includes `pricingMeta` when supported by the API).
	 */
	async getSubscriptionPlans(): Promise<{ plans: SubscriptionPlan[]; pricingMeta: SubscriptionPricingMeta | null }> {
		try {
			// Add timeout to prevent hanging
			const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout after 10 seconds")), 10000));

			const requestPromise = this._httpWrapper.sendRequest("get", `${environment.apiUrl}${environment.endpoints.subscriptionPlans.list}`);

			const response = await Promise.race([requestPromise, timeoutPromise]);
			const plans = response?.data ?? [];
			const pricingMeta = response?.pricingMeta ?? null;
			return { plans, pricingMeta };
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Get a specific subscription plan by product ID
	 */
	async getSubscriptionPlan(productId: string): Promise<SubscriptionPlan> {
		try {
			const response = await this._httpWrapper.sendRequest(
				"get",
				`${environment.apiUrl}${environment.endpoints.subscriptionPlans.getById}/${productId}`,
			);
			return response.data;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Create a Stripe checkout session for subscription
	 */
	async subscribe(request: SubscribeRequest): Promise<SubscribeResponse> {
		try {
			const response = await this._httpWrapper.sendRequest(
				"post",
				`${environment.apiUrl}${environment.endpoints.subscriptionPlans.subscribe}`,
				request,
			);

			// Handle both direct response and nested data response
			this._clearMySubscriptionCache();

			if (response.data) {
				return response.data;
			} else {
				return response;
			}
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Get my plan from API
	 */
	async getMySubscription(): Promise<any> {
		if (this._mySubscriptionCache && this._mySubscriptionCache.expiresAt > Date.now()) {
			return this._mySubscriptionCache.value;
		}

		if (this._mySubscriptionInflight) {
			return this._mySubscriptionInflight;
		}

		this._mySubscriptionInflight = this._httpWrapper
			.sendRequest("get", `${environment.apiUrl}${environment.endpoints.subscriptionPlans.mySubscription}`)
			.then((response: any) => {
				const value = response.data;
				this._mySubscriptionCache = { expiresAt: Date.now() + MY_SUBSCRIPTION_TTL_MS, value };
				this._mySubscriptionInflight = null;
				return value;
			})
			.catch((error: unknown) => {
				this._mySubscriptionInflight = null;
				throw error;
			});

		return this._mySubscriptionInflight;
	}

	/**
	 * Create Stripe customer portal session
	 */
	async createStripePortalSession(): Promise<StripePortalResponse> {
		try {
			const response = await this._httpWrapper.sendRequest(
				"post",
				`${environment.apiUrl}${environment.endpoints.subscriptionPlans.createPortalSession}`,
			);
			return response.data || response;
		} catch (error) {
			throw error;
		}
	}

	private _clearMySubscriptionCache(): void {
		this._mySubscriptionCache = null;
		this._mySubscriptionInflight = null;
	}



	/**
	 * Verify Stripe session payment
	 */
	async verifySession(sessionId: string): Promise<VerifySessionResponse> {
		try {
			const response = await this._httpWrapper.sendRequest("post", `${environment.apiUrl}/api/subscription-plans/verify-session`, {
				sessionId,
			});
			this._clearMySubscriptionCache();
			return response.data || response;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Reconcile monthly ZNS grants for the active subscription against Stripe paid invoices
	 * and the local ledger. Backend retries failed/stale-pending transfers and reports the
	 * resulting on-chain balance for context.
	 */
	async reconcileZnsGrant(): Promise<ReconcileZnsResponse | null> {
		try {
			const url = `${environment.apiUrl}${environment.endpoints.subscriptionPlans.reconcileZns}`;
			const response = await this._httpWrapper.sendRequest("post", url);
			const payload = (response?.data ?? response) as ReconcileZnsResponse;

			if (!payload || typeof payload !== "object") {
				console.warn("[subscription-plans] reconcileZnsGrant unexpected response shape", { response });
				return null;
			}

			console.info("[subscription-plans] reconcileZnsGrant OK", {
				url,
				reconciled: payload.reconciled,
				skippedReason: payload.skippedReason,
				actionCount: payload.actions?.length ?? 0,
			});

			return payload;
		} catch (error: any) {
			console.warn("[subscription-plans] reconcileZnsGrant HTTP error", {
				url: `${environment.apiUrl}${environment.endpoints.subscriptionPlans.reconcileZns}`,
				status: error?.status,
				message: error?.message,
				body: error?.error ?? error,
			});
			return null;
		}
	}
}

export interface VerifySessionResponse {
	success: boolean;
	record: any;
	znsGrant?: ReconcileGrantAction | null;
}

export interface ReconcileGrantAction {
	invoiceId: string;
	amountPaid?: number;
	ledgerStatus: "completed" | "failed" | "pending" | null;
	granted: boolean;
	retried?: boolean;
	signature?: string | null;
	skippedReason?: string | null;
	tokenAmount?: number | null;
	planCode?: string | null;
}

export interface ReconcileZnsResponse {
	reconciled: boolean;
	actions: ReconcileGrantAction[];
	latestInvoiceId: string | null;
	ledgerSnapshots: { invoiceId: string; status: string | null; signature: string | null }[];
	onChainZnsBalance: number | null;
	ataAddress: string | null;
	solanaAddress: string | null;
	skippedReason: string | null;
}
