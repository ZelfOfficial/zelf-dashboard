/**
 * v4 API endpoint paths, shared by every environment (only `apiUrl` differs per env).
 * Every path here must exist on zelf-online-version@v4 — see scripts/check-endpoints.mjs.
 */
export const endpoints = {
	auth: {
		signUp: "/api/clients",
		signIn: "/api/clients/auth",
		verifyClientExists: "/api/clients",
	},
	security: {
		changePassword: "/api/clients/sync/password",
		loadApiKey: "/api/clients/auth",
	},
	client: {
		update: "/api/clients/sync",
	},
	subscriptionPlans: {
		list: "/api/subscription-plans",
		getById: "/api/subscription-plans",
		subscribe: "/api/subscription-plans/subscribe",
		mySubscription: "/api/subscription-plans/my-subscription",
		createPortalSession: "/api/subscription-plans/create-portal-session",
		cancelSubscription: "/api/subscription-plans/cancel-subscription",
		upgradeSubscription: "/api/subscription-plans/upgrade-subscription",
		reconcileZns: "/api/subscription-plans/reconcile-zns",
	},
	humanAuthn: {
		onboardingProgress: "/api/human-authn/onboarding-progress",
	},
};
