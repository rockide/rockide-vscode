import { unpackTar } from "modern-tar";
import { posix } from "path";
import * as vscode from "vscode";
import { GitHubRelease, downloadAsset, getLatestRelease } from "./github";
import { UPDATE_CHECK_INTERVAL, exists, gunzipAsync } from "./utils";

const ASSET_NAME = "schemas.tar.gz";
const SCHEME = "rockide-schema";

const onDidChange = new vscode.EventEmitter<vscode.Uri>();

function getSchemasDir(ctx: vscode.ExtensionContext) {
	return vscode.Uri.joinPath(ctx.globalStorageUri, "schemas");
}

async function installSchemas(ctx: vscode.ExtensionContext, release: GitHubRelease) {
	const asset = release.assets.find((v) => v.name === ASSET_NAME);
	if (!asset) {
		throw new Error(`Schemas ${release.tag_name} has no ${ASSET_NAME}.`);
	}

	const entries = await downloadAsset(asset, true)
		.then(gunzipAsync)
		.then(unpackTar);

	const tmp = vscode.Uri.joinPath(ctx.globalStorageUri, "schemas.tmp");
	if (await exists(tmp)) {
		await vscode.workspace.fs.delete(tmp, { recursive: true });
	}
	await vscode.workspace.fs.createDirectory(tmp);

	for (const entry of entries) {
		if (!entry.data) {
			continue;
		}
		const name = entry.header.name;
		if (posix.dirname(name) !== "dist" || !name.endsWith(".json")) {
			continue;
		}
		const fsPath = vscode.Uri.joinPath(tmp, posix.basename(name));
		await vscode.workspace.fs.writeFile(fsPath, entry.data);
	}

	const dir = getSchemasDir(ctx);
	if (await exists(dir)) {
		await vscode.workspace.fs.delete(dir, { recursive: true });
	}
	await vscode.workspace.fs.rename(tmp, dir);
	await ctx.globalState.update("schemasVersion", release.tag_name);

	for (const doc of vscode.workspace.textDocuments) {
		if (doc.uri.scheme === SCHEME) {
			onDidChange.fire(doc.uri);
		}
	}
}

export async function updateSchemas(ctx: vscode.ExtensionContext, silent?: boolean) {
	const currentVersion = await exists(getSchemasDir(ctx))
		? ctx.globalState.get<string>("schemasVersion")
		: undefined;
	const now = Date.now();

	if (silent && currentVersion) {
		const lastUpdate = ctx.globalState.get<number>("lastSchemasUpdate", 0);
		if (now - lastUpdate < UPDATE_CHECK_INTERVAL) {
			return;
		}
	}
	await ctx.globalState.update("lastSchemasUpdate", now);

	const release = await getLatestRelease("rockide/schemas");
	if (release.tag_name === currentVersion) {
		if (!silent) {
			vscode.window.showInformationMessage("Schemas are already up to date.");
		}
		return;
	}

	await installSchemas(ctx, release);
	if (!silent) {
		vscode.window.showInformationMessage(`Schemas ${release.tag_name} successfully installed!`);
	}
}

export function registerSchemaProvider(ctx: vscode.ExtensionContext) {
	const dir = getSchemasDir(ctx);
	return vscode.Disposable.from(
		onDidChange,
		vscode.workspace.registerTextDocumentContentProvider(SCHEME, {
			onDidChange: onDidChange.event,
			async provideTextDocumentContent(uri) {
				try {
					const data = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(dir, uri.path));
					return new TextDecoder().decode(data);
				} catch {
					return "{}";
				}
			},
		}),
	);
}
