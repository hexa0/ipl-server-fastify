console.log(`init! running ${process.version}`)

import { startServer } from "./server";
startServer();

import { initRoutes } from "./routes";
initRoutes();