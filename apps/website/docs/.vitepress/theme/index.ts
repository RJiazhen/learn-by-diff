/// <reference path="./shim.d.ts" />
import { h, type Component } from "vue";
import DefaultTheme from "vitepress/theme";
import type { EnhanceAppContext } from "vitepress";
import HomeAtmosphere from "./HomeAtmosphere.vue";
import RedirectToRetained from "./RedirectToRetained.vue";
import "./custom.css";

/**
 * VitePress theme with LearnByDiff brand styles and a home-page atmosphere.
 */
export default {
  extends: DefaultTheme,
  /**
   * Renders the default layout and injects the home atmosphere above content.
   */
  Layout() {
    return h(DefaultTheme.Layout, null, {
      "layout-top": () => h(HomeAtmosphere as Component),
    });
  },
  /**
   * Registers Markdown-usable theme components.
   *
   * @param ctx.app - Vue app to register theme components on
   */
  enhanceApp({ app }: EnhanceAppContext) {
    app.component("RedirectToRetained", RedirectToRetained as Component);
  },
};
