import { promisify } from "util";
import { brotliCompress } from "zlib";

export const brotliCompressAsync = promisify(brotliCompress)