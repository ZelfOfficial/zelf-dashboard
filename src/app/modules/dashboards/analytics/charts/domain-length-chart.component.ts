import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, OnChanges, SimpleChanges, ViewEncapsulation } from "@angular/core";
import { ApexOptions, NgApexchartsModule } from "ng-apexcharts";
import { TranslocoService } from "@jsverse/transloco";

import { AnalyticsSummary, bucketsToSeries } from "../analytics.utils";

@Component({
	selector: "app-domain-length-chart",
	standalone: true,
	imports: [CommonModule, NgApexchartsModule],
	templateUrl: "./domain-length-chart.component.html",
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DomainLengthChartComponent implements OnInit, OnChanges {
	@Input() summary: AnalyticsSummary | null = null;
	@Input() currentDomain: string | null = null;

	chartOptions: ApexOptions = {
		chart: { type: "donut" },
		series: [],
	};
	labels: string[] = [];
	series: number[] = [];
	counts: number[] = []; // Actual counts for each bucket

	constructor(
		private _cdr: ChangeDetectorRef,
		private _translocoService: TranslocoService
	) {}

	ngOnInit(): void {
		this._updateChart();
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes["summary"] || changes["currentDomain"]) {
			this._updateChart();
		}
	}

	private _updateChart(): void {
		const result = this._calculateRangeBuckets();
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
			colors: ["#1a1a2e", "#9d52ef", "#ff5721", "#ffcfbd"],
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
					const charsLabel = this._translocoService.translate("analytics.chart.chars");
					const tagLabel = count === 1 
						? this._translocoService.translate("analytics.chart.tag") 
						: this._translocoService.translate("analytics.chart.tags");
					return `<div class="flex flex-col px-3 py-2">
                                                     <div class="flex items-center">
                                                         <div class="w-3 h-3 rounded-full" style="background-color: ${w.config.colors[seriesIndex]};"></div>
                                                         <div class="ml-2 text-md leading-none">${w.config.labels[seriesIndex]} ${charsLabel}</div>
                                                     </div>
                                                     <div class="ml-5 mt-1 text-sm text-gray-400">${count} ${tagLabel} • ${percentage}%</div>
                                                 </div>`;
				},
			},
		};

		this._cdr.markForCheck();
	}

	private _calculateRangeBuckets(): { labels: string[]; series: number[]; counts: number[] } {
		return bucketsToSeries(this.summary?.byNameLength, ["1-3", "4-10", "11-20", "21-27"]);
	}
}
