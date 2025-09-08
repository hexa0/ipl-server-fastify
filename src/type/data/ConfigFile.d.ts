export interface ConfigFile {
	optimizeFiles: boolean?;

	network: {
		port: {
			http: number;
			https: number;
		};
	};

	authentication: {
		api: {
			key: string;
		};
	};

	mimeOverrides: {
		[key: string]: string
	};

	mimeManualCacheTime: {
		[key: string]: number
	};
}
