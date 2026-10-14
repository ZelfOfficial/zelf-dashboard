import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { TagsService } from "app/modules/tags/tags.service";
import { LicenseService } from "app/modules/pages/settings/license/license.service";
import {
	AnalyticsMetrics,
	TagAnalyticsRecord,
	computeAnalyticsMetrics,
	normalizeTagRows,
} from "./analytics.utils";

export interface AnalyticsSnapshot {
	records: TagAnalyticsRecord[];
	currentDomain: string | null;
	keyPrefix: string;
	metrics: AnalyticsMetrics;
	loading: boolean;
	error: string | null;
}

const EMPTY_SNAPSHOT: AnalyticsSnapshot = {
	records: [],
	currentDomain: null,
	keyPrefix: "tagName",
	metrics: computeAnalyticsMetrics([]),
	loading: true,
	error: null,
};

@Injectable({ providedIn: "root" })
export class AnalyticsService {
	private _snapshot = new BehaviorSubject<AnalyticsSnapshot>(EMPTY_SNAPSHOT);

	constructor(
		private _tagsService: TagsService,
		private _licenseService: LicenseService
	) {}

	get snapshot$(): Observable<AnalyticsSnapshot> {
		return this._snapshot.asObservable();
	}

	get snapshot(): AnalyticsSnapshot {
		return this._snapshot.value;
	}

	async loadAnalytics(): Promise<void> {
		this._snapshot.next({ ...this._snapshot.value, loading: true, error: null });

		try {
			const { domain, keyPrefix, storageKeys } = await this._resolveLicenseContext();
			if (!domain) {
				this._snapshot.next({
					...EMPTY_SNAPSHOT,
					loading: false,
					error: "No licensed domain configured",
				});
				return;
			}

			const rawItems = await this._fetchAllTagsByDomain(domain, storageKeys);
			const records = this._dedupeRecords(normalizeTagRows(rawItems, keyPrefix));
			const metrics = computeAnalyticsMetrics(records);

			this._snapshot.next({
				records,
				currentDomain: domain,
				keyPrefix,
				metrics,
				loading: false,
				error: null,
			});
		} catch (e) {
			console.error("Analytics load failed", e);
			this._snapshot.next({
				...this._snapshot.value,
				loading: false,
				error: "Failed to load analytics data",
			});
		}
	}

	private async _resolveLicenseContext(): Promise<{
		domain: string | null;
		keyPrefix: string;
		storageKeys: string[];
	}> {
		const stored = localStorage.getItem("license");
		let domainCfg: any = null;

		if (stored) {
			try {
				const licenseObj = JSON.parse(stored);
				domainCfg = licenseObj?.domainConfig || licenseObj;
			} catch {
				// ignore invalid localStorage
			}
		}

		if (!domainCfg?.name) {
			const resp = await this._licenseService.getMyLicense(true);
			domainCfg = resp?.data?.myLicense?.domainConfig;
			if (domainCfg) {
				try {
					const existing = stored ? JSON.parse(stored) : {};
					localStorage.setItem("license", JSON.stringify({ ...(existing || {}), domainConfig: domainCfg }));
				} catch {
					// ignore persist errors
				}
			}
		}

		const domain = domainCfg?.name || null;
		const keyPrefix = domainCfg?.tags?.storage?.keyPrefix || "tagName";
		const tagStorage = domainCfg?.tags?.storage || {};
		const storageKeys: string[] = [];
		if (tagStorage.ipfsEnabled !== false) storageKeys.push("IPFS");
		if (tagStorage.arweaveEnabled) storageKeys.push("Arweave");
		if (tagStorage.walrusEnabled) storageKeys.push("Walrus");
		if (storageKeys.length === 0) storageKeys.push("IPFS");

		return { domain, keyPrefix, storageKeys };
	}

	private async _fetchAllTagsByDomain(domain: string, storages: string[]): Promise<any[]> {
		const limit = 500;
		const allItems: any[] = [];

		await Promise.all(
			storages.map(async (storage) => {
				let offset = 0;
				while (true) {
					try {
						const res = await this._tagsService.searchByDomain({
							domain,
							storage,
							limit,
							offset,
						});
						const page = Array.isArray(res?.data) ? res.data : [];
						allItems.push(...page);
						if (page.length < limit) break;
						offset += limit;
					} catch (e) {
						console.error(`Error fetching tags for ${storage}:`, e);
						break;
					}
				}
			})
		);

		return allItems;
	}

	private _dedupeRecords(records: TagAnalyticsRecord[]): TagAnalyticsRecord[] {
		const seen = new Map<string, TagAnalyticsRecord>();
		for (const r of records) {
			const key = r.name.toLowerCase();
			if (!seen.has(key)) {
				seen.set(key, r);
			}
		}
		return Array.from(seen.values());
	}
}
