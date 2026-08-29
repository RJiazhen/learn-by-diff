import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/extension.ts"],
    format: ["cjs"],
    dts: false,
    sourcemap: true,
    platform: "node",
    deps: {
      neverBundle: ["vscode"],
      alwaysBundle: ["@learn-by-diff/protocol", "yaml"],
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
