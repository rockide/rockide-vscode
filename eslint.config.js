import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
	eslint.configs.recommended,
	tseslint.configs.recommended,
	{
		languageOptions: {
			globals: globals.node,
		},
		rules: {
			curly: "warn",
			eqeqeq: "warn",
			"no-throw-literal": "warn",
		},
	},
	globalIgnores(["esbuild.js"]),
);
