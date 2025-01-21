import { fastifyServer } from "../../server";
import { join, resolve } from "path";
import { SiteStructure } from "../../type/data/SiteStructure";
import { parse } from "jsonc-parser";
import { readdirSync, readFileSync } from "fs";
import { fileCache, folderCache, readFileContent } from "../../lib/util/cache/fsCache";
import { FileCache } from "../../type/data/FileCacheInformation";
import { FolderCache } from "../../type/data/FolderCacheInformation";
import { cwd } from "process";
import { AppConfig } from "../../type/data/AppConfig";

const structure: SiteStructure = {
	landingPageRoute: null,
	defaultApp: null,
	pathMap: {},
};

readdirSync("./apps/", { withFileTypes: true }).forEach((app) => {
	const appConfig = <AppConfig>(
		parse(readFileSync(join("./apps/", app.name, "app.jsonc"), "utf-8"))
	);

	if (appConfig.structure.landingPageRoute !== null) {
		structure.defaultApp = app.name;
		structure.landingPageRoute =
			"./" +
			join(
				"apps",
				app.name,
				"static",
				appConfig.structure.landingPageRoute
			).replaceAll("\\", "/") +
			"/";
	}

	Object.keys(appConfig.structure.pathMap).forEach((key: string) => {
		structure.pathMap["/" + key] =
			"./" +
			join(
				"apps",
				app.name,
				"static",
				appConfig.structure.pathMap[key]
			).replaceAll("\\", "/") +
			"/";
	});
});

const fsIndexTemplates = {
	page: readFileSync(
		"./apps/ipl/static/folderIndex/template/page.html",
		"utf-8"
	),
	directoryItem: readFileSync(
		"./apps/ipl/static/folderIndex/template/directoryItem.xml",
		"utf-8"
	),
	directoryHeader: readFileSync(
		"./apps/ipl/static/folderIndex/template/directoryHeader.xml",
		"utf-8"
	),
	watermark: readFileSync(
		"./apps/ipl/static/folderIndex/template/watermark.xml",
		"utf-8"
	),
	indexFound: readFileSync(
		"./apps/ipl/static/folderIndex/template/indexFound.xml",
		"utf-8"
	),
};

