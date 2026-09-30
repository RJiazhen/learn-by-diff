import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const packageDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolves a path inside this package.
 *
 * @param relative - Path relative to the package root
 */
function fromPackage(relative: string): string {
  return path.resolve(packageDir, relative);
}

export default defineConfig({
  build: {
    lib: {
      entry: fromPackage("src/chapter-jsonc.ts"),
      formats: ["es"],
      fileName: () => "chapter-jsonc.mjs",
    },
    outDir: fromPackage("../../skills/generate-course-config/scripts"),
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
    copyPublicDir: false,
    rolldownOptions: {
      external: [],
      output: {
        comments: true,
      },
    },
  },
  test: {
    include: ["tests/**/*.test.mjs"],
  },
  lint: {
    options: {
      typeAware: false,
      typeCheck: false,
    },
  },
  fmt: {},
});
