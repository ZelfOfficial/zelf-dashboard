import { getLicensePrice, PlanPricing } from "app/core/pricing/license-pricing.utils";
/**
 * License Class
 *
 * This class represents a license configuration for a domain with all its properties
 * and methods. It's designed to work with the frontend license management system
 * and matches the structure used in the backend Domain class.
 */

export interface LicenseData {
	domain: string;
	domainConfig: DomainConfig;
	faceBase64?: string;
	masterPassword?: string;
	ipfsHash?: string;
	createdAt?: string;
	updatedAt?: string;
	// New fields from API response
	ipfs?: IPFSData;
	zelfProof?: string;
	expiresAt?: string;
	subscriptionId?: string;
	previousDomain?: string;
	type?: "official" | "custom" | "zelfBasic" | "zelfStartUp" | "zelfGold" | "zelfBusiness" | "zelfEnterprise";
}

export interface IPFSData {
	url: string;
	IpfsHash: string;
	PinSize: number;
	Timestamp: string;
	ID: string;
	Name: string;
	NumberOfFiles: number;
	MimeType: boolean | string;
	GroupId: string | null;
	pinned: boolean;
	web3: boolean;
	name: string;
	metadata: {
		type: string;
		owner: string;
		domain: string;
		zelfProof: string;
		subscriptionId: string;
	};
}

export interface DomainConfig {
	name: string;
	type?: "official" | "custom" | "zelfBasic" | "zelfStartUp" | "zelfGold" | "zelfBusiness" | "zelfEnterprise"; // Optional - only set during license purchasing
	holdSuffix: string;
	status: "active" | "inactive" | "maintenance" | "beta";
	owner: string;
	description: string;
	startDate?: string;
	endDate?: string;
	updatedAt?: string;
	ipfsCid?: string;
	tags: {
		minLength: number;
		maxLength: number;
		allowedChars: RegExp;
		reserved: string[];
		customRules: any[];
		payment: {
			methods: string[];
			networks: { [key: string]: NetworkConfig };
			discounts?: { [key: string]: number };
			rewardPrice?: number;
			whitelist: { [key: string]: string };
			/** Legacy v3 table. Kept only so existing licenses round-trip; never used for pricing. */
			pricingTable?: { [key: string]: { [key: string]: number } };
			/** v4 source of truth: { [plan]: { [lengthGroup]: { [duration]: price } } } */
			planPricing?: { [plan: string]: { [lengthGroup: string]: { [duration: string]: number } } };
		};
		storage: {
			// Moved storage inside tags
			keyPrefix: string;
			ipfsEnabled: boolean;
			arweaveEnabled: boolean;
			walrusEnabled: boolean;
			backupEnabled?: boolean;
		};
		wallet: {
			networks: { [key: string]: { enabled: boolean } };
		};
	};
	zelfkeys: {
		plans: any[];
		payment: {
			whitelist: { [key: string]: string };
			pricingTable: { [key: string]: { [key: string]: number } };
		};
		storage: {
			// Moved storage inside zelfkeys
			keyPrefix: string;
			ipfsEnabled: boolean;
			arweaveEnabled: boolean;
			walrusEnabled: boolean;
			backupEnabled?: boolean;
		};
	};
	stripe?: {
		productId: string;
		priceId: string;
		latestInvoiceId: string;
		amountPaid: number;
		paidAt: string;
	};
	limits?: {
		tags: number;
		zelfkeys: number;
		zelfProofs?: number;
	};
	metadata: {
		launchDate: string;
		version: string;
		documentation: string;
		community?: string;
		enterprise?: string;
		support: string;
		logo?: string;
	};
	themeSettings?: ThemeSettings;
}

