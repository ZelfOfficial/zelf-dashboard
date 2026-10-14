export interface TagAnalyticsRecord {
	name: string;
	type: string;
	origin: string;
	registeredAt?: string;
	expiresAt?: string;
}

export interface DailySeriesPoint {
	timestamp: number;
	count: number;
}

export interface DailySeriesResult {
	data: DailySeriesPoint[];
	stats: {
		highestDay?: { date: string; count: number };
		lowestDay?: { date: string; count: number };
		totalRecords: number;
	};
}

export interface PeriodMetrics {
	current: number;
	previous: number;
	percentChange: number;
}

export interface AnalyticsMetrics {
	totalCount: number;
	paidCount: number;
	activeCount: number;
	paidInPeriod: PeriodMetrics;
	activeSnapshot: PeriodMetrics;
	conversionRate: number;
	conversionRateTrend: number;
	premiumAdoptionRate: number;
	premiumAdoptionTrend: number;
	newPaidInPeriod: PeriodMetrics;
}

export const ANALYTICS_PERIOD_DAYS = 30;

export function parseDateToTimestamp(s?: string): number | null {
	if (!s) return null;
	try {
		if (s.includes(" ") && !s.includes("T")) {
			const [datePart, timePart] = s.split(" ");
			const [year, month, day] = datePart.split("-").map(Number);
			const [hour, minute, second] = timePart.split(":").map(Number);
			const d = new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
			return d.getTime();
		}
		const t = Date.parse(s);
		return isNaN(t) ? null : t;
	} catch {
		return null;
	}
}

export function parseDateToDate(s?: string): Date | null {
	if (!s) return null;
	try {
		if (s.includes(" ") && !s.includes("T")) {
			const [datePart, timePart] = s.split(" ");
			const [year, month, day] = datePart.split("-").map(Number);
			const [hour, minute, second] = timePart.split(":").map(Number);
			return new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
		}
		const d = new Date(s);
		return isNaN(d.getTime()) ? null : d;
	} catch {
		return null;
	}
}

export function normalizeTagRow(raw: any, keyPrefix: string = "tagName"): TagAnalyticsRecord | null {
	let pd = raw?.publicData ?? raw?.tagObject?.publicData ?? {};

	if (pd?.extraParams && typeof pd.extraParams === "string") {
		try {
			const extraParams = JSON.parse(pd.extraParams);
			pd = { ...pd, ...extraParams };
		} catch {
			// ignore invalid extraParams
		}
	}

	const fullName: string =
		(typeof raw?.name === "string" && raw.name) ||
		(typeof pd?.zelfName === "string" && pd.zelfName) ||
		(typeof pd?.avaxName === "string" && pd.avaxName) ||
		pd[keyPrefix] ||
		pd["tagName"] ||
		"";

	if (!fullName) return null;

	return {
		name: fullName,
		type: String(pd?.type || "").toLowerCase(),
		origin: String(pd?.origin || "unknown").toLowerCase(),
		registeredAt: pd?.registeredAt || raw?.created_at || pd?.renewedAt || undefined,
		expiresAt: pd?.expiresAt || undefined,
	};
}

export function normalizeTagRows(items: any[], keyPrefix: string = "tagName"): TagAnalyticsRecord[] {
	const records: TagAnalyticsRecord[] = [];
	for (const item of items) {
		const record = normalizeTagRow(item, keyPrefix);
		if (record) records.push(record);
	}
	return records;
}

export function isPaidTag(record: TagAnalyticsRecord): boolean {
	return record.type === "mainnet";
}

export function isActiveTag(record: TagAnalyticsRecord, now: Date = new Date()): boolean {
	if (!record.expiresAt) return true;
	const exp = parseDateToDate(record.expiresAt);
	if (!exp) return true;
	return exp.getTime() > now.getTime();
}

export function getBaseName(tagName: string, currentDomain: string | null): string {
	let name = tagName;
	if (currentDomain && name.endsWith(`.${currentDomain}`)) {
		name = name.slice(0, -1 * (currentDomain.length + 1));
	}
	if (name.endsWith(".hold")) name = name.slice(0, -5);
	return name.split(".")[0];
}

