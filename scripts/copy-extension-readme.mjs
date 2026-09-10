import { copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceReadme = path.join(repoRoot, "README.md");
const destReadme = path.join(repoRoot, "apps/vscode-extension/README.md");

/**
 * Copies the repo-root English README into the extension folder so vsce can pack it.
 */
export async function copyExtensionReadme() {
  await copyFile(sourceReadme, destReadme);
}

/**
 * Runs the copy and prints the destination path.
 */
async function main() {
  await copyExtensionReadme();
  console.log(
    `Copied ${path.relative(repoRoot, sourceReadme)} -> ${path.relative(repoRoot, destReadme)}`,
  );
}

await main();