export interface ThemeSettings {
	zns: {
		enabled: boolean;
		currentMode: "light" | "dark";
		lightMode: {
			colors: {
				primary: string;
				secondary: string;
				background: string;
				backgroundSecondary: string;
				text: string;
				textSecondary: string;
				textMuted: string;
				header: string;
				headerText: string;
				button: string;
				buttonText: string;
				buttonHover: string;
				buttonSecondary: string;
				buttonSecondaryText: string;
				border: string;
				borderHover: string;
				success: string;
				successText: string;
				warning: string;
				warningText: string;
				error: string;
				errorText: string;
				card: string;
				cardBorder: string;
				shadow: string;
			};
		};
		darkMode: {
			colors: {
				primary: string;
				secondary: string;
				background: string;
				backgroundSecondary: string;
				text: string;
				textSecondary: string;
				textMuted: string;
				header: string;
				headerText: string;
				button: string;
				buttonText: string;
				buttonHover: string;
				buttonSecondary: string;
				buttonSecondaryText: string;
				border: string;
				borderHover: string;
				success: string;
				successText: string;
				warning: string;
				warningText: string;
				error: string;
				errorText: string;
				card: string;
				cardBorder: string;
				shadow: string;
			};
		};
	};
}

export interface Feature {
	name: string;
	code: string;
	description: string;
	enabled: boolean;
}

export interface ValidationRules {
	minLength: number;
	maxLength: number;
	allowedChars: RegExp;
	reserved: string[];
	customRules: any[];
}

export interface StorageConfig {
	keyPrefix: string;
	ipfsEnabled: boolean;
	arweaveEnabled: boolean;
	walrusEnabled: boolean;
}

export interface NetworkConfig {
	enabled: boolean;
	nativeCurrency: {
		enabled: boolean;
		code: string;
	};
	altCoins: {
		enabled: boolean;
		standard: string | null;
	};
}

export interface PaymentSettings {
	methods: string[];
	networks: { [key: string]: NetworkConfig };
	whitelist: { [key: string]: string };
	pricingTable: { [key: string]: { [key: string]: number } };
	planPricing?: {
		premium?: { [key: string]: { [key: string]: number } };
		unlimited?: { [key: string]: { [key: string]: number } };
	};
}

export interface Metadata {
	launchDate: string;
	version: string;
	documentation: string;
	community?: string;
	enterprise?: string;
	support: string;
}

export class License {
	public domain: string;
	public domainConfig: DomainConfig;
	public faceBase64?: string;
	public masterPassword?: string;
	public ipfsHash?: string;
	public createdAt?: string;
	public updatedAt?: string;
	// New fields from API response
	public ipfs?: IPFSData;
	public zelfProof?: string;
	public expiresAt?: string;
	public subscriptionId?: string;
	public previousDomain?: string;
	public type?: "official" | "custom" | "zelfBasic" | "zelfStartUp" | "zelfGold" | "zelfBusiness" | "zelfEnterprise";

	constructor(licenseData: LicenseData) {
		this.domain = licenseData.domain || "";
		this.domainConfig = this.buildDomainConfig(licenseData.domainConfig);
		this.faceBase64 = licenseData.faceBase64;
		this.masterPassword = licenseData.masterPassword;
		this.ipfsHash = licenseData.ipfsHash;
		this.createdAt = licenseData.createdAt;
		this.updatedAt = licenseData.updatedAt;
		// New fields
		this.ipfs = licenseData.ipfs;
		this.zelfProof = licenseData.zelfProof;
		this.expiresAt = licenseData.expiresAt;
		this.subscriptionId = licenseData.subscriptionId;
		this.previousDomain = licenseData.previousDomain;
		this.type = licenseData.type;
	}

