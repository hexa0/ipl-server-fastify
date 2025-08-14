import watch from "node-watch";
import { createHash } from "crypto";
import { walkSync } from "@nodelib/fs.walk";
import { join, resolve } from "path";
import { WASMagic } from "wasmagic";
import { readdir, readFile, stat } from "fs/promises";
import { warn } from "console";
import { isPromise } from "util/types";
import { FileCache } from "../../../type/data/FileCacheInformation";
import { permissionsAsString } from "../data/unixFilePermissionsAsString";
import { FolderCache } from "../../../type/data/FolderCacheInformation";
import { fsExists } from "../fs/fsExists";
import { SerializeDirents } from "../../../type/data/DirentSerialized";
import { Presets, SingleBar } from "cli-progress";
import { ServerConfig } from "../../var/serverConfig";
import { brotliCompressAsync } from "../data/brotliCompress";
import assert from "assert";
import { constants as zlibConstants } from "zlib";
import { parse as parseJsonC } from "jsonc-parser";
import { minify as minifyHTML } from "@minify-html/node";
import { transform as minifyCSS } from "lightningcss";
import { optimize as minifySVG } from 'svgo';

const forcedMimeTypes: Map<string, string> = new Map(
	Object.entries(ServerConfig.mimeOverrides)
);

export const fileCache = new Map<string, FileCache>();
export const folderCache = new Map<string, FolderCache>();

export interface FileReadInfo {
	isCompressed: boolean;
	data: Buffer;
	lengthOfSection: number;
	length: number;
}

export function readFileContent(fileCache: FileCache, preferCompressedContent: boolean = true, rangeStart?: number, rangeEnd?: number): FileReadInfo {
	assert(!((rangeStart && rangeEnd) && preferCompressedContent), "cannot compress buffer with range")
	assert((rangeStart !== undefined && rangeEnd !== undefined) || (rangeStart == undefined && rangeEnd == undefined), "rangeEnd must be specified if rangeStart is specified")
	
	let buffer = fileCache.content
	const isCompressed = preferCompressedContent && fileCache.compressedContent !== undefined
	if (preferCompressedContent && fileCache.compressedContent !== undefined) {
		buffer = fileCache.compressedContent
	}

	if (rangeStart !== undefined && rangeEnd !== undefined) {
		buffer = buffer.subarray(rangeStart, rangeEnd)
	}

	return {
		isCompressed: isCompressed,
		data: buffer,
		lengthOfSection: buffer.length,
		length: fileCache.content.length,
	}
}

async function undefinePath(name: string) {
	const filePath = resolve(name);
	fileCache.delete(filePath);
}

let wasMagic: Promise<WASMagic> | WASMagic = WASMagic.create();

wasMagic.then((magicResolved) => {
	wasMagic = magicResolved;
});

let pathCount = 0;
let cachedPathCount = 0;
let cacheBarActive = true;
const pathCacheBar = new SingleBar(
	{ clearOnComplete: true },
	Presets.shades_classic
);

