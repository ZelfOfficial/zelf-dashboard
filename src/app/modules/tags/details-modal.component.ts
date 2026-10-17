import { Component, Inject, ChangeDetectorRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatCardModule } from "@angular/material/card";
import { MatChipsModule } from "@angular/material/chips";
import { TagRecord } from "./tags.component";

@Component({
	selector: "app-details-modal",
	standalone: true,
	imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatCardModule, MatChipsModule],
	template: `
		<div class="details-modal" [ngClass]="{ 'dark-mode': isDarkMode }">
			<div class="modal-content">
				<div class="modal-header">
					<h2>Tag Details</h2>
				</div>
				<div class="modal-body">
					<div class="detail-section">
						<h3 class="section-title">Basic Information</h3>
						<div class="detail-item">
							<span class="label">Tag Name</span>
							<span class="value">{{ data.name }}</span>
						</div>
						<div class="detail-item">
							<span class="label">Domain</span>
							<span class="domain-chip">{{ data.publicData.domain }}</span>
						</div>
						<div class="detail-item">
							<span class="label">Created At</span>
							<span class="value">{{ formatDate(data.created_at) }}</span>
						</div>
						<div class="detail-item">
							<span class="label">File Size</span>
							<span class="value">{{ formatFileSize(data.size) }}</span>
						</div>
						<div class="detail-item">
							<span class="label">MIME Type</span>
							<span class="value">{{ data.mime_type }}</span>
						</div>
						<div class="detail-item">
							<span class="label">Number of Files</span>
							<span class="value">{{ data.number_of_files }}</span>
						</div>
					</div>

					<div class="detail-section">
						<h3 class="section-title">Blockchain Addresses</h3>
						<div class="detail-item">
							<span class="label">Bitcoin Address</span>
							<span class="address-value">{{ data.publicData.btcAddress }}</span>
						</div>
						<div class="detail-item">
							<span class="label">Ethereum Address</span>
							<span class="address-value">{{ data.publicData.ethAddress }}</span>
						</div>
						<div class="detail-item">
							<span class="label">Solana Address</span>
							<span class="address-value">{{ data.publicData.solanaAddress }}</span>
						</div>
					</div>

					<div class="detail-section">
						<h3 class="section-title">Additional Information</h3>
						<div class="detail-item">
							<span class="label">CID</span>
							<span class="address-value">{{ data.cid }}</span>
						</div>
						<div class="detail-item">
							<span class="label">IPFS URL</span>
							<span class="address-value">{{ data.url }}</span>
						</div>
						<div class="detail-item">
							<span class="label">Group ID</span>
							<span class="value">{{ data.group_id || "None" }}</span>
						</div>
					</div>

					<div class="detail-section" *ngIf="extraParams">
						<h3 class="section-title">Extra Parameters</h3>
						<div class="extra-params">
							<div class="param-item" *ngFor="let param of extraParams | keyvalue">
								<span class="param-label">{{ param.key }}</span>
								<span class="param-value">{{ param.value }}</span>
							</div>
						</div>
					</div>
				</div>
				<div class="modal-footer">
					<button mat-button (click)="copyAllData()" class="footer-btn copy-btn">
						<mat-icon>content_copy</mat-icon>
						Copy All Data
					</button>
					<button mat-button (click)="openQRCode()" class="footer-btn qr-btn">
						<mat-icon>qr_code</mat-icon>
						View QR Code
					</button>
					<button mat-button (click)="close()" class="footer-btn close-btn">Close</button>
				</div>
			</div>
		</div>
	`,
	styles: [
		`
			.details-modal {
				--modal-bg: #ffffff;
				--modal-text: #1a1a2e;
				--modal-header-bg: #f4f4f4;
				--modal-header-text: #1a1a2e;
				--modal-footer-bg: #fafafa;
				--modal-address-bg: #fafafa;
				--modal-address-text: #1a1a2e;
				--modal-secondary-text: #525252;
				--modal-border: #e5e5e5;

				&.dark-mode {
					--modal-bg: #1a1a2e;
					--modal-text: #f4f4f4;
					--modal-header-bg: #2a2a45;
					--modal-header-text: #f4f4f4;
					--modal-footer-bg: #2a2a45;
					--modal-address-bg: #2a2a45;
					--modal-address-text: #f4f4f4;
					--modal-secondary-text: #a3a3a3;
					--modal-border: #525252;
				}

				.modal-content {
					max-width: 700px;
					width: 100%;
					max-height: 80vh;
					overflow-y: auto;
					background: var(--modal-bg);
					color: var(--modal-text);

					.modal-header {
						background: var(--modal-header-bg);
						color: var(--modal-header-text);
						padding: 20px 24px;
						margin: -24px -24px 24px -24px;
						border-radius: 8px 8px 0 0;
						border-bottom: 2px solid var(--modal-border);

						h2 {
							margin: 0;
							font-size: 20px;
							font-weight: 600;
							color: var(--modal-header-text);
						}
					}

					.modal-body {
						padding: 0 24px 24px 24px;
						background: var(--modal-bg);
						color: var(--modal-text);
					}

					.detail-section {
						margin-bottom: 32px;

						.section-title {
							font-size: 18px;
							font-weight: 600;
							color: var(--modal-text);
							margin-bottom: 16px;
							padding-bottom: 8px;
							border-bottom: 2px solid var(--modal-border);
						}
					}

					.detail-item {
						display: flex;
						justify-content: space-between;
						align-items: flex-start;
						padding: 12px 0;
						border-bottom: 1px solid var(--modal-border);

						&:last-child {
							border-bottom: none;
						}

						.label {
							font-weight: 600;
							color: var(--modal-secondary-text);
							font-size: 14px;
							min-width: 140px;
							flex-shrink: 0;
						}

						.value {
							color: var(--modal-text);
							font-size: 14px;
							word-break: break-all;
							text-align: right;
							flex: 1;
						}

						.domain-chip {
							background: var(--fuse-primary, #1a1a2e);
							color: var(--fuse-on-primary, #ffffff);
							font-size: 12px;
							font-weight: 500;
							padding: 4px 12px;
							border-radius: 16px;
							display: inline-block;
						}

						.address-value {
							font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
							font-size: 12px;
							background: var(--modal-address-bg);
							color: var(--modal-address-text);
							padding: 8px 12px;
							border-radius: 6px;
							border: 1px solid var(--modal-border);
							word-break: break-all;
							text-align: right;
							flex: 1;
						}
					}

					.extra-params {
						background: var(--modal-address-bg);
						border-radius: 8px;
						padding: 16px;
						border: 1px solid var(--modal-border);

						.param-item {
							display: flex;
							justify-content: space-between;
							align-items: center;
							padding: 8px 0;
							border-bottom: 1px solid var(--modal-border);

							&:last-child {
								border-bottom: none;
							}

							.param-label {
								font-weight: 600;
								color: var(--modal-secondary-text);
								font-size: 13px;
								min-width: 120px;
							}

							.param-value {
								color: var(--modal-text);
								font-size: 13px;
								word-break: break-all;
								text-align: right;
								flex: 1;
							}
						}
					}

					.modal-footer {
						display: flex;
						justify-content: flex-end;
						gap: 12px;
						padding: 20px 24px;
						background: var(--modal-footer-bg);
						margin: 0 -24px -24px -24px;
						border-radius: 0 0 8px 8px;
						border-top: 1px solid var(--modal-border);

						.footer-btn {
							color: var(--modal-text);
							border: 1px solid var(--modal-border);
							background: transparent;
							font-weight: 500;

							mat-icon {
								color: inherit;
							}

							&.copy-btn {
								color: var(--fuse-primary);

								&:hover {
									background: var(--fuse-primary-50);
								}
							}

							&.qr-btn {
								color: var(--fuse-success);

								&:hover {
									background: var(--fuse-success-50);
								}
							}

							&.close-btn {
								color: var(--modal-text);
								opacity: 0.8;

								&:hover {
									opacity: 1;
									background: var(--modal-footer-bg);
								}
							}
						}
					}
				}
			}
		`,
	],
})
export class DetailsModalComponent {
	extraParams: any = null;
	isDarkMode: boolean = false;

