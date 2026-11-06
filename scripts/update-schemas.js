import { unpackTar } from "modern-tar";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

/**
 * @typedef ReleaseInfo
 * @property {string} tag_name
 * @property {Array<{name: string, browser_download_url: string}>} [assets]
 */
/**
 * @typedef Package
 * @property {object} [contributes]
 * @property {Array<{url: string}>} [contributes.jsonValidation]
 */

const REPO = "rockide/schemas";
const ASSET_NAME = "schemas.tar.gz";
const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const PKG_PATH = join(ROOT_DIR, "package.json");

/**
 * @returns {Promise<ReleaseInfo>}
 */
async function getLatestRelease() {
	const res = await fetch(
		`https://api.github.com/repos/${REPO}/releases/latest`,
		{
			headers: { Accept: "application/vnd.github+json" },
		},
	);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch latest schemas release: ${res.statusText} (${res.status})`,
		);
	}
	return await res.json();
}

/**
 * @param {string} url
 * @returns {string}
 */
function rewriteUrl(url) {
	if (typeof url !== "string") {
		return url;
	}
	if (url.startsWith("./dist/")) {
		return url.replace("./dist/", "rockide-schema:///");
	}
	return url;
}

async function main() {
	const release = await getLatestRelease();
	const asset = release.assets?.find((a) => a.name === ASSET_NAME);
	if (!asset) {
		throw new Error(
			`Release ${release.tag_name} has no asset named ${ASSET_NAME}.`,
		);
	}
	console.log(`Downloading ${REPO} ${release.tag_name} (${asset.name})...`);
	const res = await fetch(asset.browser_download_url);
	if (!res.ok) {
		throw new Error(
			`Failed to download schemas: ${res.statusText} (${res.status})`,
		);
	}
	const data = Buffer.from(await res.arrayBuffer());
	const entries = await unpackTar(gunzipSync(data));
	const pkgEntry = entries.find((e) => e.data && e.header.name === "package.json");
	if (!pkgEntry) {
		throw new Error(
			`Release ${release.tag_name} asset is missing package.json.`,
		);
	}
	/**
	 * @type Package
	 */
	const schemasPkg = JSON.parse(Buffer.from(pkgEntry.data).toString("utf8"));
	const validations = schemasPkg.contributes?.jsonValidation;
	if (!Array.isArray(validations)) {
		throw new Error(
			`Release ${release.tag_name} has no contributes.jsonValidation.`,
		);
	}

	/**
	 * @type {Array<{url: string}>}
	 */
	const rewritten = validations.map((entry) => ({
		...entry,
		url: rewriteUrl(entry.url),
	}));
	const raw = await readFile(PKG_PATH, "utf8");
	/**
	 * @type Package
	 */
	const pkg = JSON.parse(raw);
	pkg.contributes = pkg.contributes || {};
	pkg.contributes.jsonValidation = rewritten;
	// Preserve existing formatting (tabs).
	const trailingNewline = raw.endsWith("\n") ? "\n" : "";
	await writeFile(
		PKG_PATH,
		`${JSON.stringify(pkg, null, "\t")}${trailingNewline}`,
	);
	console.log(
		`Updated ${rewritten.length} jsonValidation entries from ${release.tag_name}.`,
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
