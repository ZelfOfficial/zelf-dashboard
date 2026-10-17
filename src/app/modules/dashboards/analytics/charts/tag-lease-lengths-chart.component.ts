import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, OnChanges, SimpleChanges, ViewEncapsulation } from "@angular/core";
import { ApexOptions, NgApexchartsModule } from "ng-apexcharts";
import { TranslocoService } from "@jsverse/transloco";

import { AnalyticsSummary, bucketsToSeries } from "../analytics.utils";

@Component({
	selector: "app-tag-lease-lengths-chart",
	standalone: true,
	imports: [CommonModule, NgApexchartsModule],
	templateUrl: "./tag-lease-lengths-chart.component.html",
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagLeaseLengthsChartComponent implements OnInit, OnChanges {
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
		const result = this._calculateLeaseBuckets();
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
			colors: ["#163300", "#2f5711", "#9fe870", "#c5f1a5", "#e8ebe6", "#f1f3ef"],
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
					const tagLabel = count === 1 
						? this._translocoService.translate("analytics.chart.tag") 
						: this._translocoService.translate("analytics.chart.tags");
					return `<div class="flex flex-col px-3 py-2">
                                                    <div class="flex items-center">
                                                        <div class="w-3 h-3 rounded-full" style="background-color: ${w.config.colors[seriesIndex]};"></div>
                                                        <div class="ml-2 text-md leading-none">${w.config.labels[seriesIndex]}</div>
                                                    </div>
                                                    <div class="ml-5 mt-1 text-sm text-gray-400">${count} ${tagLabel} • ${percentage}%</div>
                                                </div>`;
				},
			},
		};

		this._cdr.markForCheck();
	}

	private _calculateLeaseBuckets(): { labels: string[]; series: number[]; counts: number[] } {
		const r = bucketsToSeries(this.summary?.byLeaseYears, ["1", "2", "3", "4", "5", "lifetime"]);
		return { ...r, labels: ["1 Year", "2 Years", "3 Years", "4 Years", "5 Years", "Lifetime"] };
	}
}
