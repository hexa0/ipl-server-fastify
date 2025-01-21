/**
	cache information about a file
*/
export interface FileCache {
	/**
		used for etag caching, should be the fastest available hashing algorithm
	*/
	hash: string;
	mimeType: string;

	/**
		metadata about the file
	*/
	date: {
		/**
			unix created date
		*/
		createdMs: number;
		/**
			unix modified date
		*/
		modifiedMs: number;
	};

	/**
		unix permissions string, something like -rw-rw-r--
	*/
	unixPermissions: string;
	/**
		unix file owner user
	*/
	unixOwner: number;
	/**
		unix file group owner
	*/
	unixGroup: number;

	/**
		file contents
	*/
	content: Buffer;
	/**
		brotli compressed file contents
	*/
	compressedContent?: Buffer;
}
