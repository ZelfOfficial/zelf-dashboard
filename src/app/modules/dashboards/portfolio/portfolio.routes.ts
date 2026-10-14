import { Routes } from "@angular/router";

// The old My Tags / Discover placeholders were removed (#36); keep old links working.
export default [
	{ path: "", pathMatch: "full", redirectTo: "/tags" },
	{ path: "my-tags", redirectTo: "/tags" },
	{ path: "discover", redirectTo: "/tags" },
] as Routes;
