import { Component, OnInit, ViewEncapsulation } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { environment } from "environments/environment";

@Component({
    selector: "zelfkeys-success",
    standalone: true,
    imports: [RouterLink, MatButtonModule, MatIconModule],
    templateUrl: "./success.component.html",
    encapsulation: ViewEncapsulation.None,
})
export class ZelfKeysSuccessComponent implements OnInit {
    private _sessionId: string | null = null;
    isLoading = true;
    message = "Verifying payment...";
    /** Only "confirmed" after the API verified the Stripe session as paid. */
    status: "verifying" | "confirmed" | "unconfirmed" = "verifying";

    constructor(
        private _route: ActivatedRoute,
        private _http: HttpClient,
        private _router: Router,
    ) {}

    ngOnInit(): void {
        this._sessionId = this._route.snapshot.queryParamMap.get("session_id");

        if (this._sessionId) {
            this.checkSession(this._sessionId);
        } else {
            this.isLoading = false;
            this.status = "unconfirmed";
        }
    }

    checkSession(sessionId: string): void {
        this._http.post(`${environment.apiUrl}/api/subscription/check-session`, { sessionId }).subscribe({
            next: (response: any) => {
                this.isLoading = false;
                // API: { success, data: { success:false, message:"session_not_paid_yet" } } when not paid.
                const paid = !!response?.success && response?.data?.success !== false;
                this.status = paid ? "confirmed" : "unconfirmed";
            },
            error: (err) => {
                this.isLoading = false;
                this.status = "unconfirmed";
                console.error("Error checking session:", err);
            },
        });
    }

    openExtension(): void {
        window.postMessage({ type: "OPEN_ZELF_EXTENSION" }, "*");
        setTimeout(() => {
            window.close();
        }, 500);
    }
}
