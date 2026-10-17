const path = require("path");
const colors = require("tailwindcss/colors");
const defaultTheme = require("tailwindcss/defaultTheme");
const generatePalette = require(path.resolve(__dirname, "src/@fuse/tailwind/utils/generate-palette"));

/**
 * Custom palettes
 *
 * Uses the generatePalette helper method to generate
 * Tailwind-like color palettes automatically
 */
const customPalettes = {
	brand: generatePalette("#2196F3"),
};

/**
 * Wise design system palettes (see wise-style reference in the PR).
 * Forest Ink #163300 is the brand dark, Lime Voltage #9fe870 the accent,
 * neutrals are the green-tinted Fog/Pebble/Slate/Charcoal/Obsidian ramp.
 * The dark end of the neutral ramp is forest-black so legacy dark:bg-gray-8xx/9xx
 * utilities land on Forest Ink surfaces in dark mode.
 */
const wise = {
	forestInk: "#163300",
	limeVoltage: "#9fe870",
	spruce: "#054d28",
	linenMist: "#e2f6d5",
	signalBlue: "#0b4c72",
	alarmRed: "#cb272f",
	charcoal: "#454745",
	obsidian: "#0e0f0c",
	pebble: "#868685",
	slate: "#6a6c6a",
	fog: "#e8ebe6",
	paper: "#ffffff",
};
const wiseNeutral = {
	50: "#f7f8f6",
	100: "#f1f3ef",
	200: "#e8ebe6", // Fog
	300: "#d4d9d0",
	400: "#a3a6a1",
	500: "#868685", // Pebble
	600: "#6a6c6a", // Slate
	700: "#454745", // Charcoal
	800: "#163300", // Forest Ink (primary copy on light surfaces)
	900: "#0e0f0c", // Obsidian (display headlines)
	950: "#0e0f0c", // Obsidian
};
const wiseForest = {
	50: "#f2f9ec",
	100: "#e2f6d5", // Linen Mist
	200: "#c8eeae",
	300: "#9fe870", // Lime Voltage
	400: "#6cbf3c",
	500: "#3d8a1c",
	600: "#2a5e0c",
	700: "#1f4704",
	800: "#163300", // Forest Ink
	900: "#0f2400",
	950: "#081500",
	DEFAULT: wise.forestInk,
};
const wiseLime = {
	50: "#f5fdef",
	100: "#e2f6d5",
	200: "#cdf3b4",
	300: "#b8ee94",
	400: "#9fe870", // Lime Voltage
	500: "#86d655",
	600: "#69b93a",
	700: "#4e9228",
	800: "#3a6e1e",
	900: "#284d15",
	950: "#163300",
	DEFAULT: wise.limeVoltage,
};
const wiseRed = {
	50: "#fdf2f2",
	100: "#fbe1e2",
	200: "#f6c3c5",
	300: "#ee9599",
	400: "#e15d63",
	500: "#d63a41",
	600: "#cb272f", // Alarm Red
	700: "#a81f26",
	800: "#8a1c22",
	900: "#731c21",
	950: "#3f0a0d",
	DEFAULT: wise.alarmRed,
};
const wiseBlue = {
	50: "#eef6fb",
	100: "#d8eaf5",
	200: "#b3d5ea",
	300: "#7fb6d8",
	400: "#4790bf",
	500: "#2172a3",
	600: "#135d89",
	700: "#0b4c72", // Signal Blue
	800: "#0b3f5e",
	900: "#0c344d",
	950: "#072133",
	DEFAULT: wise.signalBlue,
};

/**
 * Themes
 */
const themes = {
	// Default theme is required for theming system to work correctly!
	default: {
		// Wise: Forest Ink carries weight (primary), Lime Voltage punctuates (accent), Alarm Red warns.
		primary: wiseForest,
		accent: wiseLime,
		warn: wiseRed,
		"on-primary": {
			DEFAULT: "#ffffff",
		},
		"on-accent": {
			DEFAULT: wise.forestInk,
			500: wise.forestInk,
		},
		"on-warn": {
			500: "#ffffff",
		},
	},
	// Rest of the themes will use the 'default' as the base
	// theme and will extend it with their given configuration.
	brand: {
		primary: customPalettes.brand,
	},
	teal: {
		primary: {
			...colors.teal,
			DEFAULT: colors.teal[600],
		},
	},
	rose: {
		primary: colors.rose,
	},
	purple: {
		primary: {
			...colors.purple,
			DEFAULT: colors.purple[600],
		},
	},
	amber: {
		primary: colors.amber,
	},
};

/**
 * Tailwind configuration
 */