	/**
	 * Build domain configuration with defaults
	 * Handles both nested domainConfig structure and flat API response structure
	 */
	private buildDomainConfig(config: any): DomainConfig {
		// Handle both nested domainConfig and flat structure from API response
		const configData = config?.domainConfig || config;

		return {
			name: configData?.name || "",
			type: configData?.type || "custom",
			holdSuffix: configData?.holdSuffix || ".hold",
			status: configData?.status || "inactive",
			owner: configData?.owner || "",
			description: configData?.description || "",
			startDate: configData?.startDate || "",
			endDate: configData?.endDate || "",
			updatedAt: configData?.updatedAt || "",
			ipfsCid: configData?.ipfsCid || "",
			tags: this.buildTagsConfig(configData),
			zelfkeys: {
				plans: configData?.zelfkeys?.plans || [],
				payment: {
					whitelist: configData?.zelfkeys?.payment?.whitelist || {},
					pricingTable: configData?.zelfkeys?.payment?.pricingTable || {},
				},
				storage: {
					// Moved storage inside zelfkeys
					keyPrefix: configData?.zelfkeys?.storage?.keyPrefix || "tagName",
					ipfsEnabled: configData?.zelfkeys?.storage?.ipfsEnabled ?? true,
					arweaveEnabled: configData?.zelfkeys?.storage?.arweaveEnabled ?? true,
					walrusEnabled: configData?.zelfkeys?.storage?.walrusEnabled ?? true,
					backupEnabled: configData?.zelfkeys?.storage?.backupEnabled || false,
				},
			},
			stripe: {
				productId: configData?.stripe?.productId || "",
				priceId: configData?.stripe?.priceId || "",
				latestInvoiceId: configData?.stripe?.latestInvoiceId || "",
				amountPaid: configData?.stripe?.amountPaid || 0,
				paidAt: configData?.stripe?.paidAt || "",
			},
			limits: {
				tags: configData?.limits?.tags || 100,
				zelfkeys: configData?.limits?.zelfkeys || 100,
				zelfProofs: configData?.limits?.zelfProofs || 100,
			},
			metadata: {
				launchDate: configData?.metadata?.launchDate || new Date().toISOString().split("T")[0],
				version: configData?.metadata?.version || "1.0.0",
				documentation: configData?.metadata?.documentation || "",
				community: configData?.metadata?.community,
				enterprise: configData?.metadata?.enterprise,
				support: configData?.metadata?.support || "standard",
				logo: configData?.metadata?.logo,
			},
			themeSettings: configData?.themeSettings || License.getDefaultThemeSettings(),
		};
	}

	private buildTagsConfig(configData: any): DomainConfig["tags"] {
		return {
			minLength: configData?.tags?.minLength || 3,
			maxLength: configData?.tags?.maxLength || 50,
			allowedChars: configData?.tags?.allowedChars || /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/,
			reserved: configData?.tags?.reserved || ["www", "api", "admin", "support", "help"],
			customRules: configData?.tags?.customRules || [],
			payment: this.buildTagsPaymentConfig(configData),
			storage: {
				keyPrefix: configData?.tags?.storage?.keyPrefix || "tagName",
				ipfsEnabled: configData?.tags?.storage?.ipfsEnabled ?? true,
				arweaveEnabled: configData?.tags?.storage?.arweaveEnabled ?? true,
				walrusEnabled: configData?.tags?.storage?.walrusEnabled ?? true,
				backupEnabled: configData?.tags?.storage?.backupEnabled || false,
			},
			wallet: {
				networks: this.getSimplifiedNetworks(
					configData?.tags?.wallet?.networks || configData?.wallet?.networks || this.getDefaultNetworks(),
				),
			},
		};
	}

	private buildTagsPaymentConfig(configData: any): DomainConfig["tags"]["payment"] {
		const payment = configData?.tags?.payment;
		let networks: { [key: string]: any };

		if (payment?.networks) {
			networks = { ...payment.networks };
		} else if (Array.isArray(payment?.currencies)) {
			networks = this.migrateCurrenciesToNetworks(payment.currencies);
		} else {
			networks = this.getDefaultNetworks();
		}

		return {
			methods: payment?.methods?.filter((method: string) => ["crypto", "stripe"].includes(method)) || ["crypto", "stripe"],
			networks: this.normalizePaymentNetworks(networks),
			// Values come only from the license; no client-side defaults.
			discounts: payment?.discounts,
			rewardPrice: payment?.rewardPrice,
			whitelist: payment?.whitelist || {},
			pricingTable: payment?.pricingTable || {},
			planPricing: payment?.planPricing || {},
		};
	}

