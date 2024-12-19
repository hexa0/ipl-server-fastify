import { fastifyServer } from "../../server";
import { join, resolve } from "path";
import { SiteStructure } from "../../type/data/SiteStructure";
import { parse } from "jsonc-parser";
import { readdirSync, readFileSync } from "fs";
import { fileCache, folderCache } from "../../lib/util/cache/fsCache";
import { FileCache } from "../../type/data/FileCacheInformation";
import { FolderCache } from "../../type/data/FolderCacheInformation";
import { cwd } from "process";
import { AppConfig } from "../../type/data/AppConfig";

const structure: SiteStructure = {
	landingPageRoute: null,
	defaultApp: null,
	pathMap: {},
};

readdirSync("./apps/", {withFileTypes: true}).forEach((app) => {
	const appConfig = <AppConfig>parse(readFileSync(join("./apps/", app.name, "app.jsonc"), "utf-8"))
	
	if (appConfig.structure.landingPageRoute) {
		structure.defaultApp = app.name
		structure.landingPageRoute = "./" + join("apps", app.name, "static", appConfig.structure.landingPageRoute).replaceAll("\\", "/") + "/"
	}

	Object.keys(appConfig.structure.pathMap).forEach((key: string) => {
		structure.pathMap["/" + key] = "./" + join("apps", app.name, "static", appConfig.structure.pathMap[key]).replaceAll("\\", "/") + "/"
	});
})

const fsIndexTemplates = {
	page: readFileSync("./apps/ipl/static/folderIndex/template/page.html", "utf-8"),
	directoryItem: readFileSync(
		"./apps/ipl/static/folderIndex/template/directoryItem.xml",
		"utf-8"
	),
	directoryHeader: readFileSync(
		"./apps/ipl/static/folderIndex/template/directoryHeader.xml",
		"utf-8"
	),
	watermark: readFileSync("./apps/ipl/static/folderIndex/template/watermark.xml", "utf-8"),
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
			decodeURIComponent(new URL(
				request.url.replace(origin, ""),
				`https://${request.headers.host}/`
			).pathname)
		);

		if (filePath.endsWith("/") || filePath.endsWith("\\")) {
			filePath = filePath.substring(0, filePath.length - 1);
		}

		const cachedFolder = <FolderCache | undefined>(
			await folderCache.get(filePath)
		);

		if (cachedFolder) {
			if (
				cachedFolder.indexHtmlPath &&
				(<{ [K: string]: string }>request.query)["ignoreIndex"] !== "1"
			) {
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
			reply.header("content-type", cachedFile.mimeType);

			reply.header("etag", cachedFile.hash);
			if (request.headers["if-none-match"] === cachedFile.hash) {
				return reply.code(304).send();
			} else {
				return reply.send(cachedFile.content);
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
					.replace(
						"fileIcon",
						"/ipl/folderIndex/icon/folder"
					)
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
					const href = redirectUrl.pathname + (file.isFile ? "" : "/") + (file.isFile ? "" : redirectUrl.search);
					const hidden = file.name.startsWith(".");

					if (!hidden || (<{ [K: string]: string }>request.query)["ignoreHidden"] === "1") {
						const item = fsIndexTemplates.directoryItem
							.replace("fileIcon", icon)
							.replace("fileRedirect", href)
							.replace("fileName", file.name)
							.replace("fileSoundClass", file.isFile ? "soundFileOpen" : "soundFolderOpen")
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

				if ((<{ [K: string]: string }>request.query)["listDivContentsOnly"] === "1") {
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
			fileCache.get(resolve(`./apps/${structure.defaultApp}/app.icon`)).then((got) => {
				if (got) {
					const fileCache = <FileCache>got;
	
					reply.header("content-type", fileCache.mimeType);
					return reply.send(fileCache.content);
				}
			});
		});
	}
}
