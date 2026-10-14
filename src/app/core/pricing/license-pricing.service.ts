import { Injectable } from "@angular/core";
import { environment } from "environments/environment";
import { HttpWrapperService } from "app/http-wrapper.service";
import { durationsOf, plansForLength, PlanPricing } from "./license-pricing.utils";

/**
 * Loads a domain's license (planPricing) from the v4 API: GET /api/zelf-ids/domains/:domain.
 * Plans and durations shown in the UI are derived from it; prices are always quoted by the API.
 */
@Injectable({ providedIn: "root" })
export class LicensePricingService {
	/** Same TTL as the API license cache, so the UI never lags the license by more than that. */
	private static readonly TTL_MS = 60_000;
	private cache = new Map<string, { at: number; value: Promise<PlanPricing> }>();

	constructor(private http: HttpWrapperService) {}

	getPlanPricing(domain: string): Promise<PlanPricing> {
		const key = (domain || "").replace(/^\./, "").toLowerCase();
		const hit = this.cache.get(key);
		if (hit && Date.now() - hit.at < LicensePricingService.TTL_MS) return hit.value;
		const value = this.http
			.sendRequest("get", `${environment.apiUrl}/api/zelf-ids/domains/${encodeURIComponent(key)}`)
			.then((res: any) => (res?.data?.tags?.payment?.planPricing || {}) as PlanPricing)
			.catch((err: unknown) => {
				this.cache.delete(key);
				throw err;
			});
		this.cache.set(key, { at: Date.now(), value });
		return value;
	}

	/** Plans the license prices for this name length. */
	async plansFor(domain: string, tagName: string): Promise<string[]> {
		return plansForLength(await this.getPlanPricing(domain), (tagName || "").split(".")[0].length);
	}

	/** Durations the license prices for this plan (or for any plan offered at that length when plan is empty). */
	async durationsFor(domain: string, tagName: string, plan?: string): Promise<string[]> {
		const pp = await this.getPlanPricing(domain);
		const length = (tagName || "").split(".")[0].length;
		const plans = plan ? [plan] : plansForLength(pp, length);
		const subset: PlanPricing = {};
		plans.forEach((p) => {
			const table = pp[p] || {};
			subset[p] = Object.fromEntries(
				Object.entries(table).filter(([g]) => plansForLength({ x: { [g]: {} } }, length).length),
			);
		});
		return durationsOf(subset, true);
	}
}
