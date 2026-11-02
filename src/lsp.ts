import * as vscode from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions } from "vscode-languageclient/node";

let current: LanguageClient | null;

const outputChannel = vscode.window.createOutputChannel("Rockide");

export async function startClient(exe: vscode.Uri) {
	if (current) {
		throw new Error("Another client is already running!");
	}

	const config = vscode.workspace.getConfiguration("rockide");
	const serverOptions: ServerOptions = {
		command: exe.fsPath,
	};
	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			{ scheme: "file", language: "json" },
			{ scheme: "file", language: "jsonc" },
			{ scheme: "file", language: "rockide-lang" },
			{ scheme: "file", language: "rockide-mcfunction" },
		],
		uriConverters: {
			code2Protocol: (uri) => uri.toString(true),
			protocol2Code: (path) => vscode.Uri.parse(path),
		},
		initializationOptions: {
			projectPaths: config.get("projectPaths"),
		},
		outputChannel,
	};
	const client = new LanguageClient("rockide", "Rockide", serverOptions, clientOptions);
	current = client;

	outputChannel.clear();
	await client.start();
}

export async function stopClient() {
	if (!current) {
		return;
	}
	const client = current;
	current = null;
	// The `stop` call will send the "shutdown" notification to the LSP
	await client.stop();
	// The `dipose` call will send the "exit" request to the LSP which actually tells the child process to exit
	await client.dispose();
}
