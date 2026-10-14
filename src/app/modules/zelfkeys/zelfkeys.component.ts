import { Component, ViewEncapsulation, OnInit, OnDestroy, ChangeDetectorRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { FormsModule } from "@angular/forms";
import { TranslocoModule } from "@jsverse/transloco";
import { ActivatedRoute } from "@angular/router";
import { Subject, debounceTime, takeUntil } from "rxjs";
import { ZelfKeysService, ZelfKeyDomainItem } from "./zelfkeys.service";
import { AnalyticsOnboardingService } from "../dashboards/analytics/analytics-onboarding.service";

const CATEGORIES = [
	{ value: "all", labelKey: "zelfkeys.filters.all" },
	{ value: "password", labelKey: "zelfkeys.filters.password" },
	{ value: "notes", labelKey: "zelfkeys.filters.notes" },
	{ value: "zotp", labelKey: "zelfkeys.filters.zotp" },
	{ value: "credit_card", labelKey: "zelfkeys.filters.credit_card" },
	{ value: "contact", labelKey: "zelfkeys.filters.contact" },
];

/**
 * Domain-wide ZelfKeys (admin view): every key created in the license domain.
 * Data: GET /api/zelf-keys/dashboard/domain (license owner / staff only, metadata only, paginated server-side).
 */
@Component({
	selector: "zelfkeys",
	standalone: true,
	templateUrl: "./zelfkeys.component.html",
	styleUrls: ["./zelfkeys.component.scss"],
	encapsulation: ViewEncapsulation.None,
	imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, FormsModule, TranslocoModule],
})
export class ZelfKeysComponent implements OnInit, OnDestroy {
	allCategories = CATEGORIES;
	selectedCategory = "all";
	ownerFilter = "";
	search = "";

	items: ZelfKeyDomainItem[] = [];
	owners: string[] = [];
	countsByType: Record<string, number> = {};
	domain = "";
	domainTotal = 0;
	total = 0;
	page = 1;
	pageSize = 50;
	totalPages = 1;

	isLoading = true;
	error: string | null = null;

	private destroy$ = new Subject<void>();
	private search$ = new Subject<void>();
	private _requestSeq = 0;

	constructor(
		private _zelfKeysService: ZelfKeysService,
		private _route: ActivatedRoute,
		private _cdr: ChangeDetectorRef,
		private _analyticsOnboardingService: AnalyticsOnboardingService
	) {}

	ngOnInit(): void {
		this._analyticsOnboardingService.markVisited("zelfKeys");
		// Deep link: /zelfkeys?owner=alice.zelf
		const owner = this._route.snapshot.queryParamMap.get("owner");
		if (owner) this.ownerFilter = owner;
		this.search$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => {
			this.page = 1;
			this.loadKeys();
		});
		this.loadKeys();
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	async loadKeys(): Promise<void> {
		const seq = ++this._requestSeq;
		this.isLoading = true;
		this.error = null;
		this._cdr.markForCheck();
		try {
			const res = await this._zelfKeysService.listDomain({
				page: this.page,
				pageSize: this.pageSize,
				type: this.selectedCategory === "all" ? undefined : this.selectedCategory,
				owner: this.ownerFilter || undefined,
				search: this.search.trim() || undefined,
			});
			if (seq !== this._requestSeq) return; // a newer request is in flight
			const d = res?.data;
			this.items = d?.items || [];
			this.owners = d?.owners || [];
			this.countsByType = d?.countsByType || {};
			this.domain = d?.domain || "";
			this.domainTotal = d?.domainTotal || 0;
			this.total = d?.total || 0;
			this.totalPages = d?.totalPages || 1;
		} catch (err: any) {
			if (seq !== this._requestSeq) return;
			console.error("ZelfKeys domain list error:", err);
			const status = err?.status;
			this.error =
				status === 403
					? "Only the license owner or staff of this domain can see its ZelfKeys."
					: err?.error?.message || err?.message || "Failed to load ZelfKeys";
			this.items = [];
		} finally {
			if (seq === this._requestSeq) {
				this.isLoading = false;
				this._cdr.markForCheck();
			}
		}
	}

	onFilterChange(): void {
		this.page = 1;
		this.loadKeys();
	}

	onSearchInput(): void {
		this.search$.next();
	}

	clearFilters(): void {
		this.selectedCategory = "all";
		this.ownerFilter = "";
		this.search = "";
		this.onFilterChange();
	}

	goToPage(p: number): void {
		if (p < 1 || p > this.totalPages || p === this.page) return;
		this.page = p;
		this.loadKeys();
	}

	get hasFilters(): boolean {
		return this.selectedCategory !== "all" || !!this.ownerFilter || !!this.search.trim();
	}

	formatDate(dateString: string | null | undefined): string {
		if (!dateString) return "—";
		const d = new Date(dateString);
		if (isNaN(d.getTime())) return "—";
		return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
	}

	getCategoryIcon(category: string): string {
		const icons: Record<string, string> = {
			password: "lock",
			notes: "note",
			zotp: "phonelink_lock",
			credit_card: "credit_card",
			contact: "contacts",
		};
		return icons[category] || "key";
	}

	refresh(): void {
		this.loadKeys();
	}
}
