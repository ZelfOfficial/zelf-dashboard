import { Route } from "@angular/router";
import { environment } from "environments/environment";
import { initialDataResolver } from "app/app.resolvers";
import { AuthGuard } from "app/core/auth/guards/auth.guard";
import { NotLawyerGuard } from "app/core/auth/guards/not-lawyer.guard";
import { NoAuthGuard } from "app/core/auth/guards/noAuth.guard";
import { LayoutComponent } from "app/layout/layout.component";

// @formatter:off
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
export const appRoutes: Route[] = [
	// Conditional root redirect based on host/environment via component
	{
		path: "",
		pathMatch: "full",
		loadComponent: () => import("app/root-redirect.component").then((m) => m.RootRedirectComponent),
	},

	// Redirect signed-in user to the '/analytics'
	//
	// After the user signs in, the sign-in page will redirect the user to the 'signed-in-redirect'
	// path. Below is another redirection for that path to redirect the user to the desired
	// location. This is a small convenience to keep all main routes together here on this file.
	{ path: "signed-in-redirect", pathMatch: "full", loadComponent: () => import("app/root-redirect.component").then((m) => m.RootRedirectComponent) },

	// Auth routes for guests
	{
		path: "",
		canActivate: [NoAuthGuard],
		canActivateChild: [NoAuthGuard],
		component: LayoutComponent,
		data: {
			layout: "empty",
		},
		children: [
			{ path: "confirmation-required", loadChildren: () => import("app/modules/auth/confirmation-required/confirmation-required.routes") },
			{ path: "forgot-password", loadChildren: () => import("app/modules/auth/forgot-password/forgot-password.routes") },
			{ path: "reset-password", loadChildren: () => import("app/modules/auth/reset-password/reset-password.routes") },
			{ path: "sign-in", loadChildren: () => import("app/modules/auth/sign-in/sign-in.routes") },
			{ path: "sign-up", loadChildren: () => import("app/modules/auth/sign-up/sign-up.routes") },
			{ path: "auth/accept-invite", loadChildren: () => import("app/modules/auth/accept-invite/accept-invite.routes") },
			{ path: "auth/accept-lawyer-invite", loadChildren: () => import("app/modules/auth/accept-lawyer-invite/accept-lawyer-invite.routes") },
			{ path: "biometric-verification", loadChildren: () => import("app/modules/auth/biometric-verification/biometric-verification.routes") },
		],
	},

	// Auth routes for authenticated users
	{
		path: "",
		canActivate: [AuthGuard],
		canActivateChild: [AuthGuard],
		component: LayoutComponent,
		data: {
			layout: "empty",
		},
		children: [
			{ path: "sign-out", loadChildren: () => import("app/modules/auth/sign-out/sign-out.routes") },
			// Unlock-session had no v4 endpoint (/auth/unlock-session); send users to sign-in instead.
			{ path: "unlock-session", redirectTo: "/sign-in", pathMatch: "full" },
			{
				path: "save-confirmation",
				loadComponent: () =>
					import("app/modules/pages/save-confirmation/save-confirmation.component").then((m) => m.SaveConfirmationComponent),
			},
		],
	},

	// Landing routes
	{
		path: "",
		component: LayoutComponent,
		data: {
			layout: "empty",
		},
		// Fuse landing placeholder removed (#24); keep the URL working.
		children: [{ path: "home", pathMatch: "full", redirectTo: "/tags" }],
	},

	// Public payment routes (no authentication required)
	{
		path: "",
		component: LayoutComponent,
		data: {
			layout: "centered",
		},
		resolve: {
			initialData: initialDataResolver,
		},
		children: [
			{
				path: "portfolio",
				children: [
					{ path: "", pathMatch: "full", redirectTo: "payment" },
					{
						path: "payment",
						loadComponent: () =>
							import("app/modules/dashboards/portfolio/payment/payment.component").then((m) => m.PortfolioPaymentComponent),
					},
					{
						path: "payment-checkout",
						loadComponent: () =>
							import("app/modules/dashboards/portfolio/payment/checkout/checkout.component").then(
								(m) => m.PortfolioPaymentCheckoutComponent
							),
					},
				],
			},
		],
	},

	// ZelfKeys routes: list requires auth, success/cancel are public (Stripe redirects)
	{
		path: "zelfkeys",
		component: LayoutComponent,
		data: {
			layout: "centered",
		},
		resolve: {
			initialData: initialDataResolver,
		},
		children: [
			{
				path: "",
				canActivate: [AuthGuard],
				canActivateChild: [NotLawyerGuard],
				loadChildren: () => import("app/modules/zelfkeys/zelfkeys.routes"),
			},
			{
				path: "success",
				loadComponent: () => import("app/modules/zelfkeys/success/success.component").then((m) => m.ZelfKeysSuccessComponent),
			},
			{
				path: "cancel",
				loadComponent: () => import("app/modules/zelfkeys/cancel/cancel.component").then((m) => m.ZelfKeysCancelComponent),
			},
		],
	},

	// Admin routes
	{
		path: "",
		canActivate: [AuthGuard],
		canActivateChild: [AuthGuard],
		component: LayoutComponent,
		resolve: {
			initialData: initialDataResolver,
		},
		children: [
			{ path: "analytics", canActivate: [NotLawyerGuard], loadChildren: () => import("app/modules/dashboards/analytics/analytics.routes") },
			{ path: "portfolio", canActivate: [NotLawyerGuard], loadChildren: () => import("app/modules/dashboards/portfolio/portfolio.routes") },
			{ path: "tags", canActivate: [NotLawyerGuard], loadChildren: () => import("app/modules/tags/tags.routes") },
			{ path: "profile", loadChildren: () => import("app/modules/pages/profile/profile.routes") },
			{ path: "play-area", canActivate: [NotLawyerGuard], loadChildren: () => import("app/modules/play-area/play-area.routes") },
			{ path: "settings", canActivate: [NotLawyerGuard], loadChildren: () => import("app/modules/pages/settings/settings.routes") },
			{ path: "zelf-legacy", loadChildren: () => import("app/modules/zelf-legacy/zelf-legacy.routes") },
		],
	},

	// Unknown URLs: go to the default page (auth guard sends signed-out users to /sign-in) instead of a blank screen.
	{ path: "**", redirectTo: "tags" },
];
