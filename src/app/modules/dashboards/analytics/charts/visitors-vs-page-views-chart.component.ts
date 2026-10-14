import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, OnChanges, SimpleChanges, ViewEncapsulation } from "@angular/core";
import { ApexOptions, NgApexchartsModule } from "ng-apexcharts";
import { TranslocoService } from "@jsverse/transloco";
import { AnalyticsSummary, summarySeries, toApexSeries } from "../analytics.utils";

@Component({
	selector: "app-visitors-vs-page-views-chart",
	standalone: true,
	imports: [CommonModule, NgApexchartsModule],
	templateUrl: "./visitors-vs-page-views-chart.component.html",
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisitorsVsPageViewsChartComponent implements OnInit, OnChanges {
	@Input() summary: AnalyticsSummary | null = null;

	chartOptions: ApexOptions = {
		chart: { type: "area" },
		series: [],
	};

	private yAxisMin: number = 0;
	private yAxisMax: number = 10;

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
		const series = this._buildSeries();

		if (series.length > 0) {
			const range = this._calculateYAxisRangeFromSeries(series);
			this.yAxisMin = range.min;
			this.yAxisMax = range.max;
		} else {
			this.yAxisMin = 0;
			this.yAxisMax = 5;
		}

		this.chartOptions = {
			chart: {
				animations: { enabled: false },
				fontFamily: "inherit",
				foreColor: "inherit",
				width: "100%",
				height: 320,
				type: "area",
				toolbar: { show: false },
				zoom: { enabled: false },
			},
			colors: ["#64748B", "#94A3B8"],
			dataLabels: { enabled: false },
			fill: { colors: ["#64748B", "#94A3B8"], opacity: 0.5 },
			grid: { show: false, padding: { bottom: -40, left: 0, right: 0 } },
			legend: { show: false },
			series: series || [],
			stroke: { curve: "smooth", width: 2 },
			tooltip: {
				followCursor: true,
				theme: "dark",
				x: { format: this._translocoService.translate("analytics.chart.dateFormat") },
			},
			xaxis: {
				axisBorder: { show: false },
				labels: { offsetY: -20, rotate: 0, style: { colors: "var(--fuse-text-secondary)" } },
				tickAmount: 3,
				tooltip: { enabled: false },
				type: "datetime",
			},
			yaxis: {
				labels: { style: { colors: "var(--fuse-text-secondary)" } },
				min: this.yAxisMin,
				max: this.yAxisMax,
				show: false,
				tickAmount: 5,
			},
		};

		this._cdr.markForCheck();
	}

	private _buildSeries(): any[] {
		const allTags = toApexSeries(summarySeries(this.summary, "all", 30).data);
		const paidTags = toApexSeries(summarySeries(this.summary, "paid", 30).data);

		const validAllTags = allTags.filter((point) => this._isValidPoint(point));
		const validPaidTags = paidTags.filter((point) => this._isValidPoint(point));

		if (validAllTags.length === 0) validAllTags.push([Date.now(), 0]);
		if (validPaidTags.length === 0) validPaidTags.push([Date.now(), 0]);

		const allTagsLabel = this._translocoService.translate("analytics.chart.allTags");
		const paidTagsLabel = this._translocoService.translate("analytics.chart.paidTags");
		return [
			{ name: allTagsLabel, data: validAllTags },
			{ name: paidTagsLabel, data: validPaidTags },
		];
	}

	private _isValidPoint(point: [number, number]): boolean {
		const [timestamp, value] = point;
		return typeof timestamp === "number" && !isNaN(timestamp) && timestamp > 0 && typeof value === "number" && !isNaN(value) && value >= 0;
	}

	private _calculateYAxisRangeFromSeries(series: any[]): { min: number; max: number } {
		if (!Array.isArray(series) || series.length === 0) return { min: 0, max: 10 };

		const allValues: number[] = [];
		for (const s of series) {
			if (s?.data && Array.isArray(s.data)) {
				for (const item of s.data) {
					const value = Array.isArray(item) ? item[1] : item;
					if (typeof value === "number") allValues.push(value);
				}
			}
		}

		if (allValues.length === 0) return { min: 0, max: 10 };

		const min = Math.min(...allValues);
		const max = Math.max(...allValues);
		if (max === 0) return { min: 0, max: 5 };

		const padding = Math.max(1, Math.ceil(max * 0.1));
		return { min: Math.max(0, min - padding), max: max + padding };
	}
}
