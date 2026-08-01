import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (match) => match.slice(1));
const roots = ["src", "scripts", "tests"];
const files = [];

function collect(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) collect(path);
    else if (/\.(?:js|mjs)$/.test(name)) files.push(path);
  }
}

roots.forEach((directory) => collect(join(root, directory)));
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

console.log(`Syntax check passed: ${files.length} files`);

