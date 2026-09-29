import { defineConfig } from "vite-plus";

export default defineConfig({
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
