import { Dirent } from "@nodelib/fs.walk";
import { DirentSerialized } from "./DirentSerialized";

/**
	cache information about a folder
*/
export interface FolderCache {
	indexHtmlPath: string | undefined;
	readmeHtml: Buffer;

	files: DirentSerialized[];
}