const config = {
	darkMode: ["selector", ".dark"],
	content: ["./src/**/*.{html,scss,ts}"],
	important: true,
	theme: {
		fontSize: {
			xs: "0.625rem",
			sm: "0.75rem",
			md: "0.8125rem",
			base: "0.875rem",
			lg: "1rem",
			xl: "1.125rem",
			"2xl": "1.25rem",
			"3xl": "1.5rem",
			"4xl": "2rem",
			"5xl": "2.25rem",
			"6xl": "2.5rem",
			"7xl": "3rem",
			"8xl": "4rem",
			"9xl": "6rem",
			"10xl": "8rem",
			// Wise type scale (Inter / Inter 900 as the Wise Sans substitute)
			micro: ["12px", { lineHeight: "1.63", letterSpacing: "-0.036px" }],
			caption: ["14px", { lineHeight: "1.55", letterSpacing: "-0.07px" }],
			"body-sm": ["16px", { lineHeight: "1.5", letterSpacing: "-0.096px" }],
			body: ["18px", { lineHeight: "1.5", letterSpacing: "-0.126px" }],
			"body-lg": ["25px", { lineHeight: "1.3", letterSpacing: "-0.225px" }],
			subheading: ["36px", { lineHeight: "1.25", letterSpacing: "-0.396px" }],
			"heading-sm": ["45px", { lineHeight: "1.1", letterSpacing: "-0.495px" }],
			heading: ["61px", { lineHeight: "1.1", letterSpacing: "-0.915px" }],
			"heading-lg": ["89px", { lineHeight: "0.85", letterSpacing: "-2.67px" }],
			display: ["105px", { lineHeight: "0.85", letterSpacing: "-3.15px" }],
		},
		screens: {
			sm: "600px",
			md: "960px",
			lg: "1280px",
			xl: "1440px",
		},
		extend: {
			animation: {
				"spin-slow": "spin 3s linear infinite",
			},
			colors: {
				// Legacy neutrals all resolve to the Wise green-tinted ramp
				gray: wiseNeutral,
				slate: wiseNeutral,
				zinc: wiseNeutral,
				neutral: wiseNeutral,
				stone: wiseNeutral,
				// Legacy brand-ish hues collapse onto the Wise palette
				blue: wiseBlue,
				sky: wiseBlue,
				indigo: wiseForest,
				violet: wiseForest,
				purple: wiseForest,
				green: wiseForest,
				emerald: wiseForest,
				teal: wiseForest,
				lime: wiseLime,
				red: wiseRed,
				rose: wiseRed,
				// Named Wise tokens
				"forest-ink": wise.forestInk,
				"lime-voltage": wise.limeVoltage,
				spruce: wise.spruce,
				"linen-mist": wise.linenMist,
				"signal-blue": wise.signalBlue,
				"alarm-red": wise.alarmRed,
				charcoal: wise.charcoal,
				obsidian: wise.obsidian,
				pebble: wise.pebble,
				fog: wise.fog,
				paper: wise.paper,
				forest: wiseForest,
			},
			fontWeight: {
				// Wise display headings are weight 900; legacy "extrabold" titles inherit it
				extrabold: "900",
			},
			borderRadius: {
				// Wise: 10px cards/inputs, 28px large cards, pills everywhere else
				md: "8px",
				lg: "10px",
				xl: "10px",
				"2xl": "16px",
				"3xl": "28px",
				// Wise named radii
				"wise-card": "10px",
				"wise-input": "10px",
				"wise-lg": "28px",
				"wise-pill": "9999px",
			},
			boxShadow: {
				// Wise is flat: elevation is a hairline ring; only overlays get real shadow
				sm: "rgba(14, 15, 12, 0.12) 0px 0px 0px 1px",
				DEFAULT: "rgba(14, 15, 12, 0.12) 0px 0px 0px 1px",
				md: "rgba(14, 15, 12, 0.12) 0px 0px 0px 1px",
				lg: "rgba(0, 0, 0, 0.08) 0px 6px 20px 0px",
				xl: "rgba(0, 0, 0, 0.15) 0px 10px 32px 0px, rgba(0, 0, 0, 0.04) 0px 40px 40px 0px",
				"2xl": "rgba(0, 0, 0, 0.15) 0px 10px 32px 0px, rgba(0, 0, 0, 0.04) 0px 40px 40px 0px",
				subtle: "rgba(14, 15, 12, 0.12) 0px 0px 0px 1px",
				"subtle-inset": "rgb(134, 134, 133) 0px 0px 0px 1px inset",
			},
			letterSpacing: {
				display: "-0.03em",
				heading: "-0.015em",
			},
			flex: {
				0: "0 0 auto",
			},
			fontFamily: {
				sans: `"Inter var", "Inter", ${defaultTheme.fontFamily.sans.join(",")}`,
				// Wise Sans substitute: Inter at weight 900, tightly tracked
				display: `"Inter var", "Inter", ${defaultTheme.fontFamily.sans.join(",")}`,
				mono: `"IBM Plex Mono", ${defaultTheme.fontFamily.mono.join(",")}`,
			},
			opacity: {
				12: "0.12",
				38: "0.38",
				87: "0.87",
			},
			rotate: {
				"-270": "270deg",
				15: "15deg",
				30: "30deg",
				60: "60deg",
				270: "270deg",
			},
			scale: {
				"-1": "-1",
			},
			zIndex: {
				"-1": -1,
				49: 49,
				60: 60,
				70: 70,
				80: 80,
				90: 90,
				99: 99,
				999: 999,
				9999: 9999,
				99999: 99999,
			},
			spacing: {
				13: "3.25rem",
				15: "3.75rem",
				18: "4.5rem",
				22: "5.5rem",
				26: "6.5rem",
				30: "7.5rem",
				50: "12.5rem",
				90: "22.5rem",

				// Bigger values
				100: "25rem",
				120: "30rem",
				128: "32rem",
				140: "35rem",
				160: "40rem",
				180: "45rem",
				192: "48rem",
				200: "50rem",
				240: "60rem",
				256: "64rem",
				280: "70rem",
				320: "80rem",
				360: "90rem",
				400: "100rem",
				480: "120rem",

				// Fractional values
				"1/2": "50%",
				"1/3": "33.333333%",
				"2/3": "66.666667%",
				"1/4": "25%",
				"2/4": "50%",
				"3/4": "75%",
			},
			minHeight: ({ theme }) => ({
				...theme("spacing"),
			}),
			maxHeight: {
				none: "none",
			},
			minWidth: ({ theme }) => ({
				...theme("spacing"),
				screen: "100vw",
			}),
			maxWidth: ({ theme }) => ({
				...theme("spacing"),
				screen: "100vw",
			}),
			transitionDuration: {
				400: "400ms",
			},
			transitionTimingFunction: {
				drawer: "cubic-bezier(0.25, 0.8, 0.25, 1)",
			},

			// @tailwindcss/typography
			typography: ({ theme }) => ({
				DEFAULT: {
					css: {
						color: "var(--fuse-text-default)",
						'[class~="lead"]': {
							color: "var(--fuse-text-secondary)",
						},
						a: {
							color: "var(--fuse-primary-500)",
						},
						strong: {
							color: "var(--fuse-text-default)",
						},
						"ol > li::before": {
							color: "var(--fuse-text-secondary)",
						},
						"ul > li::before": {
							backgroundColor: "var(--fuse-text-hint)",
						},
						hr: {
							borderColor: "var(--fuse-border)",
						},
						blockquote: {
							color: "var(--fuse-text-default)",
							borderLeftColor: "var(--fuse-border)",
						},
						h1: {
							color: "var(--fuse-text-default)",
						},
						h2: {
							color: "var(--fuse-text-default)",
						},
						h3: {
							color: "var(--fuse-text-default)",
						},
						h4: {
							color: "var(--fuse-text-default)",
						},
						"figure figcaption": {
							color: "var(--fuse-text-secondary)",
						},
						code: {
							color: "var(--fuse-text-default)",
							fontWeight: "500",
						},
						"a code": {
							color: "var(--fuse-primary)",
						},
						pre: {
							color: theme("colors.white"),
							backgroundColor: theme("colors.gray.800"),
						},
						thead: {
							color: "var(--fuse-text-default)",
							borderBottomColor: "var(--fuse-border)",
						},
						"tbody tr": {
							borderBottomColor: "var(--fuse-border)",
						},
						'ol[type="A" s]': false,
						'ol[type="a" s]': false,
						'ol[type="I" s]': false,
						'ol[type="i" s]': false,
					},
				},
				sm: {
					css: {
						code: {
							fontSize: "1em",
						},
						pre: {
							fontSize: "1em",
						},
						table: {
							fontSize: "1em",
						},
					},
				},
			}),
		},
	},
	corePlugins: {
		appearance: false,
		container: false,
		float: false,
		clear: false,
		placeholderColor: false,
		placeholderOpacity: false,
		verticalAlign: false,
	},
	plugins: [
		// Fuse - Tailwind plugins
		require(path.resolve(__dirname, "src/@fuse/tailwind/plugins/utilities")),
		require(path.resolve(__dirname, "src/@fuse/tailwind/plugins/icon-size")),
		require(path.resolve(__dirname, "src/@fuse/tailwind/plugins/theming"))({
			themes,
		}),

		// Other third party and/or custom plugins
		require("@tailwindcss/typography")({ modifiers: ["sm", "lg"] }),
	],
};

module.exports = config;
