import { createHash } from "crypto";
import * as vscode from "vscode";
import { req } from "./utils";

export type GitHubRelease = {
	tag_name: string;
	assets: GitHubAsset[];
};

export type GitHubAsset = {
	name: string;
	digest: string;
	browser_download_url: string;
};

export async function getLatestRelease(repo: string) {
	const res = await req(`https://api.github.com/repos/${repo}/releases/latest`);
	return await res.json() as GitHubRelease;
}

export function downloadAsset(asset: GitHubAsset, silent?: boolean) {
	return vscode.window.withProgress(
		{
			location: silent ? vscode.ProgressLocation.Window : vscode.ProgressLocation.Notification,
			title: `Downloading ${asset.name}`,
			cancellable: !silent,
		},
		async (progress, token) => {
			const abortController = new AbortController();
			token.onCancellationRequested(() => {
				abortController.abort();
			});

			let res = await req(asset.browser_download_url, {
				signal: abortController.signal,
			});
			if (!res.body) {
				throw new Error("Failed to get response body.");
			}

			const contentLength = res.headers.get("Content-Length");
			const totalBytes = contentLength ? parseInt(contentLength) : 0;
			if (totalBytes === 0) {
				throw new Error("Failed to get response content length.");
			}

			let receivedLength = 0;
			const stream = new TransformStream<{ length: number }>({
				transform(chunk, controller) {
					receivedLength += chunk.length;
					const increment = (chunk.length / totalBytes) * 100;
					const currentProgress = (receivedLength / totalBytes) * 100;
					progress.report({
						message: `${currentProgress.toFixed()}%`,
						increment,
					});
					controller.enqueue(chunk);
				},
			});
			res = new Response(res.body.pipeThrough(stream));

			const data = Buffer.from(await res.arrayBuffer());
			const digest = createHash("sha256").update(data).digest("hex");
			if (`sha256:${digest}` !== asset.digest) {
				throw new Error("Checksum verification failed.");
			}

			return data;
		},
	);
}
