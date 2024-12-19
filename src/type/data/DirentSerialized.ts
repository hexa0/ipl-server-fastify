import { Dirent } from "fs";

export interface DirentSerialized {
	/**
		The file name that this `DirentSerialized` object refers to. The type of this
		value is determined by the `options.encoding` passed to {@link readdir} or {@link readdirSync}.
		@since v10.10.0
	*/
	name: string;
	/**
		The base path that this `DirentSerialized` object refers to.
		@since v20.12.0
	*/
	parentPath: string;
	/**
		Alias for `direntSerialized.parentPath`.
		@since v20.1.0
		@deprecated Since v20.12.0
	*/
	path: string;
	/**
		`true` if the `DirentSerialized` object describes a regular file.
		@since v10.10.0
	*/
	isFile: boolean;
	/**
		`true` if the `DirentSerialized` object describes a file system directory.
		@since v10.10.0
	*/
	isDirectory: boolean;
	/**
		`true` if the `DirentSerialized` object describes a block device.
		@since v10.10.0
	*/
	isBlockDevice: boolean;
	/**
		`true` if the `DirentSerialized` object describes a character device.
		@since v10.10.0
	*/
	isCharacterDevice: boolean;
	/**
		`true` if the `DirentSerialized` object describes a symbolic link.
		@since v10.10.0
	*/
	isSymbolicLink: boolean;
	/**
		`true` if the `DirentSerialized` object describes a first-in-first-out
		@since v10.10.0
	*/
	isFIFO: boolean;
	/**
		`true` if the `DirentSerialized` object describes a socket.
		@since v10.10.0
	*/
	isSocket: boolean;
	/**
		`true` if the `DirentSerialized` object describes a regular file.
		@since v10.10.0
	*/
}

export function SerializeDirent(file: Dirent): DirentSerialized {
	return {
		name: file.name,
		parentPath: file.parentPath,
		path: file.parentPath,
		isFile: file.isFile(),
		isDirectory: file.isDirectory(),
		isBlockDevice: file.isBlockDevice(),
		isCharacterDevice: file.isCharacterDevice(),
		isSymbolicLink: file.isSymbolicLink(),
		isFIFO: file.isFIFO(),
		isSocket: file.isSocket(),
	};
}

export function SerializeDirents(files: Dirent[]): DirentSerialized[] {
	const serializedDirents: DirentSerialized[] = [];

	files.forEach((file) => {
		serializedDirents.push(SerializeDirent(file));
	});

	return serializedDirents;
}
