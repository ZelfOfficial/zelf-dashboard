/* eslint-disable */
import { FuseNavigationItem } from "@fuse/components/navigation";

// Sidebar (Miguel): exactly Zelf IDs, Zelf Keys, Play Area, Zelf Legacy, Settings.
export const defaultNavigation: FuseNavigationItem[] = [
	{
		id: "tags",
		title: "Zelf IDs",
		type: "basic",
		icon: "heroicons_outline:tag",
		link: "/tags",
	},
	{
		id: "zelfkeys",
		title: "Zelf Keys",
		type: "basic",
		icon: "heroicons_outline:key",
		link: "/zelfkeys",
	},
	{
		id: "play-area",
		title: "Play Area",
		type: "collapsable",
		icon: "heroicons_outline:beaker",
		children: [
			{
				id: "play-area.human-authn.create",
				title: "Create with HumanAuthn",
				subtitle: "Encrypt credential · ZNS 402 flow",
				type: "basic",
				icon: "heroicons_outline:shield-check",
				link: "/play-area/human-authn/create",
			},
			{
				id: "play-area.human-authn.encrypt-qr",
				title: "Create with HumanAuthn [QR]",
				subtitle: "PNG QR + optional proof extract",
				type: "basic",
				icon: "heroicons_outline:qr-code",
				link: "/play-area/human-authn/encrypt-qr",
			},
			{
				id: "play-area.human-authn.preview",
				title: "Preview with HumanAuthn",
				subtitle: "Inspect proof without decrypting",
				type: "basic",
				icon: "heroicons_outline:eye",
				link: "/play-area/human-authn/preview",
			},
			{
				id: "play-area.human-authn.decrypt",
				title: "Decrypt with HumanAuthn",
				subtitle: "Selfie + proof → cleartext",
				type: "basic",
				icon: "heroicons_outline:lock-open",
				link: "/play-area/human-authn/decrypt",
			},
		],
	},
	{
		id: "zelf-legacy",
		title: "Zelf Legacy",
		type: "collapsable",
		icon: "heroicons_outline:scale",
		children: [
			{
				id: "zelf-legacy.lawyers",
				title: "Lawyers",
				type: "basic",
				icon: "heroicons_outline:user-group",
				link: "/zelf-legacy/lawyers",
			},
		],
	},
	{
		id: "settings",
		title: "Settings",
		type: "basic",
		icon: "heroicons_outline:cog",
		link: "/settings",
	},
];

export const portfolioNavigation: FuseNavigationItem[] = [
	{
		id: "payment",
		title: "Payment",
		type: "basic",
		icon: "heroicons_outline:credit-card",
		link: "/portfolio/payment",
	},
];

export const horizontalNavigation: FuseNavigationItem[] = [
	{
		id: "tags",
		title: "Zelf IDs",
		type: "basic",
		icon: "heroicons_outline:tag",
		link: "/tags",
	},
	{
		id: "zelfkeys",
		title: "Zelf Keys",
		type: "basic",
		icon: "heroicons_outline:key",
		link: "/zelfkeys",
	},
	{
		id: "play-area",
		title: "Play Area",
		type: "collapsable",
		icon: "heroicons_outline:beaker",
		children: [
			{
				id: "play-area.human-authn.create",
				title: "Create with HumanAuthn",
				subtitle: "Encrypt credential · ZNS 402 flow",
				type: "basic",
				icon: "heroicons_outline:shield-check",
				link: "/play-area/human-authn/create",
			},
			{
				id: "play-area.human-authn.encrypt-qr",
				title: "Create with HumanAuthn [QR]",
				subtitle: "PNG QR + optional proof extract",
				type: "basic",
				icon: "heroicons_outline:qr-code",
				link: "/play-area/human-authn/encrypt-qr",
			},
			{
				id: "play-area.human-authn.preview",
				title: "Preview with HumanAuthn",
				subtitle: "Inspect proof without decrypting",
				type: "basic",
				icon: "heroicons_outline:eye",
				link: "/play-area/human-authn/preview",
			},
			{
				id: "play-area.human-authn.decrypt",
				title: "Decrypt with HumanAuthn",
				subtitle: "Selfie + proof → cleartext",
				type: "basic",
				icon: "heroicons_outline:lock-open",
				link: "/play-area/human-authn/decrypt",
			},
		],
	},
	{
		id: "zelf-legacy",
		title: "Zelf Legacy",
		type: "collapsable",
		icon: "heroicons_outline:scale",
		children: [
			{
				id: "zelf-legacy.lawyers",
				title: "Lawyers",
				type: "basic",
				icon: "heroicons_outline:user-group",
				link: "/zelf-legacy/lawyers",
			},
		],
	},
	{
		id: "settings",
		title: "Settings",
		type: "basic",
		icon: "heroicons_outline:cog",
		link: "/settings",
	},
];

export const horizontalPortfolioNavigation: FuseNavigationItem[] = [
	{
		id: "payment",
		title: "Payment",
		type: "basic",
		icon: "heroicons_outline:credit-card",
		link: "/portfolio/payment",
	},
];
