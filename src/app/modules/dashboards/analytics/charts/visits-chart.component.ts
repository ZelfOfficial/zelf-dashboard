import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, OnChanges, SimpleChanges, ViewEncapsulation } from "@angular/core";
import { ApexOptions, NgApexchartsModule } from "ng-apexcharts";
import { AnalyticsSummary, summarySeries } from "../analytics.utils";

@Component({
	selector: "app-visits-chart",
	standalone: true,
	imports: [CommonModule, NgApexchartsModule],
	templateUrl: "./visits-chart.component.html",
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisitsChartComponent implements OnInit, OnChanges {
	@Input() summary: AnalyticsSummary | null = null;

	chartOptions: ApexOptions = {
		chart: { type: "area" },
		series: [],
	};

	constructor(private _cdr: ChangeDetectorRef) {}

	ngOnInit(): void {
		this._updateChart();
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes["summary"]) {
			this._updateChart();
		}
	}

	private _updateChart(): void {
		// Registrations per day that are still active (server-side bucket).
		const seriesResult = summarySeries(this.summary, "active", 30);
		const data = seriesResult.data.map((p) => p.count);

		this.chartOptions = {
			chart: {
				animations: { enabled: false },
				fontFamily: "inherit",
				foreColor: "inherit",
				width: "100%",
				height: 320,
				type: "area",
				sparkline: { enabled: true },
			},
			colors: ["#9fe870"],
			fill: { colors: ["#9fe870"], opacity: 0.35 },
			series: [{ data: data.length ? data : [0] }],
			stroke: { curve: "smooth" },
			tooltip: { followCursor: true, theme: "dark" },
			xaxis: { type: "category", categories: [] },
			yaxis: { labels: { formatter: (val): string => val.toString() } },
		};

		this._cdr.markForCheck();
	}
}
