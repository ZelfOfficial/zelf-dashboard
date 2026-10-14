import { Routes } from "@angular/router";
import { ZelfProofsComponent } from "app/modules/play-area/zelfproofs/zelfproofs.component";
import { HumanAuthnEncryptQrComponent } from "app/modules/play-area/human-authn-encrypt-qr/human-authn-encrypt-qr.component";
import { HumanAuthnPreviewComponent } from "app/modules/play-area/human-authn-preview/human-authn-preview.component";
import { HumanAuthnDecryptComponent } from "app/modules/play-area/human-authn-decrypt/human-authn-decrypt.component";

export default [
	{ path: "", redirectTo: "human-authn/create", pathMatch: "full" },
	{ path: "zelfproofs", redirectTo: "human-authn/create", pathMatch: "full" },
	{ path: "human-authn/create", component: ZelfProofsComponent },
	{ path: "human-authn/encrypt-qr", component: HumanAuthnEncryptQrComponent },
	{ path: "human-authn/preview", component: HumanAuthnPreviewComponent },
	{ path: "human-authn/decrypt", component: HumanAuthnDecryptComponent },
] as Routes;
