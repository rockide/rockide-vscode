import * as vscode from "vscode";
import { stopClient } from "./lsp";
import { startRockide, updateRockide } from "./rockide";
import { registerSchemaProvider, updateSchemas } from "./schemas";
import { reportError } from "./utils";

export function activate(ctx: vscode.ExtensionContext) {
	ctx.subscriptions.push(
		registerSchemaProvider(ctx),
		vscode.commands.registerCommand("rockide.update", async () => {
			await updateSchemas(ctx).catch(reportError);
			await updateRockide(ctx).catch(reportError);
		}),
		vscode.workspace.onDidChangeConfiguration(async (event) => {
			if (event.affectsConfiguration("rockide.path")) {
				const res = await vscode.window.showInformationMessage(
					"Rockide path changed. Restart VSCode to apply your changes.",
					"Restart",
				);
				if (res === "Restart") {
					await vscode.commands.executeCommand("workbench.action.reloadWindow");
				}
			}
		}),
	);

	updateSchemas(ctx, true).catch(reportError);
	startRockide(ctx).catch(reportError);
}

export async function deactivate() {
	await stopClient();
}
