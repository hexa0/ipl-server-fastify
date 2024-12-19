// copilot did this for me because no-one had some code that i could skid for this (fuck you)
export function permissionsAsString(octal: number): string {
	const types: { [key: number]: string } = {
		0: "---",
		1: "--x",
		2: "-w-",
		3: "-wx",
		4: "r--",
		5: "r-x",
		6: "rw-",
		7: "rwx",
	};

	let result = "";
	const str = octal.toString(8).padStart(4, "0"); // Ensuring the string is 4 characters long

	const fileType = str.charAt(0);
	switch (fileType) {
		case "0":
			result += "-";
			break; // Regular file
		case "1":
			result += "p";
			break; // Named pipe (FIFO)
		case "2":
			result += "c";
			break; // Character special file
		case "4":
			result += "d";
			break; // Directory
		case "6":
			result += "b";
			break; // Block special file
		case "7":
			result += "s";
			break; // Socket link
		default:
			result += "?";
			break; // Unknown
	}

	result +=
		types[parseInt(str.charAt(1))] +
		types[parseInt(str.charAt(2))] +
		types[parseInt(str.charAt(3))];
	return result;
}

// console.log(permissionsAsString(0o644)); // Example output: -rw-r--r--
