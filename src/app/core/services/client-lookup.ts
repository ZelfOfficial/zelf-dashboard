import { HttpHeaders } from "@angular/common/http";

/**
 * Session header for `GET /api/clients`. Anonymous calls are rejected, so a signed-in
 * profile refresh must send the session JWT.
 */
export function clientLookupHeaders(accessToken: string | null | undefined): HttpHeaders {
	if (!accessToken) return new HttpHeaders();
	return new HttpHeaders({ Authorization: `Bearer ${accessToken}` });
}
