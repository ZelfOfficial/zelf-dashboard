import { Injectable } from "@angular/core";
import { HttpWrapperService } from "../../http-wrapper.service";
import { environment } from "../../../environments/environment";

/** Native balance slot from GET /api/zelf-ids/wallet-balances */
export interface WalletBalanceSlot {
    value: string | number | null;
    unit: string;
    error?: string;
    raw?: unknown;
}

export interface TagWalletBalancesData {
    eth: WalletBalanceSlot;
    btc: WalletBalanceSlot;
    sol: WalletBalanceSlot;
    avax: WalletBalanceSlot;
    bdag: WalletBalanceSlot;
}

export interface TagWalletBalancesResponse {
    data: TagWalletBalancesData;
}

/**
 * Wallet balance aggregation for tag detail (GET /api/zelf-ids/wallet-balances).
 * Kept separate from TagsService when that file is not writable in the workspace.
 */
@Injectable({
    providedIn: "root",
})
export class TagsWalletBalancesService {
    private readonly baseUrl = `${environment.apiUrl}/api/zelf-ids/wallet-balances`;

    constructor(private httpWrapper: HttpWrapperService) {}

    getWalletBalances(params: {
        ethAddress?: string;
        btcAddress?: string;
        solanaAddress?: string;
    }): Promise<TagWalletBalancesResponse> {
        const queryParams: Record<string, string> = {};
        if (params.ethAddress) queryParams.ethAddress = params.ethAddress;
        if (params.btcAddress) queryParams.btcAddress = params.btcAddress;
        if (params.solanaAddress) queryParams.solanaAddress = params.solanaAddress;
        return this.httpWrapper.sendRequest("get", this.baseUrl, queryParams);
    }
}
