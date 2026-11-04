import { execFile } from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";
import { gunzip } from "zlib";

export const UPDATE_CHECK_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours

export const execFileAsync = promisify(execFile);

export const gunzipAsync = promisify(gunzip);

export async function exists(uri: vscode.Uri) {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
}

export function reportError(err: unknown) {
	if (err instanceof Error) {
		vscode.window.showErrorMessage(err.message);
	} else {
		vscode.window.showErrorMessage(String(err));
	}
}

export async function req(url: string, init?: RequestInit) {
	let res: Response;
	try {
		res = await fetch(url, init);
	} catch (err) {
		if (err instanceof Error && err.cause instanceof Error && "code" in err.cause) {
			throw new Error(`Fetch ${url} failed: ${err.cause.code}`);
		}
		throw err;
	}
	if (!res.ok) {
		throw new Error(`Fetch ${url} failed: ${res.statusText} (${res.status})`);
	}
	return res;
}
