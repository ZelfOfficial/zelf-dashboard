import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { TranslocoModule } from "@jsverse/transloco";
import {
	clonePlanPricing,
	durationsOf,
	parseLengthGroup,
	PlanPricing,
	sortedLengthGroups,
} from "app/core/pricing/license-pricing.utils";

/**
 * Editor for the license `tags.payment.planPricing`.
 *
 * Tabs = plans in the license, rows = length groups of the active plan, columns = durations
 * of the active plan. Nothing is assumed: a new plan, group or duration is only added when the
 * user types it. An empty cell means "not offered" and is removed from the license on save.
 */
@Component({
	selector: "zns-pricing-table",
	templateUrl: "./pricing-table.component.html",
	standalone: true,
	imports: [CommonModule, FormsModule, MatIconModule, TranslocoModule],
})
export class PricingTableComponent {
	@Input() planPricing: PlanPricing = {};
	@Input() activeTab = "";
	@Input() hasUnsavedChanges = false;
	@Output() activeTabChange = new EventEmitter<string>();
	@Output() resetDefault = new EventEmitter<void>();
	@Output() planPricingChange = new EventEmitter<PlanPricing>();
	@Output() saveRequested = new EventEmitter<void>();

	newPlan = "";
	newGroup = "";
	newDuration = "";
	inputError: string | null = null;

	get plans(): string[] {
		return Object.keys(this.planPricing || {});
	}

	get currentPlan(): string {
		return this.plans.includes(this.activeTab) ? this.activeTab : this.plans[0] || "";
	}

	get groups(): string[] {
		return sortedLengthGroups(this.planPricing?.[this.currentPlan]);
	}

	get durations(): string[] {
		return durationsOf(this.planPricing?.[this.currentPlan]);
	}

	durationLabel(d: string): string {
		return Number.isFinite(Number(d)) ? `${d} yr` : d;
	}

	cell(group: string, duration: string): number | null {
		const v = this.planPricing?.[this.currentPlan]?.[group]?.[duration];
		return v === undefined || v === null ? null : v;
	}

	selectTab(tab: string): void {
		if (tab === this.activeTab) return;
		this.activeTabChange.emit(tab);
	}

	onCellChange(group: string, duration: string, raw: number | string | null): void {
		const next = clonePlanPricing(this.planPricing);
		const row = (next[this.currentPlan][group] = next[this.currentPlan][group] || {});
		const value = raw === null || raw === "" ? NaN : Number(raw);
		if (Number.isFinite(value) && value >= 0) row[duration] = value;
		else delete row[duration];
		this.planPricingChange.emit(next);
	}

	addPlan(): void {
		const plan = this.newPlan.trim();
		this.inputError = null;
		if (!/^[a-z0-9_-]+$/i.test(plan)) return void (this.inputError = "Plan id: letters, numbers, - or _");
		if (this.plans.includes(plan)) return void (this.inputError = "Plan already exists");
		const next = clonePlanPricing(this.planPricing);
		next[plan] = {};
		this.newPlan = "";
		this.planPricingChange.emit(next);
		this.activeTabChange.emit(plan);
	}

	addGroup(): void {
		const group = this.newGroup.trim().replace(/\s+/g, "");
		this.inputError = null;
		const range = parseLengthGroup(group);
		if (!this.currentPlan) return void (this.inputError = "Add a plan first");
		if (!range) return void (this.inputError = 'Length group: a number ("3") or a range ("6-15")');
		const overlaps = this.groups.some((g) => {
			const r = parseLengthGroup(g)!;
			return range.min <= r.max && r.min <= range.max;
		});
		if (overlaps) return void (this.inputError = "Length group overlaps an existing one");
		const next = clonePlanPricing(this.planPricing);
		next[this.currentPlan][group] = {};
		this.newGroup = "";
		this.planPricingChange.emit(next);
	}

	addDuration(): void {
		const duration = this.newDuration.trim();
		this.inputError = null;
		if (!this.currentPlan) return void (this.inputError = "Add a plan first");
		if (!/^(\d+|lifetime)$/.test(duration)) return void (this.inputError = 'Duration: years ("1") or "lifetime"');
		if (this.durations.includes(duration)) return void (this.inputError = "Duration already exists");
		if (!this.groups.length) return void (this.inputError = "Add a length group first");
		// A new column starts empty (not offered) until a price is typed.
		this.pendingDurations = [...this.pendingDurations, duration];
		this.newDuration = "";
	}

	/** Durations added in the UI that have no price yet (not saved until a cell is filled). */
	pendingDurations: string[] = [];

	get columns(): string[] {
		return durationsOf({ _: Object.fromEntries([...this.durations, ...this.pendingDurations].map((d) => [d, 0])) } as any);
	}

	removeGroup(group: string): void {
		const next = clonePlanPricing(this.planPricing);
		delete next[this.currentPlan][group];
		this.planPricingChange.emit(next);
	}
}
