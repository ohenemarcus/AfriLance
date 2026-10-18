import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(directory, "../api-zod/src/index.ts");

await writeFile(
  indexPath,
  'export * from "./generated/api";\nexport * from "./legal-versions";\n',
);