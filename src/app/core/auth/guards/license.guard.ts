import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, Router, type CanActivateFn } from "@angular/router";
import { from, of } from "rxjs";
import { LicenseService } from "app/modules/pages/settings/license/license.service";

/**
 * Check if license exists in localStorage
 *
 * @returns boolean
 */
export function hasLicense(): boolean {
	try {
		const licenseStr = localStorage.getItem("license");
		if (!licenseStr) {
			return false;
		}

		const licenseData = JSON.parse(licenseStr);
		const domainCfg = licenseData?.domainConfig || licenseData;
		const domain = domainCfg?.name || domainCfg?.domain || licenseData?.domain;

		return !!(domain && domain.trim() !== "");
	} catch (error) {
		return false;
	}
}

/**
 * Fill the localStorage license cache from GET /api/license/my-license when it is empty
 * (fresh tab, deep link, cleared storage). Resolves true when a license with a domain exists.
 */
export async function ensureLicenseCached(licenseService: LicenseService): Promise<boolean> {
	if (hasLicense()) return true;
	try {
		const response: any = await licenseService.getMyLicense(true);
		const domainConfig = response?.data?.myLicense?.domainConfig;
		if (domainConfig?.name) {
			localStorage.setItem("license", JSON.stringify({ domainConfig }));
		}
	} catch {
		// fall through to the cached check
	}
	return hasLicense();
}

export const LicenseGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
	const router = inject(Router);
	const licenseService = inject(LicenseService);

	if (hasLicense()) return of(true);

	return from(ensureLicenseCached(licenseService).then((ok) => (ok ? true : router.parseUrl("/settings/license"))));
};