	/**
	 * Get simplified networks object (only enabled flag)
	 */
	private getSimplifiedNetworks(networks: { [key: string]: any }): { [key: string]: { enabled: boolean } } {
		const simplified: { [key: string]: { enabled: boolean } } = {};
		Object.keys(networks).forEach((key) => {
			simplified[key] = { enabled: !!networks[key].enabled };
		});
		return simplified;
	}

	/**
	 * Align persisted payment.networks with backend tag-pay gates (`bsc`, Polygon native `POL`).
	 * Migrates legacy `binance` → `bsc` and `MATIC` → `POL` on load.
	 */
	private normalizePaymentNetworks(networks: { [key: string]: any }): { [key: string]: any } {
		if (!networks || typeof networks !== "object") {
			return networks;
		}
		const out: { [key: string]: any } = { ...networks };
		if (out["binance"] && !out["bsc"]) {
			out["bsc"] = out["binance"];
			delete out["binance"];
		}
		if (out["polygon"]?.nativeCurrency?.code === "MATIC") {
			out["polygon"] = {
				...out["polygon"],
				nativeCurrency: {
					...out["polygon"].nativeCurrency,
					code: "POL",
				},
			};
		}
		return out;
	}

	/**
	 * Get default networks configuration
	 */
	private getDefaultNetworks(): { [key: string]: NetworkConfig } {
		return {
			ethereum: {
				enabled: true,
				nativeCurrency: { enabled: true, code: "ETH" },
				altCoins: { enabled: true, standard: "ERC-20" },
			},
			solana: {
				enabled: true,
				nativeCurrency: { enabled: true, code: "SOL" },
				altCoins: { enabled: true, standard: "SPL" },
			},
			bitcoin: {
				enabled: true,
				nativeCurrency: { enabled: true, code: "BTC" },
				altCoins: { enabled: false, standard: null },
			},
			blockdag: {
				enabled: true,
				nativeCurrency: { enabled: true, code: "BDAG" },
				altCoins: { enabled: false, standard: null },
			},
			avalanche: {
				enabled: true,
				nativeCurrency: { enabled: true, code: "AVAX" },
				altCoins: { enabled: true, standard: "ERC-20" },
			},
			bsc: {
				enabled: true,
				nativeCurrency: { enabled: true, code: "BNB" },
				altCoins: { enabled: true, standard: "BEP-20" },
			},
			polygon: {
				enabled: true,
				nativeCurrency: { enabled: true, code: "POL" },
				altCoins: { enabled: true, standard: "ERC-20" },
			},
			sui: {
				enabled: true,
				nativeCurrency: { enabled: true, code: "SUI" },
				altCoins: { enabled: false, standard: null },
			},
		};
	}

