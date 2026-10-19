import { defineConfig } from "vite-plus";

export default defineConfig({
  // Format and auto-fix lint on staged files before each commit; CI still runs the full check.
  staged: {
    "*": ["vp fmt --write", "vp lint --fix"],
  },
  fmt: {
    ignorePatterns: ["skills/generate-course-config/scripts/chapter-jsonc.mjs"],
  },
  lint: {
    ignorePatterns: ["skills/generate-course-config/scripts/chapter-jsonc.mjs"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
});
