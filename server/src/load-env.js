import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Do not override variables already set by the host (e.g. Railway, Docker).
dotenv.config({
  path: path.resolve(__dirname, "..", ".env"),
  override: false,
});
