import { CommonModule, DecimalPipe } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router } from "@angular/router";
import { AnalyticsService, AnalyticsSnapshot } from "app/modules/dashboards/analytics/analytics.service";
import { AnalyticsOnboardingProgress, AnalyticsOnboardingService } from "app/modules/dashboards/analytics/analytics-onboarding.service";
import { AnalyticsOnboardingComponent } from "app/modules/dashboards/analytics/analytics-onboarding.component";
import { AnalyticsSummary, summarySeries } from "app/modules/dashboards/analytics/analytics.utils";
import { AnalyticsRecordsComponent } from "./analytics-records.component";
import { Subject, takeUntil } from "rxjs";
import { TranslocoModule } from "@jsverse/transloco";
import { AllTagsOverviewChartComponent } from "./charts/all-tags-overview-chart.component";
import { ConversionsChartComponent } from "./charts/conversions-chart.component";
import { VisitsChartComponent } from "./charts/visits-chart.component";
import { VisitorsVsPageViewsChartComponent } from "./charts/visitors-vs-page-views-chart.component";
import { TagLeaseLengthsChartComponent } from "./charts/tag-lease-lengths-chart.component";
import { DomainLengthChartComponent } from "./charts/domain-length-chart.component";
import { OriginChartComponent } from "./charts/origin-chart.component";

@Component({
	selector: "analytics",
	templateUrl: "./analytics.component.html",
	styleUrls: ["./analytics.component.scss"],
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		CommonModule,
		MatButtonModule,
		MatIconModule,
		MatMenuModule,
		MatButtonToggleModule,
		MatTooltipModule,
		DecimalPipe,
		TranslocoModule,
		AnalyticsOnboardingComponent,
		AllTagsOverviewChartComponent,
		ConversionsChartComponent,
		VisitsChartComponent,
		VisitorsVsPageViewsChartComponent,
		TagLeaseLengthsChartComponent,
		DomainLengthChartComponent,
		OriginChartComponent,
		AnalyticsRecordsComponent,
	],
})
export class AnalyticsComponent implements OnInit, OnDestroy {
	summary: AnalyticsSummary | null = null;
	snapshot: AnalyticsSnapshot | null = null;
	onboardingProgress: AnalyticsOnboardingProgress | null = null;
	showLiveDashboard = false;

	tagLeaseLengthsColors: string[] = ["#1a1a2e", "#9d52ef", "#ff5721", "#ffcfbd", "#e5e5e5", "#f4f4f4"];
	domainLengthColors: string[] = ["#1a1a2e", "#9d52ef", "#ff5721", "#ffcfbd"];
	originColors: string[] = ["#1a1a2e", "#0e26ff", "#ff5721"];

	currentDomain: string | null = null;

	dailyStats: {
		highestDay?: { date: string; count: number };
		lowestDay?: { date: string; count: number };
		totalRecords: number;
	} | null = null;

	private _unsubscribeAll = new Subject<void>();

	constructor(
		private _analyticsService: AnalyticsService,
		private _onboardingService: AnalyticsOnboardingService,
		private _router: Router,
		private _cdr: ChangeDetectorRef
	) {}

	ngOnInit(): void {
		this.showLiveDashboard = this._onboardingService.isFastPathComplete();

		this._onboardingService.progress$.pipe(takeUntil(this._unsubscribeAll)).subscribe((progress) => {
			this.onboardingProgress = progress;
			if (!progress.loading) {
				this.showLiveDashboard = progress.allRequiredComplete || this._onboardingService.isFastPathComplete();
			}
			this._cdr.markForCheck();
		});

		this._analyticsService.snapshot$.pipe(takeUntil(this._unsubscribeAll)).subscribe((snapshot) => {
			this.snapshot = snapshot;
			this.summary = snapshot.summary;
			this.currentDomain = snapshot.currentDomain;
			const seriesResult = summarySeries(snapshot.summary, "all");
			this.dailyStats = {
				highestDay: seriesResult.stats.highestDay,
				lowestDay: seriesResult.stats.lowestDay,
				totalRecords: seriesResult.stats.totalRecords,
			};
			if (!snapshot.loading) {
				void this._onboardingService.refresh(snapshot);
			}
			this._cdr.markForCheck();
		});

		void this._analyticsService.loadAnalytics();

		window["Apex"] = {
			chart: {
				events: {
					mounted: (chart: any): void => {
						this._fixSvgFill(chart.el);
					},
					updated: (chart: any): void => {
						this._fixSvgFill(chart.el);
					},
				},
			},
		};
	}

	ngOnDestroy(): void {
		this._unsubscribeAll.next();
		this._unsubscribeAll.complete();
	}

	get metrics() {
		return this.snapshot?.metrics;
	}

	get paidTagsCount(): number {
		return this.metrics?.paidInPeriod.current ?? 0;
	}

	get activeTagsCount(): number {
		return this.metrics?.activeSnapshot.current ?? 0;
	}

	get paidTagsTrend(): number {
		return this.metrics?.paidInPeriod.percentChange ?? 0;
	}

	get activeTagsTrend(): number {
		return this.metrics?.activeSnapshot.percentChange ?? 0;
	}

	get conversionRateTrend(): number {
		return this.metrics?.conversionRateTrend ?? 0;
	}

	get premiumAdoptionTrend(): number {
		return this.metrics?.premiumAdoptionTrend ?? 0;
	}

	get newPaidTrend(): number {
		return this.metrics?.newPaidInPeriod.percentChange ?? 0;
	}

	get conversionRateLabel(): string {
		return `${this.metrics?.conversionRate ?? 0}%`;
	}

	get premiumAdoptionLabel(): string {
		return `${this.metrics?.premiumAdoptionRate ?? 0}%`;
	}

	get newPaidCount(): number {
		return this.metrics?.newPaidInPeriod.current ?? 0;
	}

	get showOnboarding(): boolean {
		return !this.showLiveDashboard;
	}

	get showRealError(): boolean {
		return Boolean(this.snapshot?.error && this.onboardingProgress && !this.onboardingProgress.loading);
	}

	trackByFn(index: number, item: any): any {
		return item.id || index;
	}

	private _fixSvgFill(element: Element): void {
		const currentURL = this._router.url;
		Array.from(element.querySelectorAll("*[fill]"))
			.filter((el) => el.getAttribute("fill")!.indexOf("url(") !== -1)
			.forEach((el) => {
				const attrVal = el.getAttribute("fill")!;
				el.setAttribute("fill", `url(${currentURL}${attrVal.slice(attrVal.indexOf("#"))}`);
			});
	}
}
