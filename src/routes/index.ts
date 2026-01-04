import { Glob } from "bun";
import path from "node:path";

const glob = new Glob("src/routes/**/index.ts");

export async function initRoutes() {
	console.log("setup routes");

	for await (const file of glob.scan(".")) {
		const routeModule = await import(path.resolve(file));

		if (typeof routeModule.default === "function") {
			console.log(`init route: ${file}`);
			routeModule.default();
		}
	}
}
