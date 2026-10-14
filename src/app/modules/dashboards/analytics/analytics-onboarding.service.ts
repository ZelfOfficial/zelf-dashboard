import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { environment } from "environments/environment";
import { HttpWrapperService } from "app/http-wrapper.service";
import { LicenseService } from "app/modules/pages/settings/license/license.service";
import { SubscriptionPlansService } from "app/core/services/subscription-plans.service";
import { AnalyticsSnapshot } from "./analytics.service";

export type AnalyticsOnboardingStepId =
	| "license"
	| "zelfNameService"
	| "themeStyles"
	| "subscription"
	| "playCreate"
	| "playPreview"
	| "playDecrypt"
	| "firstZelfId"
	| "zelfKeys";

export type AnalyticsOnboardingStepStatus = "complete" | "current" | "pending";

export interface AnalyticsOnboardingStep {
	id: AnalyticsOnboardingStepId;
	route: string;
	routeLabelKey: string;
	titleKey: string;
	descriptionKey: string;
	optional?: boolean;
	complete: boolean;
	status: AnalyticsOnboardingStepStatus;
}

export interface AnalyticsOnboardingProgress {
	steps: AnalyticsOnboardingStep[];
	requiredSteps: AnalyticsOnboardingStep[];
	completedRequiredCount: number;
	totalRequired: number;
	allRequiredComplete: boolean;
	loading: boolean;
}

export interface HumanAuthnOnboardingStepProgress {
	complete: boolean;
	completedAt?: string;
	staffEmail?: string;
	zelfID?: string;
	identifier?: string;
}

export interface HumanAuthnOnboardingProgress {
	domainName: string | null;
	playCreate: HumanAuthnOnboardingStepProgress;
	playPreview: HumanAuthnOnboardingStepProgress;
	playDecrypt: HumanAuthnOnboardingStepProgress;
}

const VISIT_PREFIX = "analyticsOnboarding.visited.";
const COMPLETE_FLAG = "analyticsOnboarding.complete";

const STEP_DEFINITIONS: Array<{
	id: AnalyticsOnboardingStepId;
	route: string;
	routeLabelKey: string;
	titleKey: string;
	descriptionKey: string;
	optional?: boolean;
}> = [
	{
		id: "license",
		route: "/settings/license",
		routeLabelKey: "analytics.onboarding.routes.settings",
		titleKey: "analytics.onboarding.steps.license.title",
		descriptionKey: "analytics.onboarding.steps.license.description",
	},
	{
		id: "zelfNameService",
		route: "/settings/zelf-name-service",
		routeLabelKey: "analytics.onboarding.routes.settings",
		titleKey: "analytics.onboarding.steps.zelfNameService.title",
		descriptionKey: "analytics.onboarding.steps.zelfNameService.description",
	},
	{
		id: "themeStyles",
		route: "/settings/theme-styles",
		routeLabelKey: "analytics.onboarding.routes.settings",
		titleKey: "analytics.onboarding.steps.themeStyles.title",
		descriptionKey: "analytics.onboarding.steps.themeStyles.description",
	},
	{
		id: "subscription",
		route: "/settings/plan-billing",
		routeLabelKey: "analytics.onboarding.routes.billing",
		titleKey: "analytics.onboarding.steps.subscription.title",
		descriptionKey: "analytics.onboarding.steps.subscription.description",
	},
	{
		id: "playCreate",
		route: "/play-area/human-authn/create",
		routeLabelKey: "analytics.onboarding.routes.playArea",
		titleKey: "analytics.onboarding.steps.playCreate.title",
		descriptionKey: "analytics.onboarding.steps.playCreate.description",
	},
	{
		id: "playPreview",
		route: "/play-area/human-authn/preview",
		routeLabelKey: "analytics.onboarding.routes.playArea",
		titleKey: "analytics.onboarding.steps.playPreview.title",
		descriptionKey: "analytics.onboarding.steps.playPreview.description",
	},
	{
		id: "playDecrypt",
		route: "/play-area/human-authn/decrypt",
		routeLabelKey: "analytics.onboarding.routes.playArea",
		titleKey: "analytics.onboarding.steps.playDecrypt.title",
		descriptionKey: "analytics.onboarding.steps.playDecrypt.description",
	},
	{
		id: "firstZelfId",
		route: "/tags",
		routeLabelKey: "analytics.onboarding.routes.tags",
		titleKey: "analytics.onboarding.steps.firstZelfId.title",
		descriptionKey: "analytics.onboarding.steps.firstZelfId.description",
	},
	{
		id: "zelfKeys",
		route: "/zelfkeys",
		routeLabelKey: "analytics.onboarding.routes.zelfKeys",
		titleKey: "analytics.onboarding.steps.zelfKeys.title",
		descriptionKey: "analytics.onboarding.steps.zelfKeys.description",
		optional: true,
	},
];

const EMPTY_PROGRESS: AnalyticsOnboardingProgress = {
	steps: [],
	requiredSteps: [],
	completedRequiredCount: 0,
	totalRequired: 8,
	allRequiredComplete: false,
	loading: true,
};

const SUBSCRIPTION_CHECK_TTL_MS = 5 * 60 * 1000;

@Injectable({ providedIn: "root" })
export class AnalyticsOnboardingService {
	private _progress = new BehaviorSubject<AnalyticsOnboardingProgress>(EMPTY_PROGRESS);
	private _hasActiveSubscription: boolean | null = null;
	private _subscriptionCheckedAt = 0;

	constructor(
		private _licenseService: LicenseService,
		private _subscriptionPlansService: SubscriptionPlansService,
		private _httpWrapper: HttpWrapperService
	) {}

	get progress$(): Observable<AnalyticsOnboardingProgress> {
		return this._progress.asObservable();
	}

