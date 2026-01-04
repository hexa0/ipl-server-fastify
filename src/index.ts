console.log(`init! running ${process.version}`)

import { initRoutes } from "./routes";
await initRoutes();

import { startServer } from "./server";
startServer();