export function percentChange(current: number, previous: number): number {
	if (previous === 0) {
		return current === 0 ? 0 : 100;
	}
	return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

export function startOfDay(d: Date): Date {
	const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	copy.setHours(0, 0, 0, 0);
	return copy;
}

export function countInRange(
	records: TagAnalyticsRecord[],
	rangeStart: Date,
	rangeEnd: Date,
	filter?: (r: TagAnalyticsRecord) => boolean
): number {
	const pick = filter ? records.filter(filter) : records;
	const startMs = rangeStart.getTime();
	const endMs = rangeEnd.getTime();
	let count = 0;
	for (const r of pick) {
		const ts = parseDateToTimestamp(r.registeredAt);
		if (ts == null) continue;
		if (ts >= startMs && ts < endMs) count++;
	}
	return count;
}

export function countActiveAt(records: TagAnalyticsRecord[], at: Date): number {
	return records.filter((r) => {
		if (!r.expiresAt) return true;
		const exp = parseDateToDate(r.expiresAt);
		if (!exp) return true;
		return exp.getTime() > at.getTime();
	}).length;
}

export function buildDailySeries(
	records: TagAnalyticsRecord[],
	days: number = ANALYTICS_PERIOD_DAYS,
	rangeEnd?: Date,
	filter?: (r: TagAnalyticsRecord) => boolean
): DailySeriesResult {
	const now = rangeEnd ? startOfDay(rangeEnd) : startOfDay(new Date());
	const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
	start.setHours(0, 0, 0, 0);
	const byDay = new Map<string, number>();
	const pick = filter ? records.filter(filter) : records;

	for (const r of pick) {
		const ts = parseDateToTimestamp(r.registeredAt);
		if (ts == null) continue;
		const d = startOfDay(new Date(ts));
		if (d < start || d > now) continue;
		const key = d.toISOString().slice(0, 10);
		byDay.set(key, (byDay.get(key) || 0) + 1);
	}

	const data: DailySeriesPoint[] = [];
	const dayCounts: number[] = [];
	const dayLabels: string[] = [];

	for (let i = 0; i < days; i++) {
		const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
		const key = cur.toISOString().slice(0, 10);
		const dayCount = byDay.get(key) || 0;
		dayCounts.push(dayCount);
		dayLabels.push(key);
		data.push({ timestamp: cur.getTime(), count: dayCount });
	}

	const nonZeroCounts = dayCounts.filter((c) => c > 0);
	const minCount = nonZeroCounts.length > 0 ? Math.min(...nonZeroCounts) : 0;
	const maxCount = Math.max(...dayCounts, 0);
	const minDayIndex = dayCounts.indexOf(minCount);
	const maxDayIndex = dayCounts.indexOf(maxCount);

	return {
		data,
		stats: {
			highestDay: maxCount > 0 && maxDayIndex >= 0 ? { date: dayLabels[maxDayIndex], count: maxCount } : undefined,
			lowestDay: minCount > 0 && minDayIndex >= 0 ? { date: dayLabels[minDayIndex], count: minCount } : undefined,
			totalRecords: pick.length,
		},
	};
}

export function toApexSeries(points: DailySeriesPoint[]): [number, number][] {
	return points.map((p) => [p.timestamp, p.count]);
}

export function computeAnalyticsMetrics(records: TagAnalyticsRecord[], periodDays: number = ANALYTICS_PERIOD_DAYS): AnalyticsMetrics {
	const now = startOfDay(new Date());
	const currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (periodDays - 1));
	currentStart.setHours(0, 0, 0, 0);
	const previousEnd = new Date(currentStart);
	const previousStart = new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate() - periodDays);

	const totalCount = records.length;
	const paidCount = records.filter(isPaidTag).length;
	const activeCount = countActiveAt(records, now);

	const paidCurrent = countInRange(records, currentStart, new Date(now.getTime() + 86400000), isPaidTag);
	const paidPrevious = countInRange(records, previousStart, previousEnd, isPaidTag);

	const activeCurrent = countActiveAt(records, now);
	const activePrevious = countActiveAt(records, previousStart);

	const allCurrent = countInRange(records, currentStart, new Date(now.getTime() + 86400000));
	const allPrevious = countInRange(records, previousStart, previousEnd);

	const conversionRate = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

	const currentConversion = allCurrent > 0 ? (paidCurrent / allCurrent) * 100 : 0;
	const previousConversion = allPrevious > 0 ? (paidPrevious / allPrevious) * 100 : 0;

	const premiumAdoptionRate = allCurrent > 0 ? Math.round((paidCurrent / allCurrent) * 100) : 0;
	const previousPremium = allPrevious > 0 ? (paidPrevious / allPrevious) * 100 : 0;

	return {
		totalCount,
		paidCount,
		activeCount,
		paidInPeriod: {
			current: paidCurrent,
			previous: paidPrevious,
			percentChange: percentChange(paidCurrent, paidPrevious),
		},
		activeSnapshot: {
			current: activeCurrent,
			previous: activePrevious,
			percentChange: percentChange(activeCurrent, activePrevious),
		},
		conversionRate,
		conversionRateTrend: percentChange(currentConversion, previousConversion),
		premiumAdoptionRate,
		premiumAdoptionTrend: percentChange(premiumAdoptionRate, Math.round(previousPremium)),
		newPaidInPeriod: {
			current: paidCurrent,
			previous: paidPrevious,
			percentChange: percentChange(paidCurrent, paidPrevious),
		},
	};
}

export function calculateLeaseYears(registeredAt?: string, expiresAt?: string): number | null {
	if (!registeredAt || !expiresAt) return null;
	const regDate = parseDateToDate(registeredAt);
	const expDate = parseDateToDate(expiresAt);
	if (!regDate || !expDate) return null;
	const diffMs = expDate.getTime() - regDate.getTime();
	return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}

