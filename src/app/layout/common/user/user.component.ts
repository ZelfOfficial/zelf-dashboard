import { AuthStorage } from "app/core/auth/auth-storage";
import { BooleanInput } from "@angular/cdk/coercion";
import { CommonModule, NgClass } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { Router, RouterLink } from "@angular/router";
import { TranslocoModule } from "@jsverse/transloco";
import { AuthService } from "app/core/auth/auth.service";
import { UserService } from "app/core/user/user.service";
import { User, ZelfUser } from "app/core/user/user.types";
import { Subject, takeUntil } from "rxjs";

@Component({
	selector: "user",
	templateUrl: "./user.component.html",
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	exportAs: "user",
	imports: [CommonModule, MatButtonModule, MatMenuModule, MatIconModule, NgClass, MatDividerModule, RouterLink, MatSnackBarModule, TranslocoModule],
})
export class UserComponent implements OnInit, OnDestroy {
	/* eslint-disable @typescript-eslint/naming-convention */
	static ngAcceptInputType_showAvatar: BooleanInput;
	/* eslint-enable @typescript-eslint/naming-convention */

	@Input() showAvatar: boolean = true;
	user: User | null = null;
	wallet: any = null;
	walletAddress: string = "";

	private _unsubscribeAll: Subject<any> = new Subject<any>();

	/**
	 * Constructor
	 */
	constructor(
		private _changeDetectorRef: ChangeDetectorRef,
		private _router: Router,
		private _authService: AuthService,
		private _userService: UserService,
		private _snackBar: MatSnackBar
	) {}

	get authService(): AuthService {
		return this._authService;
	}

	// -----------------------------------------------------------------------------------------------------
	// @ Lifecycle hooks
	// -----------------------------------------------------------------------------------------------------

	/**
	 * On init
	 */
	ngOnInit(): void {
		// Subscribe to user changes
		const zelfAccount = AuthStorage.getItem("zelfAccount");

		if (zelfAccount) {
			const _zelfAccount = JSON.parse(zelfAccount);
			this.user = new ZelfUser(_zelfAccount);
		}

		// Load wallet data
		this.loadWallet();
	}

	/**
	 * On destroy
	 */
	ngOnDestroy(): void {
		// Unsubscribe from all subscriptions
		this._unsubscribeAll.next(null);
		this._unsubscribeAll.complete();
	}

	// -----------------------------------------------------------------------------------------------------
	// @ Public methods
	// -----------------------------------------------------------------------------------------------------

	/**
	 * Load wallet data from localStorage
	 */
	loadWallet(): void {
		const walletData = AuthStorage.getItem("wallet");
		if (walletData) {
			this.wallet = JSON.parse(walletData);
			// Set default address to Solana
			this.walletAddress = this.wallet.solanaAddress || this.wallet.ethAddress || this.wallet.btcAddress || this.wallet.suiAddress || "";
			this._changeDetectorRef.markForCheck();
		}
	}

	/**
	 * Format address for display (show first 4 and last 4 characters)
	 */
	formatAddress(address: string): string {
		if (!address) return "";
		if (address.length <= 12) return address;
		return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
	}

	/**
	 * Format address for dropdown display (show first 6 and last 6 characters)
	 */
	formatAddressLong(address: string): string {
		if (!address) return "";
		if (address.length <= 16) return address;
		return `${address.substring(0, 6)}...${address.substring(address.length - 6)}`;
	}

	/**
	 * Copy address to clipboard
	 */
	copyAddress(address: string, chain: string): void {
		navigator.clipboard.writeText(address).then(() => {
			this._snackBar.open(`${chain} address copied to clipboard`, "Close", {
				duration: 2000,
			});
		});
	}

	/**
	 * Update the user status
	 *
	 * @param status
	 */
	updateUserStatus(status: string): void {
		// Return if user is not available
		if (!this.user) {
			return;
		}

		// Update the user
		this._userService
			.update({
				...this.user,
				status,
			})
			.subscribe();
	}

	/**
	 * Sign out
	 */
	signOut(): void {
		this._router.navigate(["/sign-out"]);
	}
}
