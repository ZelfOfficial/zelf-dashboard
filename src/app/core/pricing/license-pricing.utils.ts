/**
 * License pricing helpers.
 *
 * All prices, plans, durations and length groups come from the license
 * `tags.payment.planPricing` (stored on IPFS and served by the v4 API).
 * Nothing here contains a price, a duration list or a length bucket:
 * every value is read from the table that is passed in.
 *
 * planPricing shape: { [plan]: { [lengthGroup]: { [duration]: number } } }
 * where lengthGroup is either a single length ("3") or a range ("6-15").
 */

export type PriceRow = { [duration: string]: number };
export type PriceTable = { [lengthGroup: string]: PriceRow };
export type PlanPricing = { [plan: string]: PriceTable };

/** Parse a length group key ("3" or "6-15") into an inclusive range. */
export function parseLengthGroup(key: string): { min: number; max: number } | null {
	const trimmed = String(key).trim();
	const range = /^(\d+)\s*-\s*(\d+)$/.exec(trimmed);
	if (range) {
		const min = Number(range[1]);
		const max = Number(range[2]);
		return min <= max ? { min, max } : null;
	}
	if (/^\d+$/.test(trimmed)) {
		const n = Number(trimmed);
		return { min: n, max: n };
	}
	return null;
}

/** Find the length group key in `table` that covers `length`, or null. */
export function findLengthGroup(table: PriceTable | undefined | null, length: number): string | null {
	if (!table) return null;
	for (const key of Object.keys(table)) {
		const range = parseLengthGroup(key);
		if (range && length >= range.min && length <= range.max) return key;
	}
	return null;
}

/** Length group keys of a table, sorted by their lower bound. */
export function sortedLengthGroups(table: PriceTable | undefined | null): string[] {
	if (!table) return [];
	return Object.keys(table)
		.filter((k) => parseLengthGroup(k))
		.sort((a, b) => parseLengthGroup(a)!.min - parseLengthGroup(b)!.min);
}

/** Sort duration keys: numeric durations ascending, non-numeric (e.g. "lifetime") last. */
export function sortDurations(durations: string[]): string[] {
	return [...new Set(durations)].sort((a, b) => {
		const na = Number(a);
		const nb = Number(b);
		const aNum = Number.isFinite(na);
		const bNum = Number.isFinite(nb);
		if (aNum && bNum) return na - nb;
		if (aNum) return -1;
		if (bNum) return 1;
		return a.localeCompare(b);
	});
}

/** Every duration priced anywhere in a table / planPricing. */
export function durationsOf(source: PriceTable | PlanPricing | undefined | null, isPlanPricing = false): string[] {
	if (!source) return [];
	const tables: PriceTable[] = isPlanPricing ? Object.values(source as PlanPricing) : [source as PriceTable];
	const out: string[] = [];
	tables.forEach((t) => Object.values(t || {}).forEach((row) => Object.keys(row || {}).forEach((d) => out.push(d))));
	return sortDurations(out);
}

/** Plans the license prices for a name of `length` (in license order). */
export function plansForLength(planPricing: PlanPricing | undefined | null, length: number): string[] {
	if (!planPricing) return [];
	return Object.keys(planPricing).filter((plan) => findLengthGroup(planPricing[plan], length) !== null);
}

/** Price from the license for plan/length/duration, or null when the license does not offer it. */
export function getLicensePrice(
	planPricing: PlanPricing | undefined | null,
	plan: string | undefined | null,
	length: number,
	duration: string,
): number | null {
	if (!planPricing || !plan) return null;
	const table = planPricing[plan];
	const group = findLengthGroup(table, length);
	if (!group) return null;
	const value = table[group]?.[String(duration)];
	const num = Number(value);
	return value === undefined || value === null || !Number.isFinite(num) ? null : num;
}
