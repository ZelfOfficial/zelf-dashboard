import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "app/core/auth/auth.service";
import { AuthUtils } from "app/core/auth/auth.utils";
import { SessionService } from "app/core/services/session.service";
import { Observable, catchError, throwError } from "rxjs";

/**
 * Intercept
 *
 * @param req
 * @param next
 */
export const authInterceptor = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
	const authService = inject(AuthService);
	const sessionService = inject(SessionService);
	const router = inject(Router);

	// Clone the request object
	let newReq = req.clone();

	// Request
	//
	// Check for either accessToken (authenticated users) or sessionToken (public payment routes)
	// If the access token didn't expire, add the Authorization header.
	// We won't add the Authorization header if the access token expired.
	// This will force the server to return a "401 Unauthorized" response
	// for the protected API routes which our response interceptor will
	// catch and delete the access token from the local storage while logging
	// the user out from the app.
	let token: string | null = null;
	let usedAccessToken = false;

	// First, try to use the access token (for authenticated users)
	if (authService.accessToken && !AuthUtils.isTokenExpired(authService.accessToken)) {
		token = authService.accessToken;
		usedAccessToken = true;
	}
	// If no access token, try session token (for public payment routes)
	else if (sessionService.hasSessionToken()) {
		token = sessionService.getSessionToken();
	}

	// Add the token to the request if we have one
	if (token) {
		newReq = req.clone({
			headers: req.headers.set("Authorization", "Bearer " + token),
		});
	}

	// Response
	return next(newReq).pipe(
		catchError((error) => {
			// A 401 on a request made with the signed-in user's JWT means the token is expired
			// or revoked: clear auth state and send the user to sign in. Requests made with the
			// public payment session token are left alone so public pages keep working.
			if (error instanceof HttpErrorResponse && error.status === 401 && usedAccessToken) {
				authService.signOut();
				const redirect = router.url && !router.url.startsWith("/sign-in") ? router.url : "/";
				router.navigate(["/sign-in"], { queryParams: { redirectURL: redirect } });
			}

			return throwError(error);
		})
	);
};
