export const environment = {
	production: true,
	includeNonPaidDomains: false,
	apiUrl: "https://v4.zelf.world",
	appName: "Zelf Dashboard",
	version: "1.0.0",
	debug: false,
	// Root redirect behavior for hosting variations
	rootRedirect: {
		enabled: true,
		host: "payment.zelf.world",
		path: "/portfolio/payment",
		fallbackPath: "/analytics",
	},
	// Production specific settings
	enableLogging: false,
	enableMockData: false,
	// API endpoints
	endpoints: {
		auth: {
			signUp: "/api/clients",
			signIn: "/api/clients/auth",
			verifyClientExists: "/api/clients",
			unlockSession: "/auth/unlock-session",
			signOut: "/auth/sign-out",
			signInWithToken: "/auth/sign-in-with-token",
		},
		user: {
			profile: "/user/profile",
			settings: "/user/settings",
		},
		biometric: {
			verify: "/biometric/verify",
			enroll: "/biometric/enroll",
		},
		license: {
			create: "/api/license",
			search: "/api/license",
			delete: "/api/license",
			myLicense: "/api/license/my-license",
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
	},
	// Feature flags
	features: {
		biometricVerification: true,
		analytics: true,
		notifications: true,
		darkMode: true,
	},
	// External services
	services: {
		faceApi: {
			modelsPath: "/assets/models",
			confidence: 0.7,
		},
	},
};
