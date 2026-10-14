import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, OnChanges, SimpleChanges, ViewEncapsulation } from "@angular/core";
import { ApexOptions, NgApexchartsModule } from "ng-apexcharts";
import { TranslocoService } from "@jsverse/transloco";
import { ANALYTICS_PERIOD_DAYS, AnalyticsSummary, summarySeries, toApexSeries } from "../analytics.utils";

@Component({
	selector: "app-all-tags-overview-chart",
	standalone: true,
	imports: [CommonModule, NgApexchartsModule],
	templateUrl: "./all-tags-overview-chart.component.html",
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllTagsOverviewChartComponent implements OnInit, OnChanges {
	@Input() summary: AnalyticsSummary | null = null;
	@Input() selectedPeriod: string = "this-month";

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

	ngOnChanges(changes: SimpleChanges): void {
		if (changes["summary"] || changes["selectedPeriod"]) {
			this._updateChart();
		}
	}

	ngOnInit(): void {
		this._updateChart();
	}

	private _updateChart(): void {
		if (!this.selectedPeriod || (this.selectedPeriod !== "this-month" && this.selectedPeriod !== "previous-month")) {
			this.selectedPeriod = "this-month";
		}

		const series = this._buildSeries();
		const totalLabel = this._translocoService.translate("analytics.chart.total");
		const selectedSeries = series[this.selectedPeriod] || series["this-month"] || [{ name: totalLabel, data: [] }];

		if (selectedSeries?.[0]?.data && Array.isArray(selectedSeries[0].data)) {
			const visitorData = selectedSeries[0].data;
			if (visitorData.length > 0) {
				const range = this._calculateYAxisRange(visitorData);
				this.yAxisMin = range.min;
				this.yAxisMax = range.max;
			} else {
				this.yAxisMin = 0;
				this.yAxisMax = 5;
			}
		} else {
			this.yAxisMin = 0;
			this.yAxisMax = 5;
		}

		this.chartOptions = {
			chart: {
				animations: {
					speed: 400,
					animateGradually: { enabled: false },
				},
				fontFamily: "inherit",
				foreColor: "inherit",
				width: "100%",
				height: 320,
				type: "area",
				toolbar: { show: false },
				zoom: { enabled: false },
			},
			colors: ["#64748B"],
			dataLabels: { enabled: false },
			fill: { colors: ["#64748B"], opacity: 0.15 },
			grid: {
				show: true,
				borderColor: "#E2E8F0",
				strokeDashArray: 4,
				padding: { top: 10, bottom: 60, left: 20, right: 40 },
				position: "back",
				xaxis: { lines: { show: false } },
				yaxis: { lines: { show: true } },
			},
			series: selectedSeries,
			stroke: { width: 2, colors: ["#64748B"] },
			tooltip: {
				followCursor: true,
				theme: "dark",
				x: { format: this._translocoService.translate("analytics.chart.dateFormat") },
				y: { formatter: (value: number): string => `${value}` },
			},
			xaxis: {
				axisBorder: { show: false },
				axisTicks: { show: false },
				crosshairs: { stroke: { color: "#475569", dashArray: 0, width: 2 } },
				tooltip: { enabled: false },
				type: "datetime",
				tickPlacement: "on",
				floating: false,
				position: "bottom",
				labels: {
					offsetY: 0,
					style: { colors: "#CBD5E1", fontSize: "11px" },
					rotate: -45,
					trim: false,
					hideOverlappingLabels: false,
					show: true,
				},
			},
			yaxis: {
				axisTicks: { show: false },
				axisBorder: { show: false },
				min: this.yAxisMin,
				max: this.yAxisMax,
				tickAmount: 5,
				show: false,
			},
		};

		this._cdr.markForCheck();
	}

	private _buildSeries(): { "this-month": any[]; "previous-month": any[] } {
		const thisMonth = toApexSeries(summarySeries(this.summary, "all", ANALYTICS_PERIOD_DAYS, 0).data);
		const previousMonth = toApexSeries(summarySeries(this.summary, "all", ANALYTICS_PERIOD_DAYS, ANALYTICS_PERIOD_DAYS).data);

		const validThisMonth = thisMonth.filter((point) => this._isValidPoint(point));
		const validPreviousMonth = previousMonth.filter((point) => this._isValidPoint(point));

		if (validThisMonth.length === 0) validThisMonth.push([Date.now(), 0]);
		if (validPreviousMonth.length === 0) validPreviousMonth.push([Date.now(), 0]);

		const totalLabel = this._translocoService.translate("analytics.chart.total");
		return {
			"this-month": [{ name: totalLabel, data: validThisMonth }],
			"previous-month": [{ name: totalLabel, data: validPreviousMonth }],
		};
	}

	private _isValidPoint(point: [number, number]): boolean {
		const [timestamp, value] = point;
		return typeof timestamp === "number" && !isNaN(timestamp) && timestamp > 0 && typeof value === "number" && !isNaN(value) && value >= 0;
	}

	private _calculateYAxisRange(data: any[]): { min: number; max: number } {
		if (!Array.isArray(data) || data.length === 0) return { min: 0, max: 10 };

		const values = data.map((item) => (Array.isArray(item) ? item[1] : item)).filter((v) => typeof v === "number");
		if (values.length === 0) return { min: 0, max: 10 };

		const min = Math.min(...values);
		const max = Math.max(...values);
		if (max === 0) return { min: 0, max: 5 };

		const padding = Math.max(1, Math.ceil(max * 0.1));
		return { min: Math.max(0, min - padding), max: max + padding };
	}
}
