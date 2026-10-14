import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { CommonModule } from "@angular/common";
import { environment } from "environments/environment";
import { AuthService } from "app/core/auth/auth.service";

@Component({
	standalone: true,
	selector: "app-root-redirect",
	template: "",
	imports: [CommonModule],
})
export class RootRedirectComponent implements OnInit {
	constructor(private router: Router, private _authService: AuthService) {}

	ngOnInit(): void {
		try {
			// Lawyers always go to their dedicated area
			if (this._authService.isLawyer) {
				this.router.navigateByUrl("/zelf-legacy/lawyers", { replaceUrl: true });
				return;
			}

			const host = window?.location?.host || "";
			const cfg = (environment as any)?.rootRedirect || {};
			const enabled = cfg.enabled !== false;
			const shouldMatchHost = !!cfg.host;
			const hostMatches = shouldMatchHost ? host === cfg.host : false;

			const target = enabled && hostMatches ? cfg.path || "/portfolio/payment" : cfg.fallbackPath || "/tags";

			this.router.navigateByUrl(target, { replaceUrl: true });
		} catch {
			this.router.navigateByUrl("/tags", { replaceUrl: true });
		}
	}
}