	/**
	 * Migrate flat currencies array to networks configuration
	 */
	private migrateCurrenciesToNetworks(currencies: string[]): { [key: string]: NetworkConfig } {
		const networks = this.getDefaultNetworks();

		// Reset all to disabled first
		Object.keys(networks).forEach((key) => {
			networks[key].enabled = false;
			networks[key].nativeCurrency.enabled = false;
			if (networks[key].altCoins) networks[key].altCoins.enabled = false;
		});

		if (!currencies || currencies.length === 0) return networks;

		currencies.forEach((currency) => {
			const code = currency.toUpperCase();
			if (code === "ETH") {
				networks["ethereum"].enabled = true;
				networks["ethereum"].nativeCurrency.enabled = true;
			} else if (code === "SOL") {
				networks["solana"].enabled = true;
				networks["solana"].nativeCurrency.enabled = true;
			} else if (code === "BTC") {
				networks["bitcoin"].enabled = true;
				networks["bitcoin"].nativeCurrency.enabled = true;
			} else if (code === "BDAG") {
				networks["blockdag"].enabled = true;
				networks["blockdag"].nativeCurrency.enabled = true;
			} else if (code === "AVAX") {
				networks["avalanche"].enabled = true;
				networks["avalanche"].nativeCurrency.enabled = true;
			} else if (code === "SUI") {
				networks["sui"].enabled = true;
				networks["sui"].nativeCurrency.enabled = true;
			} else if (code === "USDC" || code === "USDT") {
				// Enable alt coins for compatible networks if the network is already enabled or if we should just enable it
				// Here assuming if they had USDC/USDT, they probably want it on all capable networks that are active?
				// Or just enable alt coins on all capable networks?
				// Let's enable alt coins on Ethereum, Solana, Avalanche
				["ethereum", "solana", "avalanche"].forEach((net) => {
					networks[net].enabled = true; // Enable network if it has alt coins
					networks[net].altCoins.enabled = true;
				});
			}
		});

		return networks;
	}

	/**
	 * Get IPFS data
	 */
	getIPFSData(): IPFSData | undefined {
		return this.ipfs;
	}

	/**
	 * Get IPFS hash
	 */
	getIPFSHash(): string | undefined {
		return this.ipfs?.IpfsHash || this.ipfsHash;
	}

	/**
	 * Get IPFS URL
	 */
	getIPFSUrl(): string | undefined {
		return this.ipfs?.url;
	}

	/**
	 * Get IPFS metadata
	 */
	getIPFSMetadata(): { type: string; owner: string; domain: string; zelfProof: string; subscriptionId: string } | undefined {
		return this.ipfs?.metadata;
	}

	/**
	 * Get zelfProof
	 */
	getZelfProof(): string | undefined {
		return this.zelfProof;
	}

	/**
	 * Get expiration date
	 */
	getExpirationDate(): Date | undefined {
		return this.expiresAt ? new Date(this.expiresAt) : undefined;
	}

	/**
	 * Check if license is expired
	 */
	isExpired(): boolean {
		if (!this.expiresAt) return false;
		return new Date(this.expiresAt) < new Date();
	}

	/**
	 * Get subscription ID
	 */
	getSubscriptionId(): string | undefined {
		return this.subscriptionId;
	}

	/**
	 * Get previous domain (for domain changes)
	 */
	getPreviousDomain(): string | undefined {
		return this.previousDomain;
	}

	/**
	 * Get license type
	 */
	getLicenseType(): "official" | "custom" | "zelfBasic" | "zelfStartUp" | "zelfGold" | "zelfBusiness" | "zelfEnterprise" | undefined {
		return this.type || this.domainConfig.type;
	}

	/**
	 * Check if license is active
	 */
	isActive(): boolean {
		return this.domainConfig.status === "active";
	}

	/**
	 * Check if domain supports a feature
	 */
	supportsFeature(featureCode: string): boolean {
		// For now, we'll assume all features are enabled by default
		// This can be extended later if we add feature management
		return true;
	}

