import { endpoints } from "./endpoints";

export const environment = {
	production: false,
	includeNonPaidDomains: true,
	apiUrl: "http://localhost:3050",
	appName: "Zelf Dashboard",
	version: "1.0.0",
	debug: true,
	// Root redirect behavior for hosting variations
	rootRedirect: {
		enabled: true,
		host: "payment.zelf.world", // When window.location.host matches this, redirect root to `path`
		path: "/portfolio/payment",
		fallbackPath: "/tags",
	},
	// Development specific settings
	enableLogging: true,
	enableMockData: true,
	// Force TypeScript refresh
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
			confidence: 0.6,
		},
	},
};
