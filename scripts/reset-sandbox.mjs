import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandboxDir = path.join(repoRoot, "sandbox");
const readmePath = path.join(sandboxDir, "README.md");
const gitignorePath = path.join(sandboxDir, ".gitignore");

/** Canonical sandbox README when none can be preserved from disk. */
const DEFAULT_README = `# Extension Development Host workspace

F5 opens this folder. Use **LearnByDiff: Open Course** with \`examples/demo-course\` (prefilled in Development mode) to create a learning session here.

Generated \`.learn/\` and student files under this directory are gitignored. The extension does not \`git init\` here — create a repo yourself if you want one.

Reset to this empty state with \`pnpm run reset:sandbox\`.
`;

/** Root entries kept when resetting the sandbox. */
const PRESERVED_NAMES = new Set(["README.md", ".gitignore"]);

/**
 * Deletes sandbox contents except README and `.gitignore`.
 */
async function clearSandbox() {
  await mkdir(sandboxDir, { recursive: true });
  const entries = await readdir(sandboxDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => !PRESERVED_NAMES.has(entry.name))
      .map((entry) => rm(path.join(sandboxDir, entry.name), { recursive: true, force: true })),
  );
}

/**
 * Returns the README to restore: current file if present, otherwise the default text.
 */
async function readmeToRestore() {
  try {
    return await readFile(readmePath, "utf8");
  } catch {
    return DEFAULT_README;
  }
}

/**
 * Resets `sandbox/` to the initial state (README, and `.gitignore` if it already existed).
 */
async function main() {
  const readme = await readmeToRestore();
  let gitignore;
  try {
    gitignore = await readFile(gitignorePath, "utf8");
  } catch {
    gitignore = undefined;
  }

  await clearSandbox();
  await writeFile(readmePath, readme.endsWith("\n") ? readme : `${readme}\n`, "utf8");
  if (gitignore !== undefined) {
    await writeFile(gitignorePath, gitignore.endsWith("\n") ? gitignore : `${gitignore}\n`, "utf8");
  }
  console.log(`Sandbox restored: ${sandboxDir}`);
}

await main();
