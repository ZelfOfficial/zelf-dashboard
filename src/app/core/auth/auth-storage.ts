/**
 * Storage for sign-in material (JWT, zelfProof, zelfAccount, wallet).
 *
 * Kept in sessionStorage (scoped to the tab, cleared when it closes) instead of
 * localStorage, so the staff JWT and zelfProof do not persist on disk across browser
 * restarts. Any copy left in localStorage by older builds is moved over once and deleted.
 *
 * A full fix (httpOnly cookie) needs API support; see the PR notes.
 */
export const AUTH_STORAGE_KEYS = ["accessToken", "zelfProof", "zelfAccount", "wallet"] as const;

function migrate(key: string): void {
	try {
		const legacy = localStorage.getItem(key);
		if (legacy !== null) {
			if (sessionStorage.getItem(key) === null) sessionStorage.setItem(key, legacy);
			localStorage.removeItem(key);
		}
	} catch {
		/* storage unavailable */
	}
}

export const AuthStorage = {
	getItem(key: string): string | null {
		migrate(key);
		try {
			return sessionStorage.getItem(key);
		} catch {
			return null;
		}
	},
	setItem(key: string, value: string): void {
		try {
			sessionStorage.setItem(key, value);
			localStorage.removeItem(key);
		} catch {
			/* storage unavailable */
		}
	},
	removeItem(key: string): void {
		try {
			sessionStorage.removeItem(key);
			localStorage.removeItem(key);
		} catch {
			/* storage unavailable */
		}
	},
	clear(): void {
		AUTH_STORAGE_KEYS.forEach((k) => AuthStorage.removeItem(k));
	},
};

/**
 * The client API key is only ever kept in memory (never in browser storage):
 * it is shown on the Security page for the current page session and lost on reload.
 */
let _apiKey = "";
export const ApiKeyVault = {
	get: (): string => _apiKey,
	set: (value: string): void => {
		_apiKey = value || "";
	},
	clear: (): void => {
		_apiKey = "";
	},
};