	/**
	 * Get the price for a name from the license `planPricing` only.
	 *
	 * Returns `price: null` when the license does not offer that plan / length / duration.
	 * There is no fallback table and no default price: the API (v4 /api/zelf-ids) is the
	 * source of truth for checkout; this is only used for previews in the editor.
	 */
	getPrice(
		tagName: string,
		duration: string = "1",
		referralTagName: string = "",
		options: { plan?: string } = {},
	): {
		price: number | null;
		currency: string;
		reward: number | null;
		discount: number;
		priceWithoutDiscount: number | null;
		discountType: string;
	} {
		const notOffered = {
			price: null,
			currency: "USD",
			reward: null,
			discount: 0,
			priceWithoutDiscount: null,
			discountType: "percentage",
		};

		if (!tagName || !options?.plan) return notOffered;

		const length = tagName.split(".")[0].length;
		const planPricing = this.domainConfig?.tags?.payment?.planPricing as PlanPricing | undefined;
		const basePrice = getLicensePrice(planPricing, options.plan, length, String(duration));

		if (basePrice === null) return notOffered;

		let price = basePrice;
		let discount = 0;
		let discountType = "percentage";

		const cleanReferralTagName = referralTagName.replace(".hold", "");
		const whitelist = this.domainConfig.tags.payment.whitelist || {};

		// Only discounts explicitly configured in the license whitelist are applied.
		if (cleanReferralTagName && whitelist[cleanReferralTagName]) {
			const amount = String(whitelist[cleanReferralTagName]);

			if (amount.includes("%")) {
				discount = parseFloat(amount);
				price = price - price * (discount / 100);
			} else {
				discount = parseFloat(amount);
				discountType = "amount";
				price = price - discount;
			}
		}

		const rewardPrice = Number(this.domainConfig.tags.payment.rewardPrice);

		return {
			price: Math.max(Math.ceil(price * 100) / 100, 0),
			currency: "USD",
			reward: rewardPrice > 0 ? Math.max(Math.ceil((price / rewardPrice) * 100) / 100, 0) : null,
			discount,
			priceWithoutDiscount: basePrice,
			discountType,
		};
	}

	/**
	 * Validate tag name against domain rules
	 */
	validateTagName(tagName: string): { valid: boolean; error?: string } {
		// Check minimum length
		if (tagName.length < this.domainConfig.tags.minLength) {
			return {
				valid: false,
				error: `Tag name must be at least ${this.domainConfig.tags.minLength} characters long`,
			};
		}

		// Check maximum length
		if (tagName.length > this.domainConfig.tags.maxLength) {
			return {
				valid: false,
				error: `Tag name must be no more than ${this.domainConfig.tags.maxLength} characters long`,
			};
		}

		// Check allowed characters
		if (!this.domainConfig.tags.allowedChars.test(tagName)) {
			return {
				valid: false,
				error: `Tag name contains invalid characters. Allowed pattern: ${this.domainConfig.tags.allowedChars}`,
			};
		}

		// Check reserved names
		if (this.domainConfig.tags.reserved.includes(tagName.toLowerCase())) {
			return {
				valid: false,
				error: `Tag name '${tagName}' is reserved`,
			};
		}

		// Check custom rules
		for (const rule of this.domainConfig.tags.customRules) {
			if (typeof rule === "function") {
				const result = rule(tagName);
				if (!result.valid) {
					return result;
				}
			}
		}

		return { valid: true };
	}

	/**
	 * Get storage configuration for tags
	 */
	getStorageConfig(): StorageConfig {
		return this.domainConfig.tags.storage;
	}

	/**
	 * Get storage configuration for zelfkeys
	 */
	getZelfkeysStorageConfig(): StorageConfig {
		return this.domainConfig.zelfkeys.storage;
	}

	/**
	 * Get payment methods
	 */
	getPaymentMethods(): string[] {
		return this.domainConfig.tags.payment.methods;
	}

	/**
	 * Get supported networks
	 */
	getNetworks(): { [key: string]: NetworkConfig } {
		return this.domainConfig.tags.payment.networks;
	}

	/**
	 * Get domain limits
	 */
	getLimits(): { tags: number; zelfkeys: number } {
		return this.domainConfig.limits;
	}

	/**
	 * Generate hold domain name
	 */
	generateHoldDomain(tagName: string): string {
		return `${tagName}${this.domainConfig.holdSuffix}.${this.domain}`;
	}

