import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { AuthStorage } from "app/core/auth/auth-storage";
import { firstValueFrom } from "rxjs";
import { HttpWrapperService } from "../../http-wrapper.service";
import { environment } from "environments/environment";
import { clientLookupHeaders } from "./client-lookup";

@Injectable({
	providedIn: "root",
})
export class ClientService {
	constructor(
		private _httpWrapper: HttpWrapperService,
		private _http: HttpClient
	) {}

	/**
	 * Update client profile
	 */
	async updateProfile(data: any): Promise<any> {
		const url = `${environment.apiUrl}${environment.endpoints.client.update}`;
		return this._httpWrapper.sendRequest("put", url, data);
	}

	/**
	 * Get client profile by email. Requires the signed-in session JWT.
	 */
	async getProfile(email: string): Promise<any> {
		const url = `${environment.apiUrl}/api/clients`;

		return firstValueFrom(
			this._http.get(url, {
				params: { email },
				headers: clientLookupHeaders(AuthStorage.getItem("accessToken")),
			})
		);
	}
}
