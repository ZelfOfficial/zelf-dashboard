import { Component, Inject, ChangeDetectorRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatCardModule } from "@angular/material/card";
import { TagRecord } from "./tags.component";

@Component({
    selector: "app-qr-code-modal",
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatCardModule],
    template: `
        <div class="qr-modal" [ngClass]="{ 'dark-mode': isDarkMode }">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>QR Code Preview</h2>
                </div>
                <div class="modal-body">
                    <div class="qr-container">
                        <img [src]="data.url" [alt]="'QR Code for ' + data.name" class="qr-image" (error)="onImageError($event)" />
                        <div class="qr-url">{{ data.url }}</div>
                        <div class="qr-info">
                            <p class="qr-tag-name">
                                Tag: <strong>{{ data.name }}</strong>
                            </p>
                            <p class="qr-hint">Click the image to open in new tab</p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button mat-button (click)="openInNewTab()" class="footer-btn open-btn">
                        <mat-icon>open_in_new</mat-icon>
                        Open in New Tab
                    </button>
                    <button mat-button (click)="copyToClipboard()" class="footer-btn copy-btn">
                        <mat-icon>content_copy</mat-icon>
                        Copy URL
                    </button>
                    <button mat-button (click)="close()" class="footer-btn close-btn">Close</button>
                </div>
            </div>
        </div>
    `,
    styles: [
        `
            .qr-modal {
                --modal-bg: #ffffff;
                --modal-text: #1a1a2e;
                --modal-header-bg: #f4f4f4;
                --modal-header-text: #1a1a2e;
                --modal-footer-bg: #fafafa;
                --modal-url-bg: #fafafa;
                --modal-url-text: #1a1a2e;
                --modal-secondary-text: #525252;
                --modal-border: #e5e5e5;

                &.dark-mode {
                    --modal-bg: #1a1a2e;
                    --modal-text: #f4f4f4;
                    --modal-header-bg: #2a2a45;
                    --modal-header-text: #f4f4f4;
                    --modal-footer-bg: #2a2a45;
                    --modal-url-bg: #2a2a45;
                    --modal-url-text: #f4f4f4;
                    --modal-secondary-text: #a3a3a3;
                    --modal-border: #525252;
                }

                .modal-content {
                    max-width: 500px;
                    width: 100%;
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
                        background: var(--modal-bg);
                        color: var(--modal-text);
                    }

                    .qr-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        padding: 24px;
                        background: var(--modal-bg);
                        color: var(--modal-text);

                        .qr-image {
                            width: 300px;
                            height: 300px;
                            border-radius: 12px;
                            border: 2px solid var(--modal-border);
                            margin-bottom: 20px;
                            cursor: pointer;
                            transition: all 0.2s ease-in-out;
                            background: var(--modal-bg);

                            &:hover {
                                transform: scale(1.02);
                                border-color: var(--fuse-primary);
                                box-shadow: var(--fuse-elevation-4);
                            }
                        }

                        .qr-url {
                            font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
                            font-size: 12px;
                            color: var(--modal-url-text);
                            background: var(--modal-url-bg);
                            padding: 12px 16px;
                            border-radius: 8px;
                            border: 1px solid var(--modal-border);
                            word-break: break-all;
                            max-width: 100%;
                            text-align: center;
                        }

                        .qr-info {
                            margin-top: 16px;
                            text-align: center;

                            .qr-tag-name {
                                font-size: 14px;
                                color: var(--modal-secondary-text);
                                margin-bottom: 8px;

                                strong {
                                    color: var(--modal-text);
                                    font-weight: 600;
                                }
                            }

                            .qr-hint {
                                font-size: 12px;
                                color: var(--modal-secondary-text);
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

                            &.open-btn {
                                color: var(--fuse-primary);

                                &:hover {
                                    background: var(--fuse-primary-50);
                                }
                            }

                            &.copy-btn {
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
export class QRCodeModalComponent {
    isDarkMode: boolean = false;

    constructor(
        public dialogRef: MatDialogRef<QRCodeModalComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TagRecord,
        private _cdr: ChangeDetectorRef,
    ) {
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

    onImageError(event: any): void {
        event.target.src =
            "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNTAgMTAwQzEyNS4xIDEwMCAxMDUgMTIwLjEgMTA1IDE0NUMxMDUgMTY5LjkgMTI1LjEgMTkwIDE1MCAxOTBDMTc0LjkgMTkwIDE5NSAxNjkuOSAxOTUgMTQ1QzE5NSAxMjAuMSAxNzQuOSAxMDAgMTUwIDEwMFoiIGZpbGw9IiM5Q0EzQUYiLz4KPHN2ZyB4PSIxMzAiIHk9IjEzMCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiB2aWV3Qm94PSIwIDAgNDAgNDAiIGZpbGw9Im5vbmUiPgo8cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0yMCAxMEMyNi4wNzExIDEwIDMxIDE0LjkyODkgMzEgMjFDMzEgMjcuMDcxMSAyNi4wNzExIDMyIDIwIDMyQzEzLjkyODkgMzIgOSAyNy4wNzExIDkgMjFDOSAxNC45Mjg5IDEzLjkyODkgMTAgMjAgMTBaIiBmaWxsPSIjMzc0MTUxIi8+Cjwvc3ZnPgo8L3N2Zz4K";
        event.target.alt = "QR Code not available";
    }

    openInNewTab(): void {
        window.open(this.data.url, "_blank");
    }

    async copyToClipboard(): Promise<void> {
        try {
            await navigator.clipboard.writeText(this.data.url);
        } catch (err) {
            console.error("Failed to copy URL: ", err);
        }
    }

    close(): void {
        this.dialogRef.close();
    }
}
