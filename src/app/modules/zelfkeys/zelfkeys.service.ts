import { Injectable } from "@angular/core";
import { HttpWrapperService } from "../../http-wrapper.service";
import { environment } from "../../../environments/environment";

export interface ZelfKeyItem {
	id: string;
	cid: string;
	url?: string;
	publicData: {
		category?: string;
		keyOwner?: string;
		type?: string;
		website?: string;
		username?: string;
		title?: string;
		issuer?: string;
		folder?: string;
		timestamp?: string;
		[key: string]: unknown;
	};
	zelfProofQRCode?: string;
	zelfProof?: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface ZelfKeysListResponse {
	data: {
		success: boolean;
		message: string;
		category?: string;
		data: ZelfKeyItem[];
		totalCount: number;
		fullTagName?: string;
		searchCategory?: string;
		timestamp: string;
	};
}

export interface ZelfKeysListAllResponse {
	data: {
		success: boolean;
		message: string;
		data: {
			password: ZelfKeyItem[];
			notes: ZelfKeyItem[];
			zotp: ZelfKeyItem[];
			credit_card: ZelfKeyItem[];
			contact: ZelfKeyItem[];
		};
		totalCount: number;
		timestamp: string;
	};
}

export interface ZelfKeysListParams {
	category: string;
	tagName?: string;
}

export interface ZelfKeysListAllParams {
	tagName?: string;
}

export interface ZelfKeysDashboardParams {
	identifier: string;
	category?: string;
}

/** Metadata-only row from GET /api/zelf-keys/dashboard/domain (never contains secrets). */
export interface ZelfKeyDomainItem {
	id: string;
	type: string;
	owner: string;
	label: string;
	folder: string | null;
	protection: string;
	createdAt: string | null;
	updatedAt: string | null;
}

export interface ZelfKeysDomainListResponse {
	data: {
		domain: string;
		page: number;
		pageSize: number;
		total: number;
		totalPages: number;
		domainTotal: number;
		countsByType: Record<string, number>;
		owners: string[];
		items: ZelfKeyDomainItem[];
	};
}

export interface ZelfKeysDomainListParams {
	page?: number;
	pageSize?: number;
	type?: string;
	owner?: string;
	search?: string;
}

@Injectable({
	providedIn: "root",
})
export class ZelfKeysService {
	private readonly baseUrl = `${environment.apiUrl}/api/zelf-keys`;

	constructor(private httpWrapper: HttpWrapperService) {}

	/**
	 * List ZelfKeys by category (extension route - uses JWT for user)
	 * @param params - category (required), tagName (optional)
	 * @returns Promise of list response
	 */
	listByCategory(params: ZelfKeysListParams): Promise<ZelfKeysListResponse> {
		const queryParams = this.buildQueryParams(params as unknown as Record<string, unknown>);
		return this.httpWrapper.sendRequest("get", `${this.baseUrl}/list`, queryParams);
	}

	/**
	 * List all ZelfKeys across all categories (extension route - uses JWT for user)
	 * @param params - tagName (optional)
	 * @returns Promise of list-all response
	 */
	listAll(params?: ZelfKeysListAllParams): Promise<ZelfKeysListAllResponse> {
		const queryParams = params ? this.buildQueryParams(params as unknown as Record<string, unknown>) : {};
		return this.httpWrapper.sendRequest("get", `${this.baseUrl}/list-all`, queryParams);
	}

	/**
	 * List ZelfKeys by category (dashboard route - requires identifier)
	 * @param params - identifier (required, e.g. miguel.zelf), category (optional)
	 * @returns Promise of list response
	 */
	listDashboard(params: ZelfKeysDashboardParams): Promise<ZelfKeysListResponse> {
		const queryParams = this.buildQueryParams(params as unknown as Record<string, unknown>);
		return this.httpWrapper.sendRequest("get", `${this.baseUrl}/dashboard/list`, queryParams);
	}

	/**
	 * List all ZelfKeys across all categories (dashboard route - requires identifier)
	 * @param params - identifier (required, e.g. miguel.zelf)
	 * @returns Promise of list-all response
	 */
	listAllDashboard(params: { identifier: string }): Promise<ZelfKeysListAllResponse> {
		const queryParams = this.buildQueryParams(params as unknown as Record<string, unknown>);
		return this.httpWrapper.sendRequest("get", `${this.baseUrl}/dashboard/list-all`, queryParams);
	}

	/**
	 * Domain-wide admin list (license owner / staff). Paginated, metadata only.
	 */
	listDomain(params: ZelfKeysDomainListParams = {}): Promise<ZelfKeysDomainListResponse> {
		const queryParams = this.buildQueryParams(params as unknown as Record<string, unknown>);
		return this.httpWrapper.sendRequest("get", `${this.baseUrl}/dashboard/domain`, queryParams);
	}

	/**
	 * Build query parameters from object
	 */
	private buildQueryParams(params: Record<string, unknown>): Record<string, unknown> {
		const queryParams: Record<string, unknown> = {};
		Object.keys(params || {}).forEach((key) => {
			if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
				queryParams[key] = params[key];
			}
		});
		return queryParams;
	}
}
