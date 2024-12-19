import { readFileSync } from "fs";
import { ConfigFile } from "../../type/data/ConfigFile";
import { parse } from "jsonc-parser";

export const ServerConfig = <ConfigFile>parse(readFileSync("config.jsonc", "utf-8"));