function addRoute(origin: string, remote: string) {
	remote = resolve(remote);

	fastifyServer.get(`${origin}*`, async (request, reply) => {
		let filePath = join(
			remote,
			decodeURIComponent(
				new URL(
					request.url.replace(origin, ""),
					`https://${request.headers.host}/`
				).pathname
			)
		);

		const query: { [K: string]: string } = <any>request.query;

		if (filePath.endsWith("/") || filePath.endsWith("\\")) {
			filePath = filePath.substring(0, filePath.length - 1);
		}

		const cachedFolder = <FolderCache | undefined>(
			await folderCache.get(filePath)
		);

		if (cachedFolder) {
			if (cachedFolder.indexHtmlPath && query["ignoreIndex"] !== "1") {
				const requestUrl = new URL(
					request.url,
					`https://${request.headers.host}`
				);

				if (requestUrl.pathname.endsWith("/")) {
					filePath = cachedFolder.indexHtmlPath;
				} else {
					requestUrl.pathname += "/";
					return reply.redirect(
						requestUrl.pathname + requestUrl.search
					);
				}
			}
		}

		const cachedFile = <FileCache | undefined>await fileCache.get(filePath);

		if (cachedFile) {
			reply.header("etag", cachedFile.hash);

			if (request.headers["if-none-match"] === cachedFile.hash) {
				// reply.header("content-length", cachedFile.content.length);
				// reply.header("content-type", cachedFile.mimeType);
				return reply.code(304).send();
			} else {
				if (cachedFile.mimeType.match("video") && query["partial"] !== "0") {
					// reply.header("content-type", "multipart/byteranges; " + cachedFile.mimeType);
					const rangeHeader = request.headers.range || `bytes=0-${Math.min(1024, cachedFile.content.length)}`
					
					const ranges = rangeHeader.split(",");
					const unit = ranges[0].split("=")[0];
					console.log(
						rangeHeader,
						unit,
						ranges[0].split("=")[1].split("-")[0],
						ranges[0].split("=")[1].split("-")[1]
					);

					const start = Number(
						ranges[0].split("=")[1].split("-")[0]
					);

					const end =
						Number(ranges[0].split("=")[1].split("-")[1]) ||
						Math.min(cachedFile.content.length - 1, start + ((1024 * 1024) * 2));

					if (unit !== "bytes") {
						return reply.code(416).send("Range Not Satisfiable");
					}

					if (ranges.length > 1) {
						return reply.code(416).send("Range Not Satisfiable");
					}
					
					const fileContent = readFileContent(cachedFile, false, start, end + 1)

					console.log(fileContent)

					reply.header("content-length", fileContent.lengthOfSection + 1);
					reply.header("content-range", `bytes ${start}-${end}/${fileContent.length}`);
					reply.header("content-type", cachedFile.mimeType);
					
					return reply.code(206).send(fileContent.data)
				} else {
					const fileContent = readFileContent(cachedFile)
					
					reply.header("content-length", fileContent.lengthOfSection);
					reply.header("content-type", cachedFile.mimeType);

					if (fileContent.isCompressed) {
						reply.header("content-encoding", "br");
					}

					return reply.send(fileContent.data);
				}
			}
		} else {
			if (cachedFolder) {
				const requestUrl = new URL(
					request.url,
					`https://${request.headers.host}`
				);

				if (!requestUrl.pathname.endsWith("/")) {
					requestUrl.searchParams.set("ignoreIndex", "1");
					requestUrl.pathname += "/";
					return reply.redirect(
						requestUrl.pathname + requestUrl.search
					);
				}

				reply.header("content-type", "text/html");

				let page = fsIndexTemplates.page;
				let listDivContents = fsIndexTemplates.directoryHeader.replace(
					"fileSystemPath",
					filePath.replace(cwd(), "").replaceAll("\\", "/")
				);

				const upItem = fsIndexTemplates.directoryItem
					.replace("fileIcon", "/ipl/folderIndex/icon/folder")
					.replace(
						"fileRedirect",
						"../" +
							new URL(
								request.url,
								`https://${request.headers.host}`
							).search
					)
					.replace("fileName", "..")
					.replace("fileSoundClass", "soundBack");

				listDivContents += upItem;

				cachedFolder.files.forEach((file) => {
					const redirectUrl = new URL(
						request.url,
						`https://${request.headers.host}`
					);
					redirectUrl.pathname = join(
						redirectUrl.pathname,
						file.name
					);

					const icon = file.isFile
						? "/ipl/folderIndex/icon/file"
						: "/ipl/folderIndex/icon/folder";
					const href =
						redirectUrl.pathname +
						(file.isFile ? "" : "/") +
						(file.isFile ? "" : redirectUrl.search);
					const hidden = file.name.startsWith(".");

					if (!hidden || query["ignoreHidden"] === "1") {
						const item = fsIndexTemplates.directoryItem
							.replace("fileIcon", icon)
							.replace("fileRedirect", href)
							.replace("fileName", file.name)
							.replace(
								"fileSoundClass",
								file.isFile
									? "soundFileOpen"
									: "soundFolderOpen"
							);
						listDivContents += item;
					}
				});

				listDivContents += fsIndexTemplates.watermark;

				if (cachedFolder.indexHtmlPath) {
					listDivContents += fsIndexTemplates.indexFound.replace(
						"indexPath",
						"./"
					);
				}

				listDivContents += cachedFolder.readmeHtml.toString();

				page = page.replace("listDivContents", listDivContents);

				if (query["listDivContentsOnly"] === "1") {
					return reply.send(listDivContents);
				} else {
					return reply.send(page);
				}
			} else {
				// possibly just send the 404 html?
				// that way we can keep the original failing url
				return reply.redirect("/404/");
			}
		}
	});
}

export default function init() {
	if (structure.landingPageRoute !== null) {
		addRoute("/", structure.landingPageRoute);
	}

	addRoute("/apps", "./apps/");

	Object.keys(structure.pathMap).forEach((key: string) => {
		addRoute(key, structure.pathMap[key]);
	});

	if (structure.defaultApp) {
		fastifyServer.get("/favicon.ico", (request, reply) => {
			const iconFile = fileCache.get(resolve(`./apps/${structure.defaultApp}/app.icon`))

			if (iconFile) {
				reply.header("content-type", iconFile.mimeType);
				reply.header("content-encoding", "br");
				return reply.send(iconFile.compressedContent);
			}
			else {
				return reply.callNotFound();
			}
		});
	}
}
