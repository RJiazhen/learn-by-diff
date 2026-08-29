import { spawn } from "node:child_process";

/**
 * Runs a shell command in `cwd` and resolves when it exits 0.
 *
 * Uses the user shell so `pnpm test` / `cargo test` work the same as in a terminal.
 *
 * @param command - Course-declared command line
 * @param cwd - Learning workspace root
 * @param onOutput - Optional stdout/stderr listener
 */
export async function runWorkspaceCommand(
  command: string,
  cwd: string,
  onOutput?: (chunk: string) => void,
): Promise<void> {
  const isWindows = process.platform === "win32";
  const child = spawn(command, {
    cwd,
    shell: true,
    env: process.env,
    windowsHide: isWindows,
  });
  child.stdout?.on("data", (chunk: Buffer | string) => {
    onOutput?.(String(chunk));
  });
  child.stderr?.on("data", (chunk: Buffer | string) => {
    onOutput?.(String(chunk));
  });
  await new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`command exited with code ${String(code)}: ${command}`));
    });
  });
}