/* ------------------------------------------------------------------------------------------------
 * Server summary (GET /api/zelf-ids/analytics/summary). The API aggregates the domain snapshot so the
 * dashboard never pages through every tag. Day buckets are UTC dates (YYYY-MM-DD), oldest first.
 * ---------------------------------------------------------------------------------------------- */
export interface AnalyticsDailyBucket {
	date: string;
	all: number;
	paid: number;
	active: number;
}

export interface AnalyticsSummary {
	domain: string;
	periodDays: number;
	totals: { total: number; paid: number; active: number; activePreviousPeriod: number };
	byType: Record<string, number>;
	byPlan: Record<string, number>;
	byOrigin: Record<string, number>;
	byStorage: Record<string, number>;
	byNameLength: Record<string, number>;
	byLeaseYears: Record<string, number>;
	daily: AnalyticsDailyBucket[];
	recent: Array<{ name: string; type: string; plan: string | null; origin: string; storage: string; registeredAt?: string; expiresAt?: string }>;
	generatedAt: string;
	snapshotAgeSec: number;
	stale: boolean;
}

function _bucketTimestamp(date: string): number {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(y, m - 1, d).getTime();
}

/** Daily series from the summary: `days` buckets ending `offsetDays` before the latest bucket. */
export function summarySeries(
	summary: AnalyticsSummary | null | undefined,
	key: "all" | "paid" | "active",
	days: number = ANALYTICS_PERIOD_DAYS,
	offsetDays: number = 0
): DailySeriesResult {
	const daily = summary?.daily || [];
	const end = Math.max(0, daily.length - offsetDays);
	const slice = daily.slice(Math.max(0, end - days), end);
	const data: DailySeriesPoint[] = slice.map((b) => ({ timestamp: _bucketTimestamp(b.date), count: b[key] || 0 }));
	const counts = data.map((p) => p.count);
	const nonZero = counts.filter((c) => c > 0);
	const max = Math.max(...counts, 0);
	const min = nonZero.length ? Math.min(...nonZero) : 0;
	return {
		data,
		stats: {
			highestDay: max > 0 ? { date: slice[counts.indexOf(max)].date, count: max } : undefined,
			lowestDay: min > 0 ? { date: slice[counts.indexOf(min)].date, count: min } : undefined,
			totalRecords: summary?.totals?.total ?? 0,
		},
	};
}

/** Same KPIs as computeAnalyticsMetrics, derived from the summary's daily buckets and totals. */
export function metricsFromSummary(summary: AnalyticsSummary | null | undefined, periodDays: number = ANALYTICS_PERIOD_DAYS): AnalyticsMetrics {
	if (!summary) return computeAnalyticsMetrics([]);
	const sum = (key: "all" | "paid", offset: number) => summarySeries(summary, key, periodDays, offset).data.reduce((a, p) => a + p.count, 0);
	const paidCurrent = sum("paid", 0);
	const paidPrevious = sum("paid", periodDays);
	const allCurrent = sum("all", 0);
	const allPrevious = sum("all", periodDays);
	const { total, paid, active, activePreviousPeriod } = summary.totals;

	const currentConversion = allCurrent > 0 ? (paidCurrent / allCurrent) * 100 : 0;
	const previousConversion = allPrevious > 0 ? (paidPrevious / allPrevious) * 100 : 0;
	const premiumAdoptionRate = allCurrent > 0 ? Math.round((paidCurrent / allCurrent) * 100) : 0;
	const previousPremium = allPrevious > 0 ? (paidPrevious / allPrevious) * 100 : 0;
	const paidPeriod = { current: paidCurrent, previous: paidPrevious, percentChange: percentChange(paidCurrent, paidPrevious) };

	return {
		totalCount: total,
		paidCount: paid,
		activeCount: active,
		paidInPeriod: paidPeriod,
		activeSnapshot: { current: active, previous: activePreviousPeriod, percentChange: percentChange(active, activePreviousPeriod) },
		conversionRate: total > 0 ? Math.round((paid / total) * 100) : 0,
		conversionRateTrend: percentChange(currentConversion, previousConversion),
		premiumAdoptionRate,
		premiumAdoptionTrend: percentChange(premiumAdoptionRate, Math.round(previousPremium)),
		newPaidInPeriod: { ...paidPeriod },
	};
}

/** Percent series for a bucket map, in the given label order (or the map's own order). */
export function bucketsToSeries(
	map: Record<string, number> | null | undefined,
	order?: string[]
): { labels: string[]; series: number[]; counts: number[] } {
	const labels = order || Object.keys(map || {});
	const counts = labels.map((k) => (map && map[k]) || 0);
	const total = counts.reduce((a, b) => a + b, 0);
	const series = total > 0 ? counts.map((c) => Math.round((c / total) * 10000) / 100) : counts;
	return { labels, series, counts };
}