	/**
	 * Convert to JSON for API calls
	 */
	toJSON(): LicenseData {
		return {
			domain: this.domain,
			domainConfig: this.domainConfig,
			faceBase64: this.faceBase64,
			masterPassword: this.masterPassword,
			ipfsHash: this.ipfsHash,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
			// New fields
			ipfs: this.ipfs,
			zelfProof: this.zelfProof,
			expiresAt: this.expiresAt,
			subscriptionId: this.subscriptionId,
			previousDomain: this.previousDomain,
			type: this.type,
		};
	}

	/**
	 * Create from JSON data
	 */
	static fromJSON(data: any): License {
		return new License(data);
	}

	/**
	 * Create from API response data
	 * Handles the flat structure returned by the API
	 */
	static fromAPIResponse(data: any): License {
		// Transform API response to LicenseData format
		const licenseData: LicenseData = {
			domain: data.domain,
			domainConfig: {
				name: data.name,
				// Note: type is excluded as it's only set during license purchasing
				holdSuffix: data.holdSuffix,
				status: data.status,
				owner: data.owner,
				description: data.description,
				startDate: data.startDate,
				endDate: data.endDate,
				updatedAt: data.updatedAt,
				ipfsCid: data.ipfsCid,
				tags: data.tags,
				zelfkeys: data.zelfkeys,
				stripe: data.stripe,
				limits: data.limits,
				metadata: data.metadata,
			},
			ipfs: data.ipfs,
			zelfProof: data.zelfProof,
			expiresAt: data.expiresAt,
			subscriptionId: data.subscriptionId,
			previousDomain: data.previousDomain,
			type: data.type,
		};

		return new License(licenseData);
	}

	/**
	 * Create from API response with data wrapper
	 * Handles responses like { data: { ... } }
	 */
	static isRemoteLicenseStale(localConfig?: DomainConfig | null, remoteConfig?: DomainConfig | null): boolean {
		if (!localConfig) return false;
		if (!remoteConfig) return true;

		const localPlans = localConfig.tags?.payment?.planPricing;
		const remotePlans = remoteConfig.tags?.payment?.planPricing;
		const localHasPlans = Boolean(localPlans && Object.keys(localPlans).length > 0);
		const remoteHasPlans = Boolean(remotePlans && Object.keys(remotePlans).length > 0);
		if (localHasPlans && !remoteHasPlans) return true;

		const localTs = Date.parse(String(localConfig.updatedAt || "")) || 0;
		const remoteTs = Date.parse(String(remoteConfig.updatedAt || "")) || 0;
		return localTs > remoteTs;
	}

	static fromAPIResponseWithWrapper(response: any): License {
		// Extract data from wrapper if it exists
		const data = response.data || response;
		return License.fromAPIResponse(data);
	}