async function definePath(name: string) {
	const filePath = resolve(name);
	const filePathForwardSlash = filePath.replaceAll("\\", "/");

	if (
		filePathForwardSlash.match("/node_modules/") ||
		filePathForwardSlash.match("/.git/")
	) {
		return;
	}

	pathCount++;

	return stat(filePath)
		.then((pathStat) => {
			if (pathStat.isFile()) {
				readFile(filePath).then(async (fileData) => {
					const magic = isPromise(wasMagic)
						? await wasMagic
						: wasMagic;

					const mimeType =
						forcedMimeTypes.get(
							filePath.substring(filePath.lastIndexOf(".") + 1)
						) || magic.detect(fileData);
					

					if (ServerConfig.optimizeFiles == true || ServerConfig.optimizeFiles == null) {
						try {
							if (mimeType.startsWith("application/json")) {
								fileData = Buffer.from(
									JSON.stringify(parseJsonC(fileData.toString("utf-8"))),
									"utf-8"
								);
							}
							
							if (mimeType.startsWith("text/html")) {
								fileData = minifyHTML(fileData, {
									// sadly inline js and css minification creates errors and problems
								});
							}

							if (mimeType.startsWith("text/css")) {
								fileData = Buffer.from(minifyCSS({
									filename: "dummy.css",
									code: fileData,
									minify: true,
									sourceMap: false
								}).code);
							}

							if (mimeType.startsWith("image/svg+xml")) {
								fileData = Buffer.from(minifySVG(fileData.toString("utf-8"), {
									path: filePath,
									multipass: true,
									plugins: [
										{
											name: 'preset-default',
											params: {
												overrides: {
													cleanupIds: false
												},
											},
										},
										"removeXMLProcInst", // mine type is already computed before optimizations, this is safe
										"removeOffCanvasPaths", // culling
										"sortAttrs", // improve  compression
										"removeTitle", // this should always be provided by the page itself
										{
											name: "removeDesc",
											params: {
												removeAny: true
											}
										}, // same deal as the previous plugin
										"removeDimensions" // not needed
									]
								}).data)
							}
						}
						catch {
							console.warn(`optimization failed for ${filePath}`)
						}
					}
					else {
						if (mimeType.startsWith("application/json") && filePath.endsWith(".jsonc")) {
							fileData = Buffer.from(
								JSON.stringify(parseJsonC(fileData.toString("utf-8"))),
								"utf-8"
							);
						}
					}

					const shouldCompress = mimeType.startsWith("text") || mimeType.match("json")

					const cache: FileCache = {
						hash: createHash("sha256")
							.update(fileData)
							.digest("hex"),
						mimeType: mimeType,
						date: {
							createdMs: pathStat.ctimeMs,
							modifiedMs: pathStat.mtimeMs,
						},
						unixPermissions: permissionsAsString(pathStat.mode),
						unixOwner: pathStat.uid,
						unixGroup: pathStat.gid,
						content: fileData,
					};

					fileCache.set(filePath, cache);

					if (shouldCompress) {
						// do this async so we don't wait for the compression to finish before continuing, saving us a little bit of time
						brotliCompressAsync(fileData, {
							[zlibConstants.BROTLI_PARAM_QUALITY]: 4,
						  }).then(async (compressed) => {
							const cache = fileCache.get(filePath)
							assert(cache, "cache doesn't exist, throwing.")
							cache.compressedContent = compressed

							if (cacheBarActive) {
								cachedPathCount++;
								if (cachedPathCount === 1) {
									pathCacheBar.start(pathCount, cachedPathCount);
								} else if (cachedPathCount === pathCount) {
									pathCacheBar.update(cachedPathCount);
									pathCacheBar.stop();
									console.log("fs cache complete!");
									cacheBarActive = false;
								} else {
									pathCacheBar.update(cachedPathCount);
								}
							}
						});
					}
					else {
						if (cacheBarActive) {
							cachedPathCount++;
							if (cachedPathCount === 1) {
								pathCacheBar.start(pathCount, cachedPathCount);
							} else if (cachedPathCount === pathCount) {
								pathCacheBar.update(cachedPathCount);
								pathCacheBar.stop();
								console.log("fs cache complete!");
								cacheBarActive = false;
							} else {
								pathCacheBar.update(cachedPathCount);
							}
						}
					}
				});
			} else if (pathStat.isDirectory()) {
				readdir(filePath, { withFileTypes: true }).then((files) => {
					const indexHtmlPath = join(filePath, "index.html");
					const readmeHtmlPath = join(
						filePath,
						".fsindex.readme.html"
					);

					fsExists(indexHtmlPath).then((indexExists) => {
						fsExists(readmeHtmlPath).then(async (readmeExists) => {
							const cache: FolderCache = {
								indexHtmlPath: indexExists
									? indexHtmlPath
									: undefined,
								readmeHtml: readmeExists
									? await readFile(readmeHtmlPath)
									: Buffer.alloc(0),

								files: SerializeDirents(files),
							};

							folderCache.set(filePath, cache);
							if (cacheBarActive) {
								cachedPathCount++;
								if (cachedPathCount === 1) {
									pathCacheBar.start(
										pathCount,
										cachedPathCount
									);
								} else if (cachedPathCount === pathCount) {
									pathCacheBar.update(cachedPathCount);
									pathCacheBar.stop();
									console.log("fs cache complete!");
									cacheBarActive = false;
								} else {
									pathCacheBar.update(cachedPathCount);
								}
							}
						});
					});
				});
			}
		})
		.catch(warn);
}

console.log("walking ./apps");
definePath(resolve("./apps"));
walkSync("./apps", <{}>{ ignore: ["*/.git/**"] }).forEach((file) => {
	definePath(resolve(file.path)).catch(warn);
});
console.log(`${pathCount} files/folders to be cached in ./apps`);
console.log("watching for changes in ./apps");
watch("./apps", { recursive: true }, (event, name) => {
	if (event === "remove") {
		undefinePath(name);
	} else if (event === "update") {
		definePath(name);
	}
});
