import { Injectable } from "@angular/core";
import { HttpWrapperService } from "../../http-wrapper.service";
import { environment } from "../../../environments/environment";

export interface TagSearchParams {
    tagName?: string;
    domain?: string;
    key?: string;
    value?: string;
    os?: string;
    captchaToken?: string;
}

export interface DomainSearchParams {
    domain: string;
    storage: string;
    limit?: number;
    offset?: number;
    /** Pinata pin name filter (substring / LIKE-style), IPFS only */
    name?: string;
}

export interface TagSearchResponse {
    data: {
        available: boolean;
        tagName: string;
        domain?: string;
        ipfs?: any[];
        arweave?: any[];
        tagObject?: {
            id: string;
            cid: string;
            size: number;
            mime_type?: string;
            created_at: string;
            url: string;
            publicData: {
                avaxName: string;
                btcAddress: string;
                domain: string;
                ethAddress: string;
                extraParams: string;
                solanaAddress: string;
            };
        };
        price?: {
            price: number;
            currency: string;
            reward: number;
            discount: number;
            priceWithoutDiscount: number;
            discountType: string;
        };
    };
}

export interface TagPreviewResponse {
    data: {
        // When tag exists
        preview?: {
            passwordLayer?: string;
            publicData?: {
                ethAddress?: string;
                btcAddress?: string;
                solanaAddress?: string;
                zelfName?: string;
                leaseExpiresAt?: string;
                evm?: string;
                [key: string]: any;
            };
            requireLiveness?: boolean;
        };
        tagObject?: {
            id?: string;
            owner?: string;
            url?: string;
            explorerUrl?: string;
            publicData?: {
                zelfProof?: string;
                zelfProofQRCode?: string;
                hasPassword?: string;
                ethAddress?: string;
                btcAddress?: string;
                solanaAddress?: string;
                zelfName?: string;
                leaseExpiresAt?: string;
                evm?: string;
                [key: string]: any;
            };
            size?: string | number;
            zelfProofQRCode?: string;
            zelfProof?: string;
        };
        // When tag is available
        available?: boolean;
        tagName?: string;
        price?: {
            price: number;
            currency: string;
            reward: number;
            discount: number;
            priceWithoutDiscount: number;
            discountType: string;
        };
    };
}

export interface DomainSearchResponse {
    data: any[];
    total?: number;
    limit?: number;
    offset?: number;
}

export interface PaymentOptionsParams {
    tagName: string;
    domain: string;
    duration: number | string;
    /** License plan (e.g. premium / unlimited). Omit to let the API pick the license default for the name length. */
    plan?: string;
}

export interface PaymentOptionsResponse {
    data:
        | {
              paymentAddress: {
                  ethAddress: string;
                  btcAddress: string;
                  solanaAddress: string;
                  avalancheAddress: string;
              };
              prices: {
                  ETH?: { amountToSend: number; ratePriceInUSD: number; price: number };
                  SOL?: { amountToSend: number; ratePriceInUSD: number; price: number } | null;
                  BTC?: { amountToSend: number; ratePriceInUSD: number; price: number };
                  AVAX?: { amountToSend: number; ratePriceInUSD: number; price: number };
              };
              tagName: string;
              tagPayName: string;
              expiresAt: string;
              ttl: number;
              duration: number;
              count: number;
              payment: {
                  registeredAt: string;
                  expiresAt: string;
              };
              signedDataPrice: string;
          }
        | { error: string };
}

@Injectable({
    providedIn: "root",
})
export class TagsService {
    private readonly baseUrl = `${environment.apiUrl}/api/tags`;

    constructor(private httpWrapper: HttpWrapperService) {}

    /**
     * Search for a tag by name
     * @param params Search parameters
     * @returns Promise of search response
     */
    searchTag(params: TagSearchParams): Promise<TagSearchResponse> {
        const queryParams = this.buildQueryParams(params);
        return this.httpWrapper.sendRequest("get", `${this.baseUrl}/search`, queryParams);
    }

    /**
     * Preview a tag (richer data than search — includes zelfProof, QR code, lease info)
     * @param params Search parameters
     * @returns Promise of preview response
     */
    previewTag(params: TagSearchParams): Promise<TagPreviewResponse> {
        const queryParams = this.buildQueryParams(params);
        return this.httpWrapper.sendRequest("get", `${this.baseUrl}/preview`, queryParams);
    }

    /**
     * Search tags by domain
     * @param params Domain search parameters
     * @returns Promise of domain search response
     */
    searchByDomain(params: DomainSearchParams): Promise<DomainSearchResponse> {
        const { offset, ...rest } = params;
        const queryParams = this.buildQueryParams({
            ...rest,
            ...(offset !== undefined ? { pageOffset: offset } : {}),
        });
        return this.httpWrapper.sendRequest("get", `${this.baseUrl}/search-by-domain`, queryParams);
    }

    /**
     * Get available domains
     * @returns Promise with list of available domains
     */
    getDomains(): Promise<{ data: string[] }> {
        const queryParams = { includeNonPaid: environment.includeNonPaidDomains };

        return this.httpWrapper.sendRequest("get", `${this.baseUrl}/domains`, queryParams).then((response: any) => {
            // Extract domain keys if response is an object
            if (response && response.data && typeof response.data === "object" && !Array.isArray(response.data)) {
                const domains = Object.keys(response.data).map((key) => (key.startsWith(".") ? key : `.${key}`));

                // Sort: .zelf first, .bdag second, then the rest
                domains.sort((a, b) => {
                    if (a === ".zelf") return -1;
                    if (b === ".zelf") return 1;
                    if (a === ".bdag") return -1;
                    if (b === ".bdag") return 1;
                    return a.localeCompare(b);
                });

                return { data: domains };
            }
            return response;
        });
    }

    /**
     * Get payment options for a tag
     * @param params Payment options parameters
     * @returns Promise with payment options response
     */
    getPaymentOptions(params: PaymentOptionsParams): Promise<PaymentOptionsResponse> {
        const queryParams = this.buildQueryParams(params);
        return this.httpWrapper.sendRequest("get", `${environment.apiUrl}/api/my-tags/payment-options`, queryParams);
    }

    /**
     * Check payment confirmation status
     * @param params Payment confirmation parameters
     * @returns Promise with payment confirmation response
     */
    checkPaymentConfirmation(params: { tagName: string; domain: string; token: string; network: string }): Promise<any> {
        return this.httpWrapper.sendRequest("post", `${environment.apiUrl}/api/my-tags/payment-confirmation`, params);
    }

    /**
     * Send email receipt for a purchase
     * @param params Email receipt parameters including email
     * @returns Promise with email receipt response
     */
    emailReceipt(params: { tagName: string; domain: string; email: string; token: string; network: string }): Promise<any> {
        return this.httpWrapper.sendRequest("post", `${environment.apiUrl}/api/my-tags/email-receipt`, params);
    }

    /**
     * Extend license for the domain owner (free extension)
     * @param params Extension parameters
     * @returns Promise with extension response
     */
    extendLicenseForOwner(params: {
        tagName: string;
        domain: string;
        duration: number | string;
        faceBase64?: string;
        password?: string;
    }): Promise<any> {
        return this.httpWrapper.sendRequest("post", `${environment.apiUrl}/api/my-tags/custom-extend`, params);
    }

    /**
     * Build query parameters from object
     * @param params Parameters object
     * @returns Query parameters object
     */
    private buildQueryParams(params: any): any {
        const queryParams: any = {};

        Object.keys(params).forEach((key) => {
            if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
                queryParams[key] = params[key];
            }
        });

        return queryParams;
    }
}
