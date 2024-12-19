const requireAll = require("require-all");
const routes = requireAll(__dirname);

export function initRoutes() {
	console.log("setup routes");

	for (const name in requireAll(__dirname)) {
		const RouteInit = routes[name].index?.default;

		if (RouteInit) {
			console.log(`init route: ${name}`);
			RouteInit();
		}
	}
}
