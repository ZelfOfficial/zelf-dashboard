import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { TranslocoModule } from "@jsverse/transloco";

import { SettingsZelfNameServiceComponent } from "../zelf-name-service/zelf-name-service.component";
import { StorageOptionsComponent } from "../zelf-name-service/components/storage-options/storage-options.component";

/**
 * Settings > Zelf Keys
 *
 * Dedicated page for the license `zelfkeys` section (feature toggle + ZelfKeys storage),
 * split out of Manage License. It is built exactly like Settings > Zelf Name Service:
 * it reuses that component's license loading, form population, domainConfig builder and
 * save-confirmation flow, so the saved license JSON has the same shape and every other
 * section is passed through from the loaded license unchanged. Only the template differs.
 */
@Component({
	selector: "settings-zelf-keys",
	templateUrl: "./zelf-keys.component.html",
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, MatSlideToggleModule, TranslocoModule, StorageOptionsComponent],
})
export class SettingsZelfKeysComponent extends SettingsZelfNameServiceComponent implements OnInit {
	/** Visiting Zelf Keys must not tick the ZNS onboarding step, so skip the parent's markVisited. */
	override ngOnInit(): void {
		this.initializeWhitelistItems();
		this.createEmptyForm();
	}

	/** Same save flow as Zelf Name Service, returning to this page afterwards. */
	override saveLicense(): void {
		if (this.accountForm.invalid) {
			this.showError("Please fill in all required fields correctly");
			return;
		}
		const domainConfig = this.buildDomainConfig();
		const t = (key: string) => this._translocoService.translate(key);

		this._saveConfirmationService.setSaveData({
			domain: domainConfig.name,
			domainConfig,
			redirectUrl: "/settings/zelf-keys",
			operation: {
				title: t("saving_operations.license_configuration.title"),
				description: t("saving_operations.license_configuration.description"),
				action: t("saving_operations.license_configuration.action"),
				itemName: t("saving_operations.license_configuration.itemName"),
			},
		});
		this._router.navigate(["/save-confirmation"], { queryParams: { redirect: "/settings/zelf-keys" } });
	}
}
