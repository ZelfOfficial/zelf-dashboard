import { endpoints } from "./endpoints";

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
	// API endpoints (shared, see ./endpoints.ts)
	endpoints,
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