	constructor(
		public dialogRef: MatDialogRef<DetailsModalComponent>,
		@Inject(MAT_DIALOG_DATA) public data: TagRecord,
		private _cdr: ChangeDetectorRef
	) {
		this.parseExtraParams();
		this._checkDarkMode();
		this._watchDarkMode();
	}

	private _checkDarkMode(): void {
		this.isDarkMode = document.body.classList.contains("dark") || document.documentElement.classList.contains("dark");
		this._cdr.markForCheck();
	}

	private _watchDarkMode(): void {
		const observer = new MutationObserver(() => {
			this._checkDarkMode();
		});

		observer.observe(document.body, {
			attributes: true,
			attributeFilter: ["class"],
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
	}

	private parseExtraParams(): void {
		try {
			this.extraParams = JSON.parse(this.data.publicData.extraParams);
		} catch (error) {
			console.error("Error parsing extra params:", error);
			this.extraParams = null;
		}
	}

	formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	formatFileSize(bytes: number): string {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	}

	async copyAllData(): Promise<void> {
		const dataString = JSON.stringify(this.data, null, 2);
		try {
			await navigator.clipboard.writeText(dataString);
		} catch (err) {
			console.error("Failed to copy data: ", err);
		}
	}

	openQRCode(): void {
		// Close this modal and open QR code modal
		this.dialogRef.close("openQR");
	}

	close(): void {
		this.dialogRef.close();
	}
}
