import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, OnChanges, SimpleChanges, ViewEncapsulation } from "@angular/core";
import { ApexOptions, NgApexchartsModule } from "ng-apexcharts";
import { TranslocoService } from "@jsverse/transloco";

import { AnalyticsSummary, bucketsToSeries } from "../analytics.utils";

@Component({
	selector: "app-origin-chart",
	standalone: true,
	imports: [CommonModule, NgApexchartsModule],
	templateUrl: "./origin-chart.component.html",
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OriginChartComponent implements OnInit, OnChanges {
	@Input() summary: AnalyticsSummary | null = null;

	chartOptions: ApexOptions = {
		chart: { type: "donut" },
		series: [],
	};
	labels: string[] = [];
	series: number[] = [];
	counts: number[] = []; // Actual counts for each bucket

	constructor(
		private _translocoService: TranslocoService,
		private _cdr: ChangeDetectorRef
	) {}

	ngOnInit(): void {
		this._updateChart();
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes["summary"]) {
			this._updateChart();
		}
	}

	private _updateChart(): void {
		const result = this._calculateOriginBuckets();
		this.labels = result.labels || [];
		this.series = result.series || [];
		this.counts = result.counts || [];

		this.chartOptions = {
			chart: {
				animations: {
					speed: 400,
					animateGradually: {
						enabled: false,
					},
				},
				fontFamily: "inherit",
				foreColor: "inherit",
				width: "100%",
				height: 180,
				type: "donut",
				sparkline: {
					enabled: true,
				},
			},
			colors: ["#57534E", "#78716C", "#A8A29E"],
			labels: this.labels || [],
			plotOptions: {
				pie: {
					customScale: 0.9,
					expandOnClick: false,
					donut: {
						size: "70%",
					},
				},
			},
			series: this.series || [],
			states: {
				hover: {
					filter: {
						type: "none",
					},
				},
				active: {
					filter: {
						type: "none",
					},
				},
			},
			tooltip: {
				enabled: true,
				fillSeriesColor: false,
				theme: "dark",
				custom: ({ seriesIndex, w }): string => {
					const count = this.counts[seriesIndex] || 0;
					const percentage = w.config.series[seriesIndex] || 0;
					const label = this._formatOriginLabel(w.config.labels[seriesIndex] || "");
					const tagLabel = count === 1 
						? this._translocoService.translate("analytics.chart.tag") 
						: this._translocoService.translate("analytics.chart.tags");
					return `<div class="flex flex-col px-3 py-2">
                                                    <div class="flex items-center">
                                                        <div class="w-3 h-3 rounded-full" style="background-color: ${w.config.colors[seriesIndex]};"></div>
                                                        <div class="ml-2 text-md leading-none">${label}</div>
                                                    </div>
                                                    <div class="ml-5 mt-1 text-sm text-gray-400">${count} ${tagLabel} • ${percentage}%</div>
                                                </div>`;
				},
			},
		};

		this._cdr.markForCheck();
	}

	private _formatOriginLabel(origin: string): string {
		if (!origin || origin === "unknown") return this._translocoService.translate("analytics.stats.unknown");
		// Capitalize first letter and format nicely
		return origin.charAt(0).toUpperCase() + origin.slice(1).toLowerCase();
	}

	private _calculateOriginBuckets(): { labels: string[]; series: number[]; counts: number[] } {
		return bucketsToSeries(this.summary?.byOrigin);
	}
}
