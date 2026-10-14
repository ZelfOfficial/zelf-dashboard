import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { environment } from "environments/environment";
import { HttpWrapperService } from "app/http-wrapper.service";
import { AnalyticsMetrics, AnalyticsSummary, metricsFromSummary } from "./analytics.utils";

export interface AnalyticsSnapshot {
	summary: AnalyticsSummary | null;
	currentDomain: string | null;
	metrics: AnalyticsMetrics;
	loading: boolean;
	error: string | null;
}

export interface AnalyticsRecordRow {
	name: string;
	type: string;
	plan: string | null;
	origin: string;
	storage: string;
	registeredAt?: string;
	expiresAt?: string;
}

export interface AnalyticsRecordsQuery {
	page?: number;
	pageSize?: number;
	type?: string;
	plan?: string;
	origin?: string;
	storage?: string;
	status?: "active" | "expired" | "";
	from?: string;
	to?: string;
	search?: string;
}

export interface AnalyticsRecordsPage {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
	items: AnalyticsRecordRow[];
}

const EMPTY_SNAPSHOT: AnalyticsSnapshot = {
	summary: null,
	currentDomain: null,
	metrics: metricsFromSummary(null),
	loading: true,
	error: null,
};

/**
 * Analytics data: one cached server summary (cards + charts) and an on-demand, paginated
 * records drill-down. The API resolves the caller's license domain (owner / staff only).
 */
@Injectable({ providedIn: "root" })
export class AnalyticsService {
	private readonly baseUrl = `${environment.apiUrl}/api/zelf-ids/analytics`;
	private _snapshot = new BehaviorSubject<AnalyticsSnapshot>(EMPTY_SNAPSHOT);

	constructor(private _http: HttpWrapperService) {}

	get snapshot$(): Observable<AnalyticsSnapshot> {
		return this._snapshot.asObservable();
	}

	get snapshot(): AnalyticsSnapshot {
		return this._snapshot.value;
	}

	async loadAnalytics(): Promise<void> {
		this._snapshot.next({ ...this._snapshot.value, loading: true, error: null });
		try {
			const res: any = await this._http.sendRequest("get", `${this.baseUrl}/summary`);
			const summary: AnalyticsSummary | null = res?.data || null;
			this._snapshot.next({
				summary,
				currentDomain: summary?.domain || null,
				metrics: metricsFromSummary(summary),
				loading: false,
				error: summary ? null : "Failed to load analytics data",
			});
		} catch (e: any) {
			console.error("Analytics summary failed", e);
			this._snapshot.next({
				...this._snapshot.value,
				loading: false,
				error: e?.status === 403 ? "No licensed domain for this account" : "Failed to load analytics data",
			});
		}
	}

	async listRecords(query: AnalyticsRecordsQuery): Promise<AnalyticsRecordsPage> {
		const params: Record<string, unknown> = {};
		Object.entries(query || {}).forEach(([k, v]) => {
			if (v !== undefined && v !== null && v !== "") params[k] = v;
		});
		const res: any = await this._http.sendRequest("get", `${this.baseUrl}/records`, params);
		return res?.data;
	}
}
