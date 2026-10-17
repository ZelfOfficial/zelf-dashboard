import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { Subject, debounceTime } from "rxjs";
import { AnalyticsService, AnalyticsRecordRow, AnalyticsRecordsQuery } from "./analytics.service";
import { AnalyticsSummary } from "./analytics.utils";

/**
 * Zelf ID records drill-down. Nothing is fetched until the section is expanded; then one
 * page (50 rows) at a time from GET /api/zelf-ids/analytics/records with server-side filters.
 * Filter options come from the summary's own buckets (no hardcoded lists).
 */
@Component({
	selector: "analytics-records",
	standalone: true,
	imports: [CommonModule, FormsModule, MatIconModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="rounded-2xl border bg-card shadow-sm">
			<button type="button" class="flex w-full items-center justify-between px-5 py-4 text-left" (click)="toggle()">
				<span class="text-lg font-semibold">Zelf ID records</span>
				<span class="flex items-center gap-2 text-sm text-secondary">
					@if (summary) {
						{{ summary.totals.total }} total
					}
					<mat-icon>{{ expanded ? "expand_less" : "expand_more" }}</mat-icon>
				</span>
			</button>
			@if (expanded) {
				<div class="border-t px-5 py-4">
					<div class="mb-4 flex flex-wrap items-end gap-3 text-sm">
						<label class="flex flex-col gap-1">
							<span class="text-xs uppercase text-secondary">Type</span>
							<select class="rounded-lg border px-2 py-1" [(ngModel)]="query.type" (change)="reload()">
								<option value="">All</option>
								@for (k of keys(summary?.byType); track k) {
									<option [value]="k">{{ k }} ({{ summary?.byType?.[k] }})</option>
								}
							</select>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs uppercase text-secondary">Plan</span>
							<select class="rounded-lg border px-2 py-1" [(ngModel)]="query.plan" (change)="reload()">
								<option value="">All</option>
								@for (k of keys(summary?.byPlan); track k) {
									<option [value]="k">{{ k }} ({{ summary?.byPlan?.[k] }})</option>
								}
							</select>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs uppercase text-secondary">Storage</span>
							<select class="rounded-lg border px-2 py-1" [(ngModel)]="query.storage" (change)="reload()">
								<option value="">All</option>
								@for (k of keys(summary?.byStorage); track k) {
									<option [value]="k">{{ k }} ({{ summary?.byStorage?.[k] }})</option>
								}
							</select>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs uppercase text-secondary">Status</span>
							<select class="rounded-lg border px-2 py-1" [(ngModel)]="query.status" (change)="reload()">
								<option value="">All</option>
								<option value="active">Active</option>
								<option value="expired">Expired</option>
							</select>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs uppercase text-secondary">From</span>
							<input type="date" class="rounded-lg border px-2 py-1" [(ngModel)]="query.from" (change)="reload()" />
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs uppercase text-secondary">To</span>
							<input type="date" class="rounded-lg border px-2 py-1" [(ngModel)]="query.to" (change)="reload()" />
						</label>
						<label class="flex flex-1 flex-col gap-1">
							<span class="text-xs uppercase text-secondary">Search</span>
							<input type="search" class="rounded-lg border px-2 py-1" placeholder="Name" [(ngModel)]="query.search" (input)="search$.next()" />
						</label>
					</div>

					@if (error) {
						<p class="text-sm text-red-600">{{ error }}</p>
					} @else if (loading && !rows.length) {
						<p class="text-sm text-secondary">Loading records…</p>
					} @else if (!rows.length) {
						<p class="text-sm text-secondary">No records match these filters.</p>
					} @else {
						<div class="overflow-x-auto" [class.opacity-60]="loading">
							<table class="w-full text-sm">
								<thead>
									<tr class="text-left text-xs uppercase text-secondary">
										<th class="py-2 pr-4">Name</th>
										<th class="py-2 pr-4">Type</th>
										<th class="py-2 pr-4">Plan</th>
										<th class="py-2 pr-4">Origin</th>
										<th class="py-2 pr-4">Storage</th>
										<th class="py-2 pr-4">Registered</th>
										<th class="py-2">Expires</th>
									</tr>
								</thead>
								<tbody>
									@for (r of rows; track r.name) {
										<tr class="border-t">
											<td class="py-2 pr-4 font-medium">{{ r.name }}</td>
											<td class="py-2 pr-4">{{ r.type || "—" }}</td>
											<td class="py-2 pr-4">{{ r.plan || "—" }}</td>
											<td class="py-2 pr-4">{{ r.origin }}</td>
											<td class="py-2 pr-4">{{ r.storage }}</td>
											<td class="py-2 pr-4">{{ fmt(r.registeredAt) }}</td>
											<td class="py-2">{{ fmt(r.expiresAt) }}</td>
										</tr>
									}
								</tbody>
							</table>
						</div>
						<div class="mt-3 flex items-center justify-between text-sm text-secondary">
							<span>{{ (page - 1) * pageSize + 1 }}–{{ (page - 1) * pageSize + rows.length }} of {{ total }}</span>
							<span class="flex items-center gap-2">
								<button class="rounded-full border px-3 py-1 disabled:opacity-40" [disabled]="page <= 1 || loading" (click)="go(page - 1)">Previous</button>
								<span>Page {{ page }} / {{ totalPages }}</span>
								<button class="rounded-full border px-3 py-1 disabled:opacity-40" [disabled]="page >= totalPages || loading" (click)="go(page + 1)">Next</button>
							</span>
						</div>
					}
				</div>
			}
		</div>
	`,
})
export class AnalyticsRecordsComponent {
	@Input() summary: AnalyticsSummary | null = null;

	expanded = false;
	loading = false;
	error: string | null = null;
	rows: AnalyticsRecordRow[] = [];
	page = 1;
	readonly pageSize = 50;
	total = 0;
	totalPages = 1;
	query: AnalyticsRecordsQuery = { type: "", plan: "", storage: "", status: "", from: "", to: "", search: "" };
	search$ = new Subject<void>();
	private _seq = 0;

	constructor(
		private _analytics: AnalyticsService,
		private _cdr: ChangeDetectorRef
	) {
		this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
	}

	keys(map: Record<string, number> | undefined | null): string[] {
		return Object.keys(map || {}).sort((a, b) => (map![b] || 0) - (map![a] || 0));
	}

	toggle(): void {
		this.expanded = !this.expanded;
		if (this.expanded && !this.rows.length) this.reload();
		this._cdr.markForCheck();
	}

	reload(): void {
		this.page = 1;
		void this._load();
	}

	go(p: number): void {
		if (p < 1 || p > this.totalPages) return;
		this.page = p;
		void this._load();
	}

	fmt(s?: string): string {
		if (!s) return "—";
		const d = new Date(s.includes(" ") && !s.includes("T") ? s.replace(" ", "T") : s);
		return isNaN(d.getTime()) ? s : d.toLocaleDateString();
	}

	private async _load(): Promise<void> {
		const seq = ++this._seq;
		this.loading = true;
		this.error = null;
		this._cdr.markForCheck();
		try {
			const res = await this._analytics.listRecords({ ...this.query, page: this.page, pageSize: this.pageSize });
			if (seq !== this._seq) return;
			this.rows = res?.items || [];
			this.total = res?.total || 0;
			this.totalPages = res?.totalPages || 1;
		} catch (e: any) {
			if (seq !== this._seq) return;
			this.error = e?.error?.validationError || e?.error?.message || "Failed to load records";
			this.rows = [];
		} finally {
			if (seq === this._seq) {
				this.loading = false;
				this._cdr.markForCheck();
			}
		}
	}
}
