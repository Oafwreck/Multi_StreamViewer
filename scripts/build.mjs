import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all([
  cp(join(root, "index.html"), join(output, "index.html")),
  cp(join(root, "styles.css"), join(output, "styles.css")),
  cp(join(root, "tokens.css"), join(output, "tokens.css")),
  cp(join(root, "src"), join(output, "src"), { recursive: true }),
]);

console.log("Build complete: dist/");