	/**
	 * Create empty license with defaults
	 */
	static createEmpty(domain: string): License {
		return new License({
			domain,
			domainConfig: {
				name: domain,
				// Note: type is excluded as it's only set during license purchasing
				holdSuffix: ".hold",
				status: "inactive",
				owner: "zelf-team",
				description: `Custom domain: ${domain}`,
				startDate: "",
				endDate: "",
				tags: {
					minLength: 3,
					maxLength: 50,
					allowedChars: /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/,
					reserved: ["www", "api", "admin", "support", "help"],
					customRules: [],
					payment: {
						methods: ["crypto", "stripe"],
						networks: {
							ethereum: {
								enabled: true,
								nativeCurrency: { enabled: true, code: "ETH" },
								altCoins: { enabled: true, standard: "ERC-20" },
							},
							solana: {
								enabled: true,
								nativeCurrency: { enabled: true, code: "SOL" },
								altCoins: { enabled: true, standard: "SPL" },
							},
							bitcoin: {
								enabled: true,
								nativeCurrency: { enabled: true, code: "BTC" },
								altCoins: { enabled: false, standard: null },
							},
							blockdag: {
								enabled: true,
								nativeCurrency: { enabled: true, code: "BDAG" },
								altCoins: { enabled: false, standard: null },
							},
							avalanche: {
								enabled: true,
								nativeCurrency: { enabled: true, code: "AVAX" },
								altCoins: { enabled: true, standard: "ERC-20" },
							},
							bsc: {
								enabled: true,
								nativeCurrency: { enabled: true, code: "BNB" },
								altCoins: { enabled: true, standard: "BEP-20" },
							},
							polygon: {
								enabled: true,
								nativeCurrency: { enabled: true, code: "POL" },
								altCoins: { enabled: true, standard: "ERC-20" },
							},
							sui: {
								enabled: true,
								nativeCurrency: { enabled: true, code: "SUI" },
								altCoins: { enabled: false, standard: null },
							},
						},
						whitelist: {},
						pricingTable: {},
						planPricing: {},
					},
					storage: {
						// Moved storage inside tags
						keyPrefix: "tagName",
						ipfsEnabled: true,
						arweaveEnabled: true,
						walrusEnabled: true,
						backupEnabled: false,
					},
					wallet: {
						networks: undefined as any,
					},
				},
				zelfkeys: {
					plans: [],
					payment: {
						whitelist: {},
						pricingTable: {},
					},
					storage: {
						// Moved storage inside zelfkeys
						keyPrefix: "tagName",
						ipfsEnabled: true,
						arweaveEnabled: true,
						walrusEnabled: true,
						backupEnabled: false,
					},
				},
				stripe: {
					productId: "",
					priceId: "",
					latestInvoiceId: "",
					amountPaid: 0,
					paidAt: "",
				},
				limits: { tags: 100, zelfkeys: 100, zelfProofs: 100 },
				metadata: {
					launchDate: new Date().toISOString().split("T")[0],
					version: "1.0.0",
					documentation: "",
					support: "standard",
				},
				themeSettings: License.getDefaultThemeSettings(),
			},
		});
	}

	/**
	 * Get default theme settings
	 */
	private static getDefaultThemeSettings(): ThemeSettings {
		return {
			zns: {
				enabled: true,
				currentMode: "light",
				lightMode: {
					colors: {
						primary: "#3B82F6",
						secondary: "#64748B",
						background: "#FFFFFF",
						backgroundSecondary: "#F8FAFC",
						text: "#1E293B",
						textSecondary: "#64748B",
						textMuted: "#94A3B8",
						header: "#1E293B",
						headerText: "#FFFFFF",
						button: "#3B82F6",
						buttonText: "#FFFFFF",
						buttonHover: "#2563EB",
						buttonSecondary: "#E2E8F0",
						buttonSecondaryText: "#475569",
						border: "#E2E8F0",
						borderHover: "#CBD5E1",
						success: "#10B981",
						successText: "#FFFFFF",
						warning: "#F59E0B",
						warningText: "#FFFFFF",
						error: "#EF4444",
						errorText: "#FFFFFF",
						card: "#FFFFFF",
						cardBorder: "#E2E8F0",
						shadow: "rgba(0, 0, 0, 0.1)",
					},
				},
				darkMode: {
					colors: {
						primary: "#60A5FA",
						secondary: "#94A3B8",
						background: "#0F172A",
						backgroundSecondary: "#1E293B",
						text: "#F1F5F9",
						textSecondary: "#94A3B8",
						textMuted: "#64748B",
						header: "#1E293B",
						headerText: "#F1F5F9",
						button: "#60A5FA",
						buttonText: "#0F172A",
						buttonHover: "#3B82F6",
						buttonSecondary: "#334155",
						buttonSecondaryText: "#F1F5F9",
						border: "#334155",
						borderHover: "#475569",
						success: "#34D399",
						successText: "#0F172A",
						warning: "#FBBF24",
						warningText: "#0F172A",
						error: "#F87171",
						errorText: "#0F172A",
						card: "#1E293B",
						cardBorder: "#334155",
						shadow: "rgba(0, 0, 0, 0.3)",
					},
				},
			},
		};
	}
}
