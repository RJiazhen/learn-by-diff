import { createRequire } from "node:module";
import { defineConfig } from "vite-plus";

const require = createRequire(import.meta.url);

/**
 * Resolves jsonc-parser's ESM entry.
 *
 * The package `main` is a UMD wrapper whose inner `require("./impl/...")`
 * is not followed when this extension is packed as CJS, so activation fails.
 */
function jsoncParserEsmEntry(): string {
  return require.resolve("jsonc-parser/lib/esm/main.js");
}

export default defineConfig({
  pack: {
    entry: ["src/extension.ts"],
    format: ["cjs"],
    dts: false,
    sourcemap: true,
    platform: "node",
    alias: {
      "jsonc-parser": jsoncParserEsmEntry(),
    },
    deps: {
      neverBundle: ["vscode"],
      alwaysBundle: ["@learn-by-diff/protocol", "jsonc-parser"],
      onlyBundle: false,
    },
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
