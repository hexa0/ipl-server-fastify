import Fastify from "fastify";
import { readFileSync } from "fs";
import { ServerConfig } from "./lib/var/serverConfig";

export const fastifyServer = Fastify({
	logger: true,
	http2: true,
	https: {
		key: readFileSync("ssl/key.pem", "utf8"),
		cert: readFileSync("ssl/cert.pem", "utf8"),
	},
});

export const startServer = async () => {
	console.log("start server")
	
	try {
		await fastifyServer.listen({ port: ServerConfig.network.port.https, host: "::" });
	} catch (err) {
		fastifyServer.log.error(err);
		process.exit(1);
	}
};