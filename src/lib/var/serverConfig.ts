import { readFileSync } from "fs";
import { ConfigFile } from "../../type/data/ConfigFile";
import { parse } from "jsonc-parser";

const ExampleConfig = parse(readFileSync("example.config.jsonc", "utf-8"));
const ActualConfig = parse(readFileSync("config.jsonc", "utf-8"));

for (const key in ExampleConfig) {
	if (ActualConfig[key] === undefined) {
		console.error(`config is missing ${key}, filling with values provided by example.config.jsonc`)
		ActualConfig[key] = ExampleConfig[key]
	}
}

console.log(`config loaded!`)

export const ServerConfig = <ConfigFile>ActualConfig;