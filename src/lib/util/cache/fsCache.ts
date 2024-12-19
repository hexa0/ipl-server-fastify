import { createCache } from "cache-manager";
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

const forcedMimeTypes: Map<string, string> = new Map(
	Object.entries(ServerConfig.mimeOverrides)
);

export const fileCache = createCache();
export const folderCache = createCache();

async function undefinePath(name: string) {
	const filePath = resolve(name);
	fileCache.del(filePath);
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

					const cache: FileCache = {
						hash: createHash("sha256")
							.update(fileData)
							.digest("hex"),
						mimeType:
							forcedMimeTypes.get(
								filePath.substring(
									filePath.lastIndexOf(".") + 1
								)
							) || magic.detect(fileData),
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