	get progress(): AnalyticsOnboardingProgress {
		return this._progress.value;
	}

	isFastPathComplete(): boolean {
		try {
			return localStorage.getItem(COMPLETE_FLAG) === "true";
		} catch {
			return false;
		}
	}

	markVisited(stepId: AnalyticsOnboardingStepId): void {
		try {
			localStorage.setItem(`${VISIT_PREFIX}${stepId}`, "true");
		} catch {
			// ignore storage errors
		}
	}

	hasVisited(stepId: AnalyticsOnboardingStepId): boolean {
		try {
			return localStorage.getItem(`${VISIT_PREFIX}${stepId}`) === "true";
		} catch {
			return false;
		}
	}

	markComplete(): void {
		try {
			localStorage.setItem(COMPLETE_FLAG, "true");
		} catch {
			// ignore storage errors
		}
	}

	async refresh(analyticsSnapshot?: AnalyticsSnapshot): Promise<void> {
		this._progress.next({ ...this._progress.value, loading: true });

		try {
			const domainCfg = await this._resolveDomainConfig();
			const hasSubscription = await this._checkActiveSubscription();
			const tagCount = analyticsSnapshot?.summary?.totals?.total ?? 0;
			const humanAuthnProgress = await this._fetchHumanAuthnProgress();

			this._clearStalePlayVisitFlags();

			const completionMap: Record<AnalyticsOnboardingStepId, boolean> = {
				license: Boolean(domainCfg?.name),
				zelfNameService: this._isZelfNameServiceConfigured(domainCfg),
				themeStyles: this._isThemeConfigured(domainCfg),
				subscription: hasSubscription,
				playCreate: humanAuthnProgress?.playCreate?.complete === true,
				playPreview: humanAuthnProgress?.playPreview?.complete === true,
				playDecrypt: humanAuthnProgress?.playDecrypt?.complete === true,
				firstZelfId: tagCount > 0,
				zelfKeys: this.hasVisited("zelfKeys"),
			};

			let currentAssigned = false;
			const steps: AnalyticsOnboardingStep[] = STEP_DEFINITIONS.map((def) => {
				const complete = completionMap[def.id];
				let status: AnalyticsOnboardingStepStatus = "pending";
				if (complete) {
					status = "complete";
				} else if (!def.optional && !currentAssigned) {
					status = "current";
					currentAssigned = true;
				}
				return {
					...def,
					complete,
					status,
				};
			});

			const requiredSteps = steps.filter((s) => !s.optional);
			const completedRequiredCount = requiredSteps.filter((s) => s.complete).length;
			const allRequiredComplete = completedRequiredCount >= requiredSteps.length;

			if (allRequiredComplete) {
				this.markComplete();
			}

			this._progress.next({
				steps,
				requiredSteps,
				completedRequiredCount,
				totalRequired: requiredSteps.length,
				allRequiredComplete,
				loading: false,
			});
		} catch (e) {
			console.error("Analytics onboarding refresh failed", e);
			this._progress.next({ ...this._progress.value, loading: false });
		}
	}

	private async _resolveDomainConfig(): Promise<any | null> {
		const stored = localStorage.getItem("license");
		let domainCfg: any = null;

		if (stored) {
			try {
				const licenseObj = JSON.parse(stored);
				domainCfg = licenseObj?.domainConfig || licenseObj;
			} catch {
				// ignore
			}
		}

		if (!domainCfg?.name) {
			try {
				const resp = await this._licenseService.getMyLicense(true);
				domainCfg = resp?.data?.myLicense?.domainConfig ?? null;
			} catch {
				domainCfg = null;
			}
		}

		return domainCfg;
	}

	private async _checkActiveSubscription(): Promise<boolean> {
		if (this._hasActiveSubscription !== null && Date.now() - this._subscriptionCheckedAt < SUBSCRIPTION_CHECK_TTL_MS) {
			return this._hasActiveSubscription;
		}

		try {
			const mySubscription = await this._subscriptionPlansService.getMySubscription();
			this._hasActiveSubscription = Boolean(mySubscription?.subscription?.status === "active");
			this._subscriptionCheckedAt = Date.now();
			return this._hasActiveSubscription;
		} catch {
			return false;
		}
	}

	private _isZelfNameServiceConfigured(domainCfg: any): boolean {
		if (this.hasVisited("zelfNameService")) return true;
		const table = domainCfg?.tags?.payment?.pricingTable;
		if (!table || typeof table !== "object") return false;
		const keys = Object.keys(table);
		if (keys.length === 0) return false;
		return keys.some((k) => {
			const row = table[k];
			return row && typeof row === "object" && Object.values(row).some((v) => typeof v === "number" && v > 0);
		});
	}

	private _isThemeConfigured(domainCfg: any): boolean {
		if (this.hasVisited("themeStyles")) return true;
		try {
			return localStorage.getItem("analyticsOnboarding.themeSaved") === "true";
		} catch {
			return false;
		}
	}

	private async _fetchHumanAuthnProgress(): Promise<HumanAuthnOnboardingProgress | null> {
		try {
			const response = await this._httpWrapper.sendRequest(
				"get",
				`${environment.apiUrl}${environment.endpoints.humanAuthn.onboardingProgress}`
			);
			return (response?.data as HumanAuthnOnboardingProgress) ?? null;
		} catch {
			return null;
		}
	}

	private _clearStalePlayVisitFlags(): void {
		for (const stepId of ["playCreate", "playPreview", "playDecrypt"] as AnalyticsOnboardingStepId[]) {
			try {
				localStorage.removeItem(`${VISIT_PREFIX}${stepId}`);
			} catch {
				// ignore storage errors
			}
		}
	}
}
