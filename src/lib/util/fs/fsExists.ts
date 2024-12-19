import { stat } from "fs/promises";

export function fsExists(filePath: string) {
	return new Promise((resolve, reject) => {
		stat(filePath).then(() => {
			resolve(true)
		}).catch(() => {
			resolve(false)
		})
	});
}