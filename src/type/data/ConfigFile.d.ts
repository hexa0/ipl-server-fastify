export interface ConfigFile {
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

	mimeOverrides: any;
}
