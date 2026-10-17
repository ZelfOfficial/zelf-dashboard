import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges, ViewEncapsulation } from "@angular/core";
import { ApexOptions, NgApexchartsModule } from "ng-apexcharts";

@Component({
	selector: "app-impressions-chart",
	standalone: true,
	imports: [CommonModule, NgApexchartsModule],
	templateUrl: "./impressions-chart.component.html",
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImpressionsChartComponent implements OnChanges {
	@Input() series: any[] = [];
	@Input() labels: any[] = [];

	chartOptions: ApexOptions = {};

	constructor(private _cdr: ChangeDetectorRef) {}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes["series"] || changes["labels"]) {
			this._updateChart();
		}
	}

	private _updateChart(): void {
		this.chartOptions = {
			chart: {
				animations: {
					enabled: false,
				},
				fontFamily: "inherit",
				foreColor: "inherit",
				height: "100%",
				type: "area",
				sparkline: {
					enabled: true,
				},
			},
			colors: ["#ff5721"],
			fill: {
				colors: ["#ff5721"],
				opacity: 0.5,
			},
			series: this.series || [],
			stroke: {
				curve: "smooth",
			},
			tooltip: {
				followCursor: true,
				theme: "dark",
			},
			xaxis: {
				type: "category",
				categories: this.labels || [],
			},
			yaxis: {
				labels: {
					formatter: (val): string => val.toString(),
				},
			},
		};

		this._cdr.markForCheck();
	}
}
