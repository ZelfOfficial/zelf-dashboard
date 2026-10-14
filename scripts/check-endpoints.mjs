#!/usr/bin/env node
/**
 * Checks that every `/api/...` path the dashboard calls exists on the v4 API.
 *
 *   node scripts/check-endpoints.mjs /path/to/zelf-online-version   (checked out on v4)
 *
 * Exits 1 and lists the missing paths if any dashboard endpoint has no matching route.
 * Limitation: path-only (no HTTP method), so a param route like GET /subscription-plans/:productId
 * also "matches" e.g. /subscription-plans/cancel-subscription. Review POST/PUT paths by hand.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const apiRepo = process.argv[2];
if (!apiRepo) {
	console.error("usage: node scripts/check-endpoints.mjs <path-to-zelf-online-version@v4>");
	process.exit(2);
}

const walk = (dir, filter, out = []) => {
	for (const name of readdirSync(dir)) {
		if (name === "node_modules" || name.startsWith(".")) continue;
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, filter, out);
		else if (filter(p)) out.push(p);
	}
	return out;
};

// v4 routes: `${PATH}/x` where PATH = config.basePath("/base")  -> /api/base/x
const routes = [];
for (const file of walk(join(apiRepo, "Repositories"), (p) => /\/routes\/.*\.js$/.test(p))) {
	const src = readFileSync(file, "utf8");
	const base = (src.match(/basePath\(\s*["'`]([^"'`]+)["'`]\s*\)/) || src.match(/const base = ["'`]([^"'`]+)["'`]/) || [])[1];
	if (!base) continue;
	for (const m of src.matchAll(/server\.(?:get|post|put|patch|del|delete)\(\s*(`\$\{PATH\}([^`]*)`|PATH\b)/g)) {
		routes.push(`/api${base}${m[2] || ""}`.replace(/\/+$/, ""));
	}
}
const toRegex = (r) => new RegExp("^" + r.replace(/:[^/]+/g, "[^/]+") + "$");
const routeRegexes = routes.map(toRegex);

// Dashboard paths
const used = new Set();
for (const file of walk("src", (p) => p.endsWith(".ts") && !p.includes("mock-api"))) {
	const src = readFileSync(file, "utf8");
	for (const m of src.matchAll(/["'`](?:\$\{[^}]+\})?(\/api\/[A-Za-z0-9/_-]+)/g)) used.add(m[1].replace(/\/+$/, ""));
}

const missing = [...used].filter((u) => !routeRegexes.some((re) => re.test(u)) && !routes.some((r) => r.startsWith(u + "/")));
console.log(`dashboard endpoints: ${used.size}, v4 routes: ${routes.length}`);
if (missing.length) {
	console.log("Missing on v4:\n  " + missing.sort().join("\n  "));
	process.exit(1);
}
console.log("All dashboard endpoints exist on v4.");